import React, { useEffect } from "react"
import { useQuery, useMutation, gql } from "@apollo/client"
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

const UPDATE_PROGRESS_MUTATION = gql`
  mutation ($id: Int!, $progress: Int!) {
    SaveMediaListEntry(id: $id, progress: $progress) {
      id
      progress
    }
  }
`

const UPDATE_SCORE_MUTATION = gql`
  mutation ($id: Int!, $score: Float!) {
    SaveMediaListEntry(id: $id, score: $score) {
      id
      score
    }
  }
`

const MARK_COMPLETED_MUTATION = gql`
  mutation ($id: Int!) {
    SaveMediaListEntry(id: $id, status: COMPLETED) {
      id
      status
    }
  }
`

const KEEP_CURRENT_MUTATION = gql`
  mutation ($id: Int!, $progress: Int!) {
    SaveMediaListEntry(id: $id, progress: $progress, status: CURRENT) {
      id
      progress
      status
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

  const [updateProgress] = useMutation(UPDATE_PROGRESS_MUTATION)
  const [updateScore] = useMutation(UPDATE_SCORE_MUTATION)
  const [markCompleted] = useMutation(MARK_COMPLETED_MUTATION)
  const [keepCurrent] = useMutation(KEEP_CURRENT_MUTATION)

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
    totalEpisodes: number | null
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
    totalEpisodes: entry.media.chapters,
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
        (manga) =>
          manga.totalEpisodes && manga.progress >= manga.totalEpisodes
      )
    : []

  const readingManga = separateEntries
    ? sortedManga.filter((manga) => !completedManga.includes(manga))
    : sortedManga

  // Handle manual progress change
  const handleProgressChange = async (manga: any, newProgress: number) => {
    const maxChapters = manga.totalEpisodes || 999
    const clampedProgress = Math.min(Math.max(0, newProgress), maxChapters)
    await updateProgress({ variables: { id: manga.id, progress: clampedProgress } })

    // Update stats if finished and not manual completion
    if (manga.totalEpisodes && clampedProgress >= manga.totalEpisodes) {
      if (manualCompletion) {
        await keepCurrent({ variables: { id: manga.id, progress: clampedProgress } })
      } else {
        markMangaStatsDirty()
      }
    }
    
    refetch().then((res) => setMangaList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
  }

  const handleScoreChange = async (manga: any, score: number) => {
    await updateScore({ variables: { id: manga.id, score } })
    refetch().then((res) => setMangaList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
  }

  const handleMarkCompleted = async (manga: any) => {
    await markCompleted({ variables: { id: manga.id } })
    markMangaStatsDirty()
    refetch().then((res) => setMangaList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
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