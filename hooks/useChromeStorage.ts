import { useEffect, useState } from "react"

export function useChromeStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)
  useEffect(() => {
    chrome.storage.local.get(key, (result) => {
      setValue(result[key] ?? defaultValue)
    })
    const listener = (changes: any, area: string) => {
      if (area === "local" && changes[key]) {
        setValue(changes[key].newValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [key])
  return [value, setValue] as const
}