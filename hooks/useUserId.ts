import { useEffect, useState } from "react"

type StoredUser = { data?: { Viewer?: { id?: number } } }

// Held for the life of the popup document so a tab switch remounts with the id
// already in hand. Reading storage on every mount meant every switch rendered
// StateMessage for a tick, which briefly shortened the page — long enough for
// Chrome to drop the scrollbar and resize the window sideways. A popup open is
// a fresh JS context, so this can never go stale across opens.
let cachedUserId: number | null = null
let hasRead = false

// The background stores the Viewer at login, so the id is already local.
// Querying it instead would put a round trip in front of every request needing it.
export function useUserId() {
  const [userId, setUserId] = useState<number | null>(cachedUserId)
  const [loading, setLoading] = useState(!hasRead)

  useEffect(() => {
    const read = () =>
      chrome.storage.local.get<{ user?: StoredUser }>("user", (result) => {
        cachedUserId = result.user?.data?.Viewer?.id ?? null
        hasRead = true
        setUserId(cachedUserId)
        setLoading(false)
      })

    if (!hasRead) read()

    // The providers outlive a logout, so re-read rather than hold the old id.
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.user) read()
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => chrome.storage.onChanged.removeListener(handleChange)
  }, [])

  return { userId, loading }
}
