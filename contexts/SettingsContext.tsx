// contexts/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useQuery, gql } from "@apollo/client"

const VIEWER_QUERY = gql`
  query {
    Viewer {
      id
    }
  }
`

const SETTINGS_QUERY = gql`
  query ($userId: Int) {
    User(id: $userId) {
      options {
        profileColor
        titleLanguage
        displayAdultContent
      }
    }
  }
`

interface SettingsContextType {
  profileColor: string
  titleLanguage: string
  displayAdultContent: boolean
  setProfileColor: (color: string) => void
  setTitleLanguage: (language: string) => void
  setDisplayAdultContent: (display: boolean) => void
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profileColor, setProfileColorState] = useState<string>('blue')
  const [titleLanguage, setTitleLanguageState] = useState<string>('ROMAJI')
  const [displayAdultContent, setDisplayAdultContentState] = useState<boolean>(false)

  // Get user ID first
  const { data: viewerData } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  // Get user settings
  const { data: settingsData, loading } = useQuery(SETTINGS_QUERY, {
    variables: { userId },
    skip: !userId
  })

  // Update state when settings are fetched
  useEffect(() => {
    if (settingsData?.User?.options) {
      const options = settingsData.User.options
      setProfileColorState(options.profileColor || 'blue')
      setTitleLanguageState(options.titleLanguage || 'ROMAJI')
      setDisplayAdultContentState(options.displayAdultContent || false)
    }
  }, [settingsData])

  const setProfileColor = async (color: string) => {
    setProfileColorState(color)
  }
  const setTitleLanguage = async (language: string) => {
    setTitleLanguageState(language)
  }
  const setDisplayAdultContent = async (display: boolean) => {
    setDisplayAdultContentState(display)
  }

  return (
    <SettingsContext.Provider value={{ 
      profileColor, 
      titleLanguage, 
      displayAdultContent, 
      setProfileColor,
      setTitleLanguage,
      setDisplayAdultContent,
      loading 
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}