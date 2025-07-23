import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client"
import { setContext } from "@apollo/client/link/context"

// Helper to get token from chrome.storage.local
const getToken = async (): Promise<string | null> =>
  new Promise((resolve) => {
    chrome.storage.local.get("accessToken", (result) => {
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

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
})