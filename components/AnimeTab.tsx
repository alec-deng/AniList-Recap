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

const WATCHING_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
      lists {
        entries {
          media {
            id
            title {
              english
              native
              romaji
            }
            nextAiringEpisode {
              episode
            }
            coverImage {
              large
            }
            episodes
            isAdult
          }
          progress
          score
          id
          updatedAt
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

export const AnimeTab: React.FC = () => {
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
    animeList,
    animeDirty,
    setAnimeList,
    markStatsDirty,
    clearAnimeDirty
  } = useAniListData()

  const { data: viewerData, loading: viewerLoading } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error, refetch } = useQuery(WATCHING_LIST_QUERY, {
    variables: { userId },
    skip: !userId
  })

  // Only refetch if there's no cache or it's marked dirty
  useEffect(() => {
    if (!userId) return
    if (animeList && !animeDirty) return
    refetch().then((res) => {
      const fetched = res.data?.MediaListCollection?.lists?.[0]?.entries ?? []
      setAnimeList(fetched)
      clearAnimeDirty()
    })
  }, [userId, animeDirty])

  const [updateProgress] = useMutation(UPDATE_PROGRESS_MUTATION)
  const [updateScore] = useMutation(UPDATE_SCORE_MUTATION)
  const [markCompleted] = useMutation(MARK_COMPLETED_MUTATION)
  const [keepCurrent] = useMutation(KEEP_CURRENT_MUTATION)

  // Use cached list if available
  const watchingList = animeList ?? data?.MediaListCollection?.lists?.[0]?.entries ?? []

  // Early return when loading or getting an error
  if (viewerLoading || loading)
    return <div className="p-4 text-sm text-gray tracking-wide font-semibold">Loading...</div>
  if (error)
    return <div className="p-4 text-sm text-red tracking-wide font-semibold">Error loading anime list.</div>

  // Define the anime type
  type AnimeEntry = {
    id: number
    title: string
    cover: string
    progress: number
    score: number
    nextAiringEpisode: number | null
    totalEpisodes: number | null
    isAdult: boolean
    updatedAt: string
    mediaId: number
  }

  
  // Transform entries to our anime format
  const transformedAnime: AnimeEntry[] = watchingList.map((entry: any) => ({
    id: entry.id,
    title: entry.media.title[titleLanguage.toLowerCase()],
    cover: entry.media.coverImage.large,
    progress: entry.progress,
    score: entry.score || 0,
    nextAiringEpisode: entry.media.nextAiringEpisode?.episode || null,
    totalEpisodes: entry.media.episodes,
    isAdult: entry.media.isAdult,
    updatedAt: entry.updatedAt,
    mediaId: entry.media.id
  }))

  // Filter adult content based on settings
  const filteredAnime = transformedAnime.filter((anime: AnimeEntry) => 
    displayAdultContent || !anime.isAdult
  )

  // Sort anime based on user preference
  const sortedAnime = [...filteredAnime].sort((a, b) => {
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
  const caughtUpAnime = separateEntries
    ? sortedAnime.filter(
        (anime) =>
          (anime.totalEpisodes && anime.progress === anime.totalEpisodes) ||
          (anime.nextAiringEpisode && anime.progress >= anime.nextAiringEpisode - 1)
      )
    : []

  const behindAnime = separateEntries
    ? sortedAnime.filter((anime) => !caughtUpAnime.includes(anime))
    : sortedAnime

  // Handle manual progress change
  const handleProgressChange = async (anime: any, newProgress: number) => {
    const maxEpisodes = anime.totalEpisodes || 999
    const clampedProgress = Math.min(Math.max(0, newProgress), maxEpisodes)
    await updateProgress({ variables: { id: anime.id, progress: clampedProgress } })

    // Update stats if finished and not manual completion
    if (anime.totalEpisodes && clampedProgress >= anime.totalEpisodes) {
      if (manualCompletion) {
        await keepCurrent({ variables: { id: anime.id, progress: clampedProgress } })
      } else {
        markStatsDirty()
      }
    }
    
    refetch().then((res) => setAnimeList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
  }

  const handleScoreChange = async (anime: any, score: number) => {
    await updateScore({ variables: { id: anime.id, score } })
    refetch().then((res) => setAnimeList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
  }

  const handleMarkCompleted = async (anime: any) => {
    await markCompleted({ variables: { id: anime.id } })
    markStatsDirty()
    refetch().then((res) => setAnimeList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? []))
  }

  const renderAnimeGrid = (animeList: any[], title: string) => (
    <div className="mb-6">
      <h3 className="text-lg text-gray font-medium mb-2">
        {title} ({animeList.length})
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {animeList.map((anime) => (
          <AnimeCard
            key={anime.id}
            anime={anime}
            profileColor={profileColor}
            onScoreChange={(score) => handleScoreChange(anime, score)}
            onMarkCompleted={() => handleMarkCompleted(anime)}
            onProgressChange={(progress) => handleProgressChange(anime, progress)}
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
          {renderAnimeGrid(behindAnime, "Behind")}
          {renderAnimeGrid(caughtUpAnime, "Caught-Up")}
        </>
      ) : (
        renderAnimeGrid(sortedAnime, "Watching")
      )}
    </div>
  )
}