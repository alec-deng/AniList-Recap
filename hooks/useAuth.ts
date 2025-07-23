import { useEffect, useState } from "react"

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "USER" }, (res) => {
      setUser(res?.user ?? null)
      setLoading(false)
    })
  }, [])

  const login = () => {
    setLoading(true)
    chrome.runtime.sendMessage({ action: "LOGIN" }, (res) => {
      setUser(res?.user ?? null)
      setLoading(false)
    })
  }

  const logout = () => {
    setLoading(true)
    chrome.runtime.sendMessage({ action: "LOGOUT" }, () => {
      setUser(null)
      setLoading(false)
    })
  }

  return { user, loading, login, logout }
}