export {}

// ============================================
// Storage Management
// ============================================
class Storage {
  static DATA = {
    ACCESS_TOKEN: "accessToken",
    USER: "user",
    PENDING_UPDATES: "pendingUpdates",
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

// fetch() doesn't reject on 4xx/5xx, and AniList answers those with valid JSON
// — a bare `return response.json()` would read a rejected request as success.
class AniListRequestError extends Error {
  readonly status: number
  // Named even on failure: an aliased multi-mutation can partly succeed
  readonly data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = "AniListRequestError"
    this.status = status
    this.data = data
  }
}

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

  async #request(query: string, variables?: Record<string, unknown>): Promise<any> {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ query, variables }),
    })

    // A 5xx can arrive as an HTML error page, which isn't parseable
    const json = await response.json().catch(() => null)

    if (!response.ok) {
      const detail = json?.errors?.[0]?.message
      throw new AniListRequestError(
        `AniList request failed with ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
        json?.data
      )
    }

    if (json?.errors?.length) {
      throw new AniListRequestError(
        json.errors.map((e: { message?: string }) => e.message).join("; "),
        response.status,
        json?.data
      )
    }

    return json
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

    return this.#request(query)
  }

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

    return this.#request(query, variables)
  }

  async saveBulkMediaListEntries(entries: Map<number, any>) {
    const mutationParts = Array.from(entries.entries()).map(([id, data]) => {
      const args = [`id: ${id}`]
      if (data.progress !== undefined) args.push(`progress: ${data.progress}`)
      if (data.score !== undefined) args.push(`score: ${data.score}`)
      if (data.status !== undefined) args.push(`status: ${data.status}`)
      // updatedAt lets the popup reconcile "Last Updated" after a flush, free
      return `m${id}: SaveMediaListEntry(${args.join(", ")}) { id updatedAt }`
    })

    const query = `mutation { ${mutationParts.join("\n")} }`

    return this.#request(query)
  }
}

// ============================================
// Debouncing Logic
// ============================================
// A terminated MV3 worker drops a pending setTimeout, so updates are mirrored
// to chrome.storage.local to survive a restart, and re-queued if sync fails.
type PendingUpdate = { progress?: number; score?: number; status?: string }
type QueuedUpdate = PendingUpdate & { queuedAt: number }

// The account is editable elsewhere and a worker can lie dormant for days, so
// a very old edit could clobber newer changes made from another device —
// hence the age-out below, which is also what makes retrying indefinitely safe.
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000
const MAX_FLUSH_ATTEMPTS = 3

let globalDebounceTimer: ReturnType<typeof setTimeout> | null = null
const pendingUpdates = new Map<number, QueuedUpdate>()
const failedAttempts = new Map<number, number>()

async function persistPendingUpdates(): Promise<void> {
  if (pendingUpdates.size === 0) {
    // An empty queue must clear the mirror, or a restart replays a synced batch
    await Storage.remove(Storage.DATA.PENDING_UPDATES)
    return
  }
  await Storage.set(Storage.DATA.PENDING_UPDATES, Array.from(pendingUpdates.entries()))
}

async function restorePendingUpdates(): Promise<void> {
  const saved = await Storage.get<[number, Partial<QueuedUpdate>][]>(Storage.DATA.PENDING_UPDATES)
  if (!saved || saved.length === 0) return

  for (const [id, data] of saved) {
    // Pre-queuedAt entries get a fresh window instead of reading as infinitely old
    pendingUpdates.set(id, { ...data, queuedAt: data.queuedAt ?? Date.now() })
  }

  flushAllPendingUpdates()
}

function dropStaleUpdates(): void {
  const oldest = Date.now() - MAX_QUEUE_AGE_MS
  let dropped = false

  for (const [id, data] of pendingUpdates) {
    if (data.queuedAt < oldest) {
      pendingUpdates.delete(id)
      failedAttempts.delete(id)
      dropped = true
      console.warn(`[Background] Discarding entry ${id}, queued too long ago to replay safely:`, data)
    }
  }

  // So a flush left with nothing still clears the storage mirror
  if (dropped) persistPendingUpdates()
}

type SyncedEntry = { id: number; updatedAt: number }

function isSyncedEntry(value: unknown): value is SyncedEntry {
  const entry = value as SyncedEntry | null
  return !!entry && typeof entry.id === "number" && typeof entry.updatedAt === "number"
}

// Hands the server's real updatedAt back to the popup's list cache
function onEntriesSynced(entries: SyncedEntry[]): void {
  chrome.runtime.sendMessage({ type: "ENTRIES_SYNCED", payload: entries }).catch(() => {}) // popup may not be open
}

// The aliased bulk mutation can apply some entries and reject others; reading
// which landed stops a retry from re-sending edits that already applied.
function reportSynced(data: unknown): Set<number> {
  const synced = Object.values((data ?? {}) as Record<string, unknown>).filter(isSyncedEntry)
  if (synced.length > 0) onEntriesSynced(synced)
  return new Set(synced.map((entry) => entry.id))
}

async function flushAllPendingUpdates() {
  dropStaleUpdates()
  if (pendingUpdates.size === 0) return

  if (globalDebounceTimer) {
    clearTimeout(globalDebounceTimer)
    globalDebounceTimer = null
  }

  const token = await Storage.get<string>(Storage.DATA.ACCESS_TOKEN)
  if (!token) return

  const updatesToFlush = new Map(pendingUpdates)
  pendingUpdates.clear()

  try {
    const result = await new AniList(token).saveBulkMediaListEntries(updatesToFlush)
    reportSynced(result?.data)
    for (const id of updatesToFlush.keys()) failedAttempts.delete(id)
    // Not an unconditional remove — an edit queued mid-flight is already in
    // pendingUpdates and would lose its stored copy
    await persistPendingUpdates()
    console.log('[Background] Bulk sync completed')
  } catch (error) {
    console.error("[Background] Failed to flush updates, will retry later:", error)

    const landed = reportSynced(error instanceof AniListRequestError ? error.data : null)

    // Only a rejection of the edit itself counts. Offline, an expired token, a
    // rate limit, and AniList's outage 403 say nothing about the edit — retry.
    const isPermanentRejection =
      error instanceof AniListRequestError && (error.status === 400 || error.status === 404)

    for (const [id, data] of updatesToFlush) {
      if (landed.has(id)) {
        failedAttempts.delete(id)
        continue
      }

      if (isPermanentRejection) {
        const attempts = (failedAttempts.get(id) ?? 0) + 1
        if (attempts >= MAX_FLUSH_ATTEMPTS) {
          failedAttempts.delete(id)
          console.error(`[Background] Giving up on entry ${id} after ${attempts} attempts:`, data)
          continue
        }
        failedAttempts.set(id, attempts)
      }

      // Re-queue, letting edits that arrived during the failed request win
      pendingUpdates.set(id, { ...data, ...pendingUpdates.get(id) })
    }

    await persistPendingUpdates()
  }
}

// Pick up any updates left over from a previous service worker instance
restorePendingUpdates()

// ============================================
// Authentication
// ============================================
class Auth {
  // Set via .env.development / .env.production / .env.firefox
  static CLIENT_ID = process.env.PLASMO_PUBLIC_ANILIST_CLIENT_ID

  static async login() {
    if (!this.CLIENT_ID) {
      throw new Error(
        "Missing PLASMO_PUBLIC_ANILIST_CLIENT_ID. Copy .env.example to .env.development (or .env.production, or .env.firefox) and set your AniList client_id."
      )
    }

    const authUrl = new URL("https://anilist.co/api/v2/oauth/authorize")
    authUrl.searchParams.append("client_id", this.CLIENT_ID)
    authUrl.searchParams.append("response_type", "token")
    // Cache-bust: retrying with the identical URL after a cancelled attempt can
    // make Chrome fail launchWebAuthFlow immediately
    authUrl.searchParams.append("state", crypto.randomUUID())

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
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.id) {
        // Tabs without a content script reject; that's fine
        chrome.tabs.sendMessage(tab.id, { type: 'AUTH_CHANGED' }).catch(() => {})
      }
    })
  })

  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED' }).catch(() => {}) // popup may not be open
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handleMessage = async () => {
    switch (message.action) {
      case "QUEUE_UPDATE":
        const { entryId, progress, score, status } = message.payload

        const existing = pendingUpdates.get(entryId) || {}
        pendingUpdates.set(entryId, {
          ...existing,
          ...(progress !== undefined && { progress }),
          ...(score !== undefined && { score }),
          ...(status !== undefined && { status }),
          queuedAt: Date.now() // refreshed per edit: age-out tracks the newest change
        })
        await persistPendingUpdates()

        if (globalDebounceTimer) {
          clearTimeout(globalDebounceTimer)
        }

        globalDebounceTimer = setTimeout(() => {
          flushAllPendingUpdates()
        }, 5000)

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