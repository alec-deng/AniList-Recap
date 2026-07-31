import { useEffect, useState } from "react"

type StoredUser = { data?: { Viewer?: { id?: number } } }

// The background stores the Viewer at login, so the id is already local.
// Querying it instead would put a round trip in front of every request needing it.
export function useUserId() {
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const read = () =>
      chrome.storage.local.get<{ user?: StoredUser }>("user", (result) => {
        setUserId(result.user?.data?.Viewer?.id ?? null)
        setLoading(false)
      })

    read()

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
