import { AUTH_CONFIG } from "./config/auth.config"

// ============================================
// Storage Management
// ============================================
class Storage {
  static DATA = {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
  }

  static async set(key: string, data: unknown): Promise<void> {
    const obj: Record<string, unknown> = {}
    obj[key] = data
    await chrome.storage.local.set(obj)
  }

  static async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  }

  static async get<T = unknown>(key: string): Promise<T | null> {
    const data = await chrome.storage.local.get(key)
    return (data[key] as T) ?? null
  }
}

// ============================================
// AniList API
// ============================================
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co/";

class AniList {
  #accessToken: string

  constructor(token: string) {
    this.#accessToken = token
  }

  #headers(): Headers {
    const headers = new Headers()
    headers.append("Content-Type", "application/json")
    headers.append("Accept", "application/json")
    
    if (this.#accessToken) {
      headers.append("Authorization", `Bearer ${this.#accessToken}`)
    }
    return headers
  }

  async user(): Promise<any> {
    const query = `
      query Query {
        Viewer {
          id
          name
          avatar {
            medium
          }
        }
      }
    `

    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ query }),
    })

    return response.json()
  }

  // Method to handle mutations from the background
  async saveMediaListEntry(variables: { id: number; progress?: number; score?: number; status?: string }): Promise<any> {
    const query = `
      mutation ($id: Int, $progress: Int, $score: Float, $status: MediaListStatus) {
        SaveMediaListEntry (id: $id, progress: $progress, score: $score, status: $status) {
          id
          progress
          score
          status
        }
      }
    `

    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ query, variables }),
    })

    return response.json()
  }

  // Minimal addition: Bulk method
  async saveBulkMediaListEntries(entries: Map<number, any>) {
    const mutationParts = Array.from(entries.entries()).map(([id, data]) => {
      const args = [`id: ${id}`]
      if (data.progress !== undefined) args.push(`progress: ${data.progress}`)
      if (data.score !== undefined) args.push(`score: ${data.score}`)
      if (data.status !== undefined) args.push(`status: ${data.status}`)
      return `m${id}: SaveMediaListEntry(${args.join(", ")}) { id }`
    })

    const query = `mutation { ${mutationParts.join("\n")} }`

    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ query }),
    })

    return response.json()
  }
}

// ============================================
// Debouncing Logic
// ============================================
let globalDebounceTimer: NodeJS.Timeout | null = null
const pendingUpdates = new Map<number, { progress?: number; score?: number; status?: string }>()

async function flushAllPendingUpdates() {
  if (pendingUpdates.size === 0) return
  
  if (globalDebounceTimer) {
    clearTimeout(globalDebounceTimer)
    globalDebounceTimer = null
  }

  const token = await Storage.get<string>(Storage.DATA.ACCESS_TOKEN)
  if (!token) return

  try {
    const api = new AniList(token)
    const updatesToFlush = new Map(pendingUpdates)
    pendingUpdates.clear()

    await api.saveBulkMediaListEntries(updatesToFlush)
    console.log('[Background] Bulk sync completed')
  } catch (error) {
    console.error("[Background] Failed to flush updates:", error)
  }
}

// ============================================
// Authentication
// ============================================
class Auth {
  static CLIENT_ID = AUTH_CONFIG.clientId

  static async login() {
    const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize")
    authUrl.searchParams.append("client_id", this.CLIENT_ID.toString())
    authUrl.searchParams.append("response_type", "token")

    let redirectUrl: string | undefined

    try {
      redirectUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl.toString(),
        interactive: true,
      })
    } catch (err) {
      console.error("[Auth] launchWebAuthFlow failed:", err)
      throw new Error("OAuth login failed or was cancelled")
    }

    if (!redirectUrl) {
      console.error("[Auth] No redirectUrl returned")
      throw new Error("Authentication flow was cancelled or blocked")
    }

    const fragment = redirectUrl.split("#")[1]
    const params = new URLSearchParams(fragment)
    const accessToken = params.get("access_token")

    if (accessToken === null) {
      throw new Error("Missing Access Token")
    }

    const user = await new AniList(accessToken).user()

    await Promise.all([
      Storage.set(Storage.DATA.ACCESS_TOKEN, accessToken),
      Storage.set(Storage.DATA.USER, user),
    ])

    return user
  }

  static async logout() {
    // Flush before clearing storage
    await flushAllPendingUpdates()
    await Promise.all([
      Storage.remove(Storage.DATA.ACCESS_TOKEN),
      Storage.remove(Storage.DATA.USER),
    ])
  }
}

// ============================================
// Message Handler
// ============================================
function broadcastAuthChange() {
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'AUTH_CHANGED' }).catch(() => {
          // Ignore errors for tabs that don't have content scripts
        })
      }
    })
  })

  // Send to popup if it's open
  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' }).catch(() => {
    // Ignore errors if popup is not open
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
    switch (message.action) {
      case "QUEUE_UPDATE":
        const { entryId, progress, score, status } = message.payload
        
        // Merge new changes with existing pending data for this entry
        const existing = pendingUpdates.get(entryId) || {}
        pendingUpdates.set(entryId, {
          ...existing,
          ...(progress !== undefined && { progress }),
          ...(score !== undefined && { score }),
          ...(status !== undefined && { status })
        })

        // Reset debounce timer
        if (globalDebounceTimer) {
          clearTimeout(globalDebounceTimer)
        }

        globalDebounceTimer = setTimeout(() => {
          flushAllPendingUpdates()
        }, 5000) // 5-second buffer

        sendResponse({ status: "queued" })
        break

      case "USER":
        Storage.get(Storage.DATA.USER)
          .then((user) => sendResponse({ user }))
          .catch((error) => sendResponse({ error: error.message }))
        break

      case "LOGIN":
        Auth.login()
          .then((user) => {
            sendResponse({ user })
            broadcastAuthChange()
          })
          .catch((error) => sendResponse({ error: error.message }))
        break

      case "LOGOUT":
        Auth.logout()
          .then(() => {
            sendResponse({})
            broadcastAuthChange()
          })
          .catch((error) => sendResponse({ error: error.message }))
        break

      case "CHECK_AUTH":
        Promise.all([
          Storage.get(Storage.DATA.ACCESS_TOKEN),
          Storage.get(Storage.DATA.USER)
        ])
          .then(([token, user]) => sendResponse({ token, user }))
          .catch((error) => sendResponse({ error: error.message }))
        break
    }
  }
  
  handleMessage()
  return true // Keep listener active for async response
})

// Listen for storage changes and broadcast to all contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes[Storage.DATA.ACCESS_TOKEN] || changes[Storage.DATA.USER]) {
      broadcastAuthChange()
    }
  }
})

// Flush all pending updates when popup closes
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    port.onDisconnect.addListener(() => {
      flushAllPendingUpdates()
    })
  }
})