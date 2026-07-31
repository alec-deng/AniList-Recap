import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { useQuery, gql, type ApolloError } from "@apollo/client"
import { useUserId } from "../hooks/useUserId"

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

// Local-only device preference; drives the popup width too, see popup.tsx
export type GridColumns = 3 | 4

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
  gridColumns: GridColumns
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
  setGridColumns: (columns: GridColumns) => void
  loading: boolean
  error: ApolloError | undefined
}

const SettingsContext = createContext<SettingsContextType | null>(null)

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
  const [gridColumns, setGridColumnsState] = useState<GridColumns>(3)

  const { userId, loading: userIdLoading } = useUserId()

  const { data: settingsData, loading: settingsLoading, error } = useQuery(SETTINGS_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const loading = userIdLoading || settingsLoading

  // The server's answer always wins over the cache, however they interleave.
  const serverPrefsRef = useRef(false)

  useEffect(() => {
    if (settingsData?.User?.options) {
      const options = settingsData.User.options
      const mediaListOptions = settingsData.User.mediaListOptions
      const prefs = {
        profileColor: options.profileColor || 'blue',
        titleLanguage: options.titleLanguage || 'ROMAJI',
        displayAdultContent: options.displayAdultContent || false,
        scoreFormat: mediaListOptions.scoreFormat || 'POINT_10',
        rowOrder: mediaListOptions.rowOrder || 'score'
      }
      serverPrefsRef.current = true
      setProfileColorState(prefs.profileColor)
      setTitleLanguageState(prefs.titleLanguage)
      setDisplayAdultContentState(prefs.displayAdultContent)
      setScoreFormatState(prefs.scoreFormat)
      setRowOrderState(prefs.rowOrder)
      // Mirrored so the next open paints these instead of the defaults
      chrome.storage.local.set({ ...prefs, prefsUserId: userId })
    }
  }, [settingsData])

  // Stamped with the account they came from, so another user never inherits
  // them — a cached score format would render visibly wrong numbers.
  useEffect(() => {
    if (!userId) return

    chrome.storage.local.get<{
      prefsUserId?: number
      profileColor?: string
      titleLanguage?: string
      displayAdultContent?: boolean
      scoreFormat?: string
      rowOrder?: string
    }>([
      'prefsUserId',
      'profileColor',
      'titleLanguage',
      'displayAdultContent',
      'scoreFormat',
      'rowOrder'
    ], (result) => {
      if (serverPrefsRef.current || result.prefsUserId !== userId) return
      setProfileColorState(result.profileColor || 'blue')
      setTitleLanguageState(result.titleLanguage || 'ROMAJI')
      setDisplayAdultContentState(result.displayAdultContent || false)
      setScoreFormatState(result.scoreFormat || 'POINT_10')
      setRowOrderState(result.rowOrder || 'score')
    })
  }, [userId])

  useEffect(() => {
    chrome.storage.local.get<{
      manualCompletion?: boolean
      separateEntries?: boolean
      tabVisibility?: 'both' | 'anime' | 'manga'
      showAnimeStats?: boolean
      showMangaStats?: boolean
      gridColumns?: GridColumns
    }>(['manualCompletion', 'separateEntries', 'tabVisibility', 'showAnimeStats', 'showMangaStats', 'gridColumns'], (result) => {
      setManualCompletionState(result.manualCompletion || false)
      setSeparateEntriesState(result.separateEntries || false)
      setTabVisibilityState(result.tabVisibility || 'both')
      setShowAnimeStatsState(result.showAnimeStats ?? true)
      setShowMangaStatsState(result.showMangaStats ?? true)
      setGridColumnsState(result.gridColumns === 4 ? 4 : 3)
    })
  }, [])

  // These five also write through, or the cache would serve the pre-edit value
  // until the next successful settings query.
  const setProfileColor = async (color: string) => {
    setProfileColorState(color)
    chrome.storage.local.set({ profileColor: color })
  }
  const setTitleLanguage = async (language: string) => {
    setTitleLanguageState(language)
    chrome.storage.local.set({ titleLanguage: language })
  }
  const setDisplayAdultContent = async (display: boolean) => {
    setDisplayAdultContentState(display)
    chrome.storage.local.set({ displayAdultContent: display })
  }
  const setScoreFormat = async (format: string) => {
    setScoreFormatState(format)
    chrome.storage.local.set({ scoreFormat: format })
  }
  const setRowOrder = async (order: string) => {
    setRowOrderState(order)
    chrome.storage.local.set({ rowOrder: order })
  }
  const setManualCompletion = async (manual: boolean) => {
    setManualCompletionState(manual)
    chrome.storage.local.set({ manualCompletion: manual })
  }
  const setSeparateEntries = async (separate: boolean) => {
    setSeparateEntriesState(separate)
    chrome.storage.local.set({ separateEntries: separate })
  }
  const setGridColumns = async (columns: GridColumns) => {
    setGridColumnsState(columns)
    chrome.storage.local.set({ gridColumns: columns })
  }
  const setTabVisibility = async (visibility: 'both' | 'anime' | 'manga') => {
    setTabVisibilityState(visibility)
    chrome.storage.local.set({ tabVisibility: visibility })

    // A hidden tab implies its stats should default off too, but stay overridable
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
      gridColumns,
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
      setGridColumns,
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