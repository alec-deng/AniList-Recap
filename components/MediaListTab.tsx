import React, { useEffect, useState } from "react"
import { useQuery, gql, type DocumentNode } from "@apollo/client"
import { AnimeCard } from "./AnimeCard"
import { StateMessage } from "./StateMessage"
import { useSettings } from "../contexts/SettingsContext"
import { useAniListData } from "../contexts/AniListDataContext"
import { useStableOrder } from "../hooks/useStableOrder"
import { Loader2, AlertCircle, type LucideIcon } from "lucide-react"
import { getErrorMessage } from "../lib/apolloErrors"

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

export type MediaEntry = {
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

export type MediaListConfig = {
  type: "anime" | "manga"
  query: DocumentNode
  // media.episodes for anime, media.chapters for manga
  getTotal: (media: any) => number | null
  getNextAiringEpisode?: (media: any) => number | null
  isCaughtUp: (entry: MediaEntry) => boolean
  // Headings for the split view, plus the single heading used when
  // separateEntries is off
  sections: { pending: string; caughtUp: string; combined: string }
  loadingMessage: string
  errorMessage: string
  empty: { icon: LucideIcon; title: string; message: string }
}

// Maps the per-list slice of AniListDataContext onto one shared shape
const useListState = (type: MediaListConfig["type"]) => {
  const data = useAniListData()
  return type === "anime"
    ? {
        list: data.animeList,
        dirty: data.animeDirty,
        setList: data.setAnimeList,
        clearDirty: data.clearAnimeDirty,
        markStatsDirty: data.markStatsDirty
      }
    : {
        list: data.mangaList,
        dirty: data.mangaDirty,
        setList: data.setMangaList,
        clearDirty: data.clearMangaDirty,
        markStatsDirty: data.markMangaStatsDirty
      }
}

const queueUpdate = (payload: {
  entryId: number
  progress?: number
  score?: number
  status?: string
}) => chrome.runtime.sendMessage({ action: "QUEUE_UPDATE", payload })

export const MediaListTab: React.FC<{ config: MediaListConfig }> = ({ config }) => {
  const {
    profileColor,
    titleLanguage,
    displayAdultContent,
    scoreFormat,
    rowOrder,
    manualCompletion,
    separateEntries
  } = useSettings()

  const { list, dirty, setList, clearDirty, markStatsDirty } = useListState(config.type)

  const { data: viewerData, loading: viewerLoading, error: viewerError } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error, refetch } = useQuery(config.query, {
    variables: { userId },
    skip: !userId
  })

  // Tracks how many cards currently have the mouse over them (0 or 1 in
  // practice, but a counter avoids any enter/leave ordering glitches)
  const [hoverCount, setHoverCount] = useState(0)
  const handleHoverChange = (isHovering: boolean) =>
    setHoverCount((count) => count + (isHovering ? 1 : -1))

  // Only refetch if there's no cache or it's marked dirty
  useEffect(() => {
    if (!userId) return
    if (list && !dirty) return
    refetch().then((res) => {
      const fetched = res.data?.MediaListCollection?.lists?.[0]?.entries ?? []
      setList(fetched)
      clearDirty()
    })
  }, [userId, dirty])

  // Use cached list if available
  const rawEntries = list ?? data?.MediaListCollection?.lists?.[0]?.entries ?? []

  const entries: MediaEntry[] = rawEntries.map((entry: any) => ({
    id: entry.id,
    title: entry.media.title[titleLanguage.toLowerCase()],
    cover: entry.media.coverImage.large,
    progress: entry.progress,
    score: entry.score || 0,
    nextAiringEpisode: config.getNextAiringEpisode?.(entry.media) ?? null,
    totalEpisodes: config.getTotal(entry.media),
    isAdult: entry.media.isAdult,
    updatedAt: entry.updatedAt,
    mediaId: entry.media.id
  }))

  // Filter adult content based on settings
  const visibleEntries = entries.filter((e) => displayAdultContent || !e.isAdult)

  // Sort based on user preference
  const sorted = [...visibleEntries].sort((a, b) => {
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
  const caughtUp = separateEntries ? sorted.filter(config.isCaughtUp) : []
  const pending = separateEntries ? sorted.filter((e) => !caughtUp.includes(e)) : sorted

  // Freeze grid position while a card is hovered, so adjusting a score/
  // progress value can't re-sort a different card under the cursor mid-click
  const hovering = hoverCount > 0
  const orderedCombined = useStableOrder(sorted, hovering)
  const orderedPending = useStableOrder(pending, hovering)
  const orderedCaughtUp = useStableOrder(caughtUp, hovering)

  // Early return when loading or getting an error
  if (viewerLoading || loading)
    return <StateMessage icon={Loader2} spin message={config.loadingMessage} />
  if (viewerError || error)
    return (
      <StateMessage
        icon={AlertCircle}
        tone="error"
        message={getErrorMessage(viewerError || error, config.errorMessage)}
      />
    )

  // Helper for local UI updates
  const updateLocalList = (entryId: number, updates: Partial<any>) => {
    if (list) {
      setList(list.map((entry) => (entry.id === entryId ? { ...entry, ...updates } : entry)))
    }
  }

  const removeLocalEntry = (entryId: number) => {
    if (list) {
      setList(list.filter((item) => item.id !== entryId))
    }
    markStatsDirty()
  }

  const handleProgressChange = (entry: MediaEntry, newProgress: number) => {
    const max = entry.totalEpisodes || 9999
    const clampedProgress = Math.min(Math.max(0, newProgress), max)
    const finished = entry.totalEpisodes && clampedProgress >= entry.totalEpisodes

    if (finished && !manualCompletion) {
      // AniList completes the entry server-side once progress hits the
      // total, so remove it locally now instead of leaving a stale card
      // until the popup is closed and reopened
      removeLocalEntry(entry.id)
    } else {
      updateLocalList(entry.id, { progress: clampedProgress })
    }

    queueUpdate({ entryId: entry.id, progress: clampedProgress })

    if (finished && manualCompletion) {
      queueUpdate({ entryId: entry.id, status: "CURRENT" })
    }
  }

  const handleScoreChange = (entry: MediaEntry, score: number) => {
    updateLocalList(entry.id, { score })
    queueUpdate({ entryId: entry.id, score })
  }

  const handleMarkCompleted = (entry: MediaEntry) => {
    removeLocalEntry(entry.id)
    queueUpdate({ entryId: entry.id, status: "COMPLETED" })
  }

  const renderGrid = (items: MediaEntry[], title: string) => (
    <div className="mb-6">
      <h3 className="text-lg text-gray font-medium mb-2">
        {title} ({items.length})
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <AnimeCard
            key={item.id}
            anime={item}
            profileColor={profileColor}
            onScoreChange={(score) => handleScoreChange(item, score)}
            onMarkCompleted={() => handleMarkCompleted(item)}
            onProgressChange={(progress) => handleProgressChange(item, progress)}
            loading={loading}
            scoreFormat={scoreFormat}
            displayAdultContent={displayAdultContent}
            onHoverChange={handleHoverChange}
          />
        ))}
      </div>
    </div>
  )

  const isEmpty = separateEntries
    ? pending.length === 0 && caughtUp.length === 0
    : sorted.length === 0

  return (
    <div className="p-4 flex-1 flex flex-col">
      {isEmpty ? (
        <StateMessage
          icon={config.empty.icon}
          title={config.empty.title}
          message={config.empty.message}
        />
      ) : separateEntries ? (
        <>
          {/* Show both sections only if both have entries, otherwise show only the non-empty one */}
          {pending.length > 0 && renderGrid(orderedPending, config.sections.pending)}
          {caughtUp.length > 0 && renderGrid(orderedCaughtUp, config.sections.caughtUp)}
        </>
      ) : (
        renderGrid(orderedCombined, config.sections.combined)
      )}
    </div>
  )
}
