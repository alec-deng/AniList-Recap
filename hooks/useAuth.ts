import { useEffect, useState } from "react"

interface User {
  data: {
    Viewer: {
      id: number
      name: string
      avatar: {
        medium: string
      }
    }
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Function to check auth status
  const checkAuthStatus = () => {
    chrome.runtime.sendMessage({ action: "CHECK_AUTH" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('Error checking auth:', chrome.runtime.lastError)
        setUser(null)
        setAccessToken(null)
        setLoading(false)
        return
      }

      setUser(res?.user ?? null)
      setAccessToken(res?.token ?? null)
      setLoading(false)
    })
  }

  useEffect(() => {
    // Initial auth check
    checkAuthStatus()

    // Listen for auth changes from background script
    const handleMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (message.type === 'AUTH_CHANGED') {
        console.log('[useAuth] Auth changed message received, updating state')
        checkAuthStatus()
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  const login = () => {
    setLoading(true)
    chrome.runtime.sendMessage({ action: "LOGIN" }, (res) => {
      if (chrome.runtime.lastError) {
        console.error('Login error:', chrome.runtime.lastError)
        setLoading(false)
        return
      }

      setUser(res?.user ?? null)
      setLoading(false)
      // Note: accessToken will be updated via the AUTH_CHANGED message
    })
  }

  const logout = () => {
    setLoading(true)
    chrome.runtime.sendMessage({ action: "LOGOUT" }, () => {
      if (chrome.runtime.lastError) {
        console.error('Logout error:', chrome.runtime.lastError)
        setLoading(false)
        return
      }

      setUser(null)
      setAccessToken(null)
      setLoading(false)
    })
  }

  return { user, loading, login, logout, accessToken }
}