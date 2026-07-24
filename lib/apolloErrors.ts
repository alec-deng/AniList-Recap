import type { ApolloError } from "@apollo/client"

// AniList returns a plain (non-GraphQL-shaped) body for these failure modes,
// so Apollo surfaces them as a network-level ServerError/TypeError rather
// than a GraphQLError — inspect networkError to tell them apart.
export function getErrorMessage(error: ApolloError | undefined, fallback: string): string {
  const networkError = error?.networkError as any
  const statusCode = networkError?.statusCode

  if (statusCode === 429) {
    return "AniList's API rate limit has been reached. Please wait a moment and try again."
  }

  if (statusCode === 403) {
    // AniList returns 403 with a GraphQL-shaped body (status >= 300 makes
    // Apollo treat it as a ServerError, so the message lives in .result, not
    // graphQLErrors) both for outages and for actual permission failures —
    // only match the known outage wording so we don't misreport the latter.
    const bodyMessage: string | undefined = networkError?.result?.errors?.[0]?.message
    if (bodyMessage?.toLowerCase().includes("temporarily disabled")) {
      return "AniList's API is temporarily disabled due to stability issues on their end. Check their Discord for updates, or try again later."
    }
    return fallback
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return "AniList's servers appear to be down. Please try again later."
  }

  if (networkError && statusCode === undefined) {
    // The request never got a response at all — offline, DNS failure, or
    // AniList unreachable. No statusCode means the fetch itself failed.
    const offline = typeof navigator !== "undefined" && navigator.onLine === false
    return offline
      ? "You appear to be offline. Check your internet connection and try again."
      : "Unable to reach AniList. Their service may be down — please try again later."
  }

  return fallback
}
