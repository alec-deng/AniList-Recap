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
      mediaListOptions {
        scoreFormat
        rowOrder
      }
    }
  }
`

interface SettingsContextType {
  profileColor: string
  titleLanguage: string
  displayAdultContent: boolean
  scoreFormat: string
  rowOrder: string
  manualCompletion: boolean
  separateEntries: boolean
  setProfileColor: (color: string) => void
  setTitleLanguage: (language: string) => void
  setDisplayAdultContent: (display: boolean) => void
  setScoreFormat: (format: string) => void
  setRowOrder: (order: string) => void
  setManualCompletion: (manual: boolean) => void
  setSeparateEntries: (separate: boolean) => void
  loading: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

// Color mapping function
const getColorValue = (color: string): string => {
  const colorMap: { [key: string]: string } = {
    'pink': '#e85fb2',
    'blue': '#3db4f2',
    'purple': '#b368e6',
    'green': '#4abd4e',
    'orange': '#ef881a',
    'red': '#e13333',
    'gray': '#677b94',
  }
  return colorMap[color] || color
}

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [profileColor, setProfileColorState] = useState<string>('blue')
  const [titleLanguage, setTitleLanguageState] = useState<string>('ROMAJI')
  const [displayAdultContent, setDisplayAdultContentState] = useState<boolean>(false)
  const [scoreFormat, setScoreFormatState] = useState<string>('POINT_10')
  const [rowOrder, setRowOrderState] = useState<string>('score')
  const [manualCompletion, setManualCompletionState] = useState<boolean>(false)
  const [separateEntries, setSeparateEntriesState] = useState<boolean>(false)

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
      const mediaListOptions = settingsData.User.mediaListOptions
      setProfileColorState(options.profileColor || 'blue')
      setTitleLanguageState(options.titleLanguage || 'ROMAJI')
      setDisplayAdultContentState(options.displayAdultContent || false)
      setScoreFormatState(mediaListOptions.scoreFormat || 'POINT_10')
      setRowOrderState(mediaListOptions.rowOrder || 'score')
    }
  }, [settingsData])

  const localSettings = new Promise((resolve => {
    chrome.storage.local.get(['manualCompletion', 'separateEntries'], (result) => {
      setManualCompletionState(result.manualCompletion || false)
      setSeparateEntriesState(result.separateEntries || false)
      resolve(true)
    })
  }))

  const setProfileColor = async (color: string) => {
    setProfileColorState(color)
  }
  const setTitleLanguage = async (language: string) => {
    setTitleLanguageState(language)
  }
  const setDisplayAdultContent = async (display: boolean) => {
    setDisplayAdultContentState(display)
  }
  const setScoreFormat = async (format: string) => {
    setScoreFormatState(format)
  }
  const setRowOrder = async (order: string) => {
    setRowOrderState(order)
  }
  const setManualCompletion = async (manual: boolean) => {
    setManualCompletionState(manual)
    chrome.storage.local.set({ manualCompletion: manual })
  }
  const setSeparateEntries = async (separate: boolean) => {
    setSeparateEntriesState(separate)
    chrome.storage.local.set({ separateEntries: separate })
  }

  return (
    <SettingsContext.Provider value={{ 
      profileColor: getColorValue(profileColor), // Return the mapped hex color
      titleLanguage,
      displayAdultContent,
      scoreFormat,
      rowOrder,
      manualCompletion,
      separateEntries,
      setProfileColor,
      setTitleLanguage,
      setDisplayAdultContent,
      setScoreFormat,
      setRowOrder,
      setManualCompletion,
      setSeparateEntries,
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