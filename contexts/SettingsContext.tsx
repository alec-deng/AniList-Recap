import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useQuery, gql, type ApolloError } from "@apollo/client"

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
  tabVisibility: 'both' | 'anime' | 'manga'
  showAnimeStats: boolean
  showMangaStats: boolean
  setProfileColor: (color: string) => void
  setTitleLanguage: (language: string) => void
  setDisplayAdultContent: (display: boolean) => void
  setScoreFormat: (format: string) => void
  setRowOrder: (order: string) => void
  setManualCompletion: (manual: boolean) => void
  setSeparateEntries: (separate: boolean) => void
  setTabVisibility: (visibility: 'both' | 'anime' | 'manga') => void
  setShowAnimeStats: (show: boolean) => void
  setShowMangaStats: (show: boolean) => void
  loading: boolean
  error: ApolloError | undefined
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
  const [tabVisibility, setTabVisibilityState] = useState<'both' | 'anime' | 'manga'>('both')
  const [showAnimeStats, setShowAnimeStatsState] = useState<boolean>(true)
  const [showMangaStats, setShowMangaStatsState] = useState<boolean>(true)

  // Get user ID first
  const { data: viewerData, error: viewerError } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  // Get user settings
  const { data: settingsData, loading, error: settingsError } = useQuery(SETTINGS_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const error = viewerError || settingsError

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

  // Load local-only settings once on mount
  useEffect(() => {
    chrome.storage.local.get<{
      manualCompletion?: boolean
      separateEntries?: boolean
      tabVisibility?: 'both' | 'anime' | 'manga'
      showAnimeStats?: boolean
      showMangaStats?: boolean
    }>(['manualCompletion', 'separateEntries', 'tabVisibility', 'showAnimeStats', 'showMangaStats'], (result) => {
      setManualCompletionState(result.manualCompletion || false)
      setSeparateEntriesState(result.separateEntries || false)
      setTabVisibilityState(result.tabVisibility || 'both')
      setShowAnimeStatsState(result.showAnimeStats ?? true)
      setShowMangaStatsState(result.showMangaStats ?? true)
    })
  }, [])

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
  const setTabVisibility = async (visibility: 'both' | 'anime' | 'manga') => {
    setTabVisibilityState(visibility)
    chrome.storage.local.set({ tabVisibility: visibility })

    // Default the stats visibility to match, since a hidden tab implies the
    // user isn't tracking that list — they can still re-enable it below.
    const showAnime = visibility !== 'manga'
    const showManga = visibility !== 'anime'
    setShowAnimeStatsState(showAnime)
    setShowMangaStatsState(showManga)
    chrome.storage.local.set({ showAnimeStats: showAnime, showMangaStats: showManga })
  }
  const setShowAnimeStats = async (show: boolean) => {
    setShowAnimeStatsState(show)
    chrome.storage.local.set({ showAnimeStats: show })
  }
  const setShowMangaStats = async (show: boolean) => {
    setShowMangaStatsState(show)
    chrome.storage.local.set({ showMangaStats: show })
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
      tabVisibility,
      showAnimeStats,
      showMangaStats,
      setProfileColor,
      setTitleLanguage,
      setDisplayAdultContent,
      setScoreFormat,
      setRowOrder,
      setManualCompletion,
      setSeparateEntries,
      setTabVisibility,
      setShowAnimeStats,
      setShowMangaStats,
      loading,
      error
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