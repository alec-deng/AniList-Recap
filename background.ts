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