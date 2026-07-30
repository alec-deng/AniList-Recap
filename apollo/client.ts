import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client"
import { setContext } from "@apollo/client/link/context"
import { onError } from "@apollo/client/link/error"

// Helper to get token from chrome.storage.local
const getToken = async (): Promise<string | null> =>
  new Promise((resolve) => {
    chrome.storage.local.get<{ accessToken?: string }>("accessToken", (result) => {
      resolve(result.accessToken ?? null)
    })
  })

const httpLink = createHttpLink({
  uri: "https://graphql.anilist.co"
})

const authLink = setContext(async (_, { headers }) => {
  const token = await getToken()
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }
})

// The background only clears a dead token while flushing the sync queue, which
// needs a queued edit to run at all — so a popup that merely opens with an
// expired token would sit on an error screen. Observing it here covers every
// operation and drops the user on LoginPage instead.
let sessionExpiryReported = false
const authErrorLink = onError(({ networkError }) => {
  const serverError = networkError as { statusCode?: number; result?: any } | null
  const bodyMessage: string | undefined = serverError?.result?.errors?.[0]?.message

  // Strictly 400 + "Invalid token". Being logged out is a 401 "Unauthorized."
  // instead, so this can't misfire behind LoginPage, where SettingsProvider's
  // Viewer query runs regardless of auth.
  if (serverError?.statusCode !== 400) return
  if (!bodyMessage?.toLowerCase().includes("invalid token")) return

  // A popup open fires several queries at once; one report is enough, and the
  // flag resets with the popup's remount
  if (sessionExpiryReported) return
  sessionExpiryReported = true
  chrome.runtime.sendMessage({ action: "SESSION_EXPIRED" }).catch(() => {})
})

export const client = new ApolloClient({
  // Error link first, so it observes failures from everything downstream. It
  // only observes — the error still reaches useQuery, so each tab's StateMessage
  // renders as before.
  link: authErrorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache()
})