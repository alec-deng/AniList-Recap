import React, { useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { AnimeCard } from "./AnimeCard"
import { useSettings } from "../contexts/SettingsContext"
import { useAniListData } from "../contexts/AniListDataContext"

const VIEWER_QUERY = gql`
  query {
    Viewer {
      id
      name
      avatar {
        medium
      }
    }
  }
`

const READING_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: MANGA, status: CURRENT) {
      lists {
        entries {
          media {
            id
            title {
              english
              native
              romaji
            }
            isAdult
            coverImage {
              large
            }
            chapters
          }
          progress
          score
          id
          updatedAt
          status
        }
      }
    }
  }
`

export const MangaTab: React.FC = () => {
  const {
    profileColor,
    titleLanguage,
    displayAdultContent,
    scoreFormat,
    rowOrder,
    manualCompletion,
    separateEntries
  } = useSettings()

  const {
    mangaList,
    mangaDirty,
    setMangaList,
    markMangaStatsDirty,
    clearMangaDirty
  } = useAniListData()

  const { data: viewerData, loading: viewerLoading } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error, refetch } = useQuery(READING_LIST_QUERY, {
    variables: { userId },
    skip: !userId
  })

  // Only refetch if there's no cache or it's marked dirty
  useEffect(() => {
    if (!userId) return
    if (mangaList && !mangaDirty) return
    refetch().then((res) => {
      const fetched = res.data?.MediaListCollection?.lists?.[0]?.entries ?? []
      setMangaList(fetched)
      clearMangaDirty()
    })
  }, [userId, mangaDirty])

  // Use cached list if available
  const readingList = mangaList ?? data?.MediaListCollection?.lists?.[0]?.entries ?? []

  // Early return when loading or getting an error
  if (viewerLoading || loading)
    return <div className="p-4 text-sm text-gray tracking-wide font-semibold">Loading...</div>
  if (error)
    return <div className="p-4 text-sm text-red tracking-wide font-semibold">Error loading manga list.</div>

  // Define the manga type
  type MangaEntry = {
    id: number
    title: string
    cover: string
    progress: number
    score: number
    totalChapters: number | null
    isAdult: boolean
    updatedAt: string
    mediaId: number
  }

  // Transform entries to our manga format
  const transformedManga: MangaEntry[] = readingList.map((entry: any) => ({
    id: entry.id,
    title: entry.media.title[titleLanguage.toLowerCase()],
    cover: entry.media.coverImage.large,
    progress: entry.progress,
    score: entry.score || 0,
    totalChapters: entry.media.chapters,
    isAdult: entry.media.isAdult,
    updatedAt: entry.updatedAt,
    mediaId: entry.media.id
  }))

  // Filter adult content based on settings
  const filteredManga = transformedManga.filter((manga: MangaEntry) => 
    displayAdultContent || !manga.isAdult
  )

  // Sort manga based on user preference
  const sortedManga = [...filteredManga].sort((a, b) => {
    switch (rowOrder) {
      case "score":
        return b.score - a.score || a.title.localeCompare(b.title)
      case "title":
        return a.title.localeCompare(b.title)
      case "updatedAt":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      default:
        return a.id - b.id
    }
  })

  // Separate entries if setting is enabled
  const completedManga = separateEntries
    ? sortedManga.filter(
        (manga) => manga.totalChapters && manga.progress >= manga.totalChapters
      )
    : []

  const readingManga = separateEntries
    ? sortedManga.filter((manga) => !completedManga.includes(manga))
    : sortedManga

  // Helper for Optimistic UI updates
  const updateLocalList = (entryId: number, updates: Partial<any>) => {
    if (mangaList) {
      const updated = mangaList.map(entry => 
        entry.id === entryId ? { ...entry, ...updates } : entry
      )
      setMangaList(updated)
    }
  }

  const handleProgressChange = (manga: any, newProgress: number) => {
    const maxChapters = manga.totalChapters || 9999
    const clampedProgress = Math.min(Math.max(0, newProgress), maxChapters)
    
    // Local UI Update
    updateLocalList(manga.id, { progress: clampedProgress })

    // Queue for background sync
    chrome.runtime.sendMessage({
      action: "QUEUE_UPDATE",
      payload: { entryId: manga.id, progress: clampedProgress }
    })

    // Update stats if finished and not manual completion
    if (manga.totalChapters && clampedProgress >= manga.totalChapters) {
      if (manualCompletion) {
        chrome.runtime.sendMessage({
          action: "QUEUE_UPDATE",
          payload: { entryId: manga.id, status: "CURRENT" }
        })
      } else {
        markMangaStatsDirty()
      }
    }
  }

  const handleScoreChange = (manga: any, score: number) => {
    // Local UI Update
    updateLocalList(manga.id, { score })

    // Queue for background sync
    chrome.runtime.sendMessage({
      action: "QUEUE_UPDATE",
      payload: { entryId: manga.id, score }
    })
  }

  const handleMarkCompleted = (manga: any) => {
    // Instant local removal
    if (mangaList) {
      setMangaList(mangaList.filter(item => item.id !== manga.id))
    }
    markMangaStatsDirty()

    // Queue to background
    chrome.runtime.sendMessage({
      action: "QUEUE_UPDATE",
      payload: { entryId: manga.id, status: "COMPLETED" }
    })
  }

  const renderMangaGrid = (mangaList: any[], title: string) => (
    <div className="mb-6">
      <h3 className="text-lg text-gray font-medium mb-2">
        {title} ({mangaList.length})
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {mangaList.map((manga) => (
          <AnimeCard
            key={manga.id}
            anime={manga}
            profileColor={profileColor}
            onScoreChange={(score) => handleScoreChange(manga, score)}
            onMarkCompleted={() => handleMarkCompleted(manga)}
            onProgressChange={(progress) => handleProgressChange(manga, progress)}
            loading={loading}
            scoreFormat={scoreFormat}
            manualCompletion={manualCompletion}
            displayAdultContent={displayAdultContent}
          />
        ))}
      </div>
    </div>
  )

  return (
    <div className="p-4">
      {separateEntries ? (
        <>
          {/* Show both sections only if both have entries, otherwise show only the non-empty one */}
          {readingManga.length > 0 && completedManga.length > 0 ? (
            <>
              {renderMangaGrid(readingManga, "Reading")}
              {renderMangaGrid(completedManga, "Completed")}
            </>
          ) : readingManga.length > 0 ? (
            renderMangaGrid(readingManga, "Reading")
          ) : completedManga.length > 0 ? (
            renderMangaGrid(completedManga, "Completed")
          ) : (
            renderMangaGrid([], "Reading")
          )}
        </>
      ) : (
        renderMangaGrid(sortedManga, "Reading")
      )}
    </div>
  )
}