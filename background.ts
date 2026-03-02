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

    const response = await fetch("https://graphql.anilist.co", {
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

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ query, variables }),
    })

    return response.json()
  }
}

// ============================================
// Debouncing Logic
// ============================================
const debounceTimers = new Map<number, NodeJS.Timeout>()
const pendingUpdates = new Map<number, { progress?: number; score?: number; status?: string }>()

async function processUpdate(entryId: number) {
  const token = await Storage.get<string>(Storage.DATA.ACCESS_TOKEN)
  const data = pendingUpdates.get(entryId)

  if (token && data) {
    const api = new AniList(token)
    await api.saveMediaListEntry({ id: entryId, ...data })
    console.log(`[Background] Synced entry ${entryId} to AniList`, data)
    
    // Cleanup
    pendingUpdates.delete(entryId)
    debounceTimers.delete(entryId)
  }
}

// Flush all pending updates immediately
async function flushAllPendingUpdates() {
  console.log('[Background] Flushing all pending updates...')
  
  // Clear all timers
  debounceTimers.forEach((timer) => clearTimeout(timer))
  debounceTimers.clear()
  
  // Process all pending updates immediately
  const promises = Array.from(pendingUpdates.keys()).map(entryId => processUpdate(entryId))
  await Promise.all(promises)
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
      if (debounceTimers.has(entryId)) {
        clearTimeout(debounceTimers.get(entryId))
      }

      const timer = setTimeout(() => {
        processUpdate(entryId)
      }, 5000) // 5-second buffer

      debounceTimers.set(entryId, timer)
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
  
  return true // Keep listener active for async response
})

// Listen for storage changes and broadcast to all contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes[Storage.DATA.ACCESS_TOKEN] || changes[Storage.DATA.USER]) {
      console.log('Auth data changed in storage, broadcasting...')
      broadcastAuthChange()
    }
  }
})

// Flush all pending updates when popup closes
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    console.log('[Background] Popup connected')
    
    port.onDisconnect.addListener(() => {
      console.log('[Background] Popup disconnected, flushing updates...')
      flushAllPendingUpdates()
    })
  }
})