import React, { useEffect, useRef, useState } from "react"
import { useQuery, gql, type DocumentNode } from "@apollo/client"
import { MediaCard } from "./MediaCard"
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
  // AniList sends this as an Int of unix *seconds*
  updatedAt: number
  mediaId: number
}

export type MediaListConfig = {
  type: "anime" | "manga"
  query: DocumentNode
  // media.episodes for anime, media.chapters for manga
  getTotal: (media: any) => number | null
  getNextAiringEpisode?: (media: any) => number | null
  isCaughtUp: (entry: MediaEntry) => boolean
  sections: { pending: string; caughtUp: string; combined: string }
  loadingMessage: string
  errorMessage: string
  empty: { icon: LucideIcon; title: string; message: string }
}

// Ceilings on the matching animation.css durations — a longer CSS transition
// is simply cut off, since the next phase's class carries none of its own.
const HIDE_BEFORE_REORDER_MS = 100 // .card-leaving, before the grid reorders
const REMOVE_FADE_MS = 100 // .card-removing, before the entry is dropped
const SETTLE_TOTAL_MS = 400 // .card-settling fade + its delayed drop

type Category = "pending" | "caughtUp"
type AnimPhase = "leaving" | "entering" | "settling"

// Captured every render for the animation timers to read without re-subscribing
type Snapshot = {
  separateEntries: boolean
  ids: Set<number>
  frozenCategories: Map<number, Category>
  liveCategories: Map<number, Category>
  rendered: Record<"pending" | "caughtUp" | "combined", MediaEntry[]>
  live: Record<"pending" | "caughtUp" | "combined", MediaEntry[]>
}

const indexOfEntry = (items: MediaEntry[], entryId: number) =>
  items.findIndex((item) => item.id === entryId)

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

  // The card the pointer is on, not just whether one is hovered: leaving it for
  // a neighbour ends the interaction just as leaving the grid does.
  const [hoveredId, setHoveredId] = useState<number | null>(null)
  const handleHoverChange = (id: number, isHovering: boolean) =>
    setHoveredId((cur) => (isHovering ? id : cur === id ? null : cur))

  // Grid order + section split, frozen from hover through the reorder — else
  // an edit's own re-sort would yank a card out from under the cursor.
  const [holdOrder, setHoldOrder] = useState(false)

  // The one card allowed to animate a *move*, and which phase it is in
  const [anim, setAnim] = useState<{ id: number; phase: AnimPhase } | null>(null)

  // A set, since a bulk completion pass can have several fades in flight
  const [removingIds, setRemovingIds] = useState<Set<number>>(new Set())

  // A finished-but-still-onscreen entry, removed only once the interaction
  // ends — recomputed every commit, so dropping below the total cancels it.
  const pendingRemovalRef = useRef<number | null>(null)

  // The entry last edited, cleared at the end of every interaction so the
  // animation privilege never carries to the next one.
  const touchedRef = useRef<number | null>(null)

  const snapshotRef = useRef<Snapshot | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const framesRef = useRef<number[]>([])

  // Once started, a choreography always runs to completion — cancelling on
  // re-hover used to cut it short almost every time in a popup this dense.
  const animatingRef = useRef(false)
  // An interaction that ended while the previous one was still playing
  const wantsEndRef = useRef(false)
  // Fades in flight, tracked synchronously alongside the removingIds state
  const removingCountRef = useRef(0)

  const hoveredIdRef = useRef<number | null>(null)
  hoveredIdRef.current = hoveredId
  const holdOrderRef = useRef(false)
  holdOrderRef.current = holdOrder

  const clearScheduled = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    framesRef.current.forEach(cancelAnimationFrame)
    framesRef.current = []
  }
  const schedule = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms))
  }

  // Refetch only when dirty — the hook's own result is already in flight on a
  // cold load, so calling refetch() too would double the request.
  useEffect(() => {
    if (!userId) return
    if (list && !dirty) return

    if (dirty) {
      refetch().then((res) => {
        setList(res.data?.MediaListCollection?.lists?.[0]?.entries ?? [])
        clearDirty()
      })
    } else if (data) {
      setList(data.MediaListCollection?.lists?.[0]?.entries ?? [])
    }
  }, [userId, dirty, data])

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

  const visibleEntries = entries.filter((e) => displayAdultContent || !e.isAdult)

  const sorted = [...visibleEntries].sort((a, b) => {
    switch (rowOrder) {
      case "score":
        return b.score - a.score || a.title.localeCompare(b.title)
      case "title":
        return a.title.localeCompare(b.title)
      case "updatedAt":
        // Unix seconds — new Date(n) would misread them as ms
        return Number(b.updatedAt) - Number(a.updatedAt)
      default:
        return b.id - a.id // "Last Added": ids increase over time
    }
  })

  const categoryOf = (entry: MediaEntry): Category =>
    config.isCaughtUp(entry) ? "caughtUp" : "pending"

  const liveCategories = new Map<number, Category>(sorted.map((e) => [e.id, categoryOf(e)]))

  // Frozen alongside the order, or bumping progress to the newest episode
  // relocates the hovered card between sections mid-click.
  const frozenCategoriesRef = useRef<Map<number, Category>>(liveCategories)
  if (!holdOrder) frozenCategoriesRef.current = liveCategories

  const effectiveCategory = (entry: MediaEntry): Category =>
    (holdOrder ? frozenCategoriesRef.current.get(entry.id) : undefined) ?? categoryOf(entry)

  const caughtUp = separateEntries ? sorted.filter((e) => effectiveCategory(e) === "caughtUp") : []
  const pending = separateEntries ? sorted.filter((e) => effectiveCategory(e) === "pending") : sorted

  // The same split released — the comparison target for "did this card move?"
  const liveCaughtUp = separateEntries ? sorted.filter((e) => categoryOf(e) === "caughtUp") : []
  const livePending = separateEntries ? sorted.filter((e) => categoryOf(e) === "pending") : sorted

  const orderedCombined = useStableOrder(sorted, holdOrder)
  const orderedPending = useStableOrder(pending, holdOrder)
  const orderedCaughtUp = useStableOrder(caughtUp, holdOrder)

  snapshotRef.current = {
    separateEntries,
    ids: new Set(sorted.map((e) => e.id)),
    frozenCategories: frozenCategoriesRef.current,
    liveCategories,
    rendered: { pending: orderedPending, caughtUp: orderedCaughtUp, combined: orderedCombined },
    live: { pending: livePending, caughtUp: liveCaughtUp, combined: sorted }
  }

  // "Did this card's index within its own rendered section change" — not
  // "did something change".
  const willEntryMove = (entryId: number, snap: Snapshot): boolean => {
    if (pendingRemovalRef.current === entryId) return true // leaving either way
    if (!snap.ids.has(entryId)) return false

    if (!snap.separateEntries) {
      // One combined grid: becoming caught up changes no placement
      return (
        indexOfEntry(snap.rendered.combined, entryId) !== indexOfEntry(snap.live.combined, entryId)
      )
    }

    const live = snap.liveCategories.get(entryId)
    const frozen = snap.frozenCategories.get(entryId) ?? live
    if (frozen !== live) return true

    // Compared within the rendered grid, not the combined list
    const section = frozen === "caughtUp" ? "caughtUp" : "pending"
    return (
      indexOfEntry(snap.rendered[section], entryId) !== indexOfEntry(snap.live[section], entryId)
    )
  }

  const releaseOrder = () => {
    const removalId = pendingRemovalRef.current
    if (removalId !== null) {
      pendingRemovalRef.current = null
      setList((prev) => prev?.filter((item) => item.id !== removalId) ?? prev)
      markStatsDirty()
    }
    setHoldOrder(false)
  }
  const releaseOrderRef = useRef(releaseOrder)
  releaseOrderRef.current = releaseOrder

  // A commit later, not the same batch — release+refreeze together would leave
  // useStableOrder never seeing the unfrozen render, pinning the pre-reorder order.
  const scheduleRefreeze = () => {
    framesRef.current.push(
      requestAnimationFrame(() => {
        if (hoveredIdRef.current !== null) setHoldOrder(true)
      })
    )
  }

  // Fades a card out, then drops it — shared by both routes off a list
  const startRemoval = (entryId: number) => {
    setRemovingIds((cur) => new Set(cur).add(entryId))
    removingCountRef.current += 1

    schedule(() => {
      setList((prev) => prev?.filter((item) => item.id !== entryId) ?? prev)
      setRemovingIds((cur) => {
        const next = new Set(cur)
        next.delete(entryId)
        return next
      })
      markStatsDirty()

      // pointer-events: none fires mouseleave at once, so without this the
      // freeze would release mid-fade. A choreography-driven removal skips
      // this — that path releases on its own schedule.
      removingCountRef.current -= 1
      if (removingCountRef.current === 0 && !animatingRef.current) {
        releaseOrderRef.current()
        scheduleRefreeze()
        finishChoreography()
      }
    }, REMOVE_FADE_MS)
  }
  const startRemovalRef = useRef(startRemoval)
  startRemovalRef.current = startRemoval

  const finishChoreography = () => {
    animatingRef.current = false
    if (wantsEndRef.current) {
      wantsEndRef.current = false
      endInteractionRef.current()
    }
  }

  const endInteraction = () => {
    const snap = snapshotRef.current
    const touched = touchedRef.current
    touchedRef.current = null

    const moving = touched !== null && !!snap && willEntryMove(touched, snap)

    if (touched === null || !snap || !moving) {
      releaseOrderRef.current()
      scheduleRefreeze()
      return
    }

    // Finished by reaching its total: leaving, not moving — same fade as the button
    if (pendingRemovalRef.current === touched) {
      pendingRemovalRef.current = null
      animatingRef.current = true
      startRemovalRef.current(touched)

      schedule(() => {
        releaseOrderRef.current()
        scheduleRefreeze()
        finishChoreography()
      }, REMOVE_FADE_MS)
      return
    }

    animatingRef.current = true
    setAnim({ id: touched, phase: "leaving" })

    schedule(() => {
      releaseOrderRef.current()
      scheduleRefreeze()
      setAnim({ id: touched, phase: "entering" })

      // A frame after "entering", or the browser coalesces the two and nothing
      // transitions. Each step only advances its own card's expected phase, so
      // a stale frame can't clobber a newer interaction.
      framesRef.current.push(
        requestAnimationFrame(() => {
          framesRef.current.push(
            requestAnimationFrame(() =>
              setAnim((cur) =>
                cur?.id === touched && cur.phase === "entering"
                  ? { id: touched, phase: "settling" }
                  : cur
              )
            )
          )
        })
      )

      schedule(() => {
        setAnim((cur) => (cur?.id === touched ? null : cur))
        finishChoreography()
      }, SETTLE_TOTAL_MS)
    }, HIDE_BEFORE_REORDER_MS)
  }
  const endInteractionRef = useRef(endInteraction)
  endInteractionRef.current = endInteraction

  useEffect(() => {
    // Only freezing happens here — releaseOrder() alone decides when to
    // release, so the freeze outlives the pointer leaving, through the animation.
    if (hoveredId !== null) setHoldOrder(true)

    const touched = touchedRef.current

    if (touched !== null && hoveredId === touched) {
      wantsEndRef.current = false // still on the edited card
      return
    }
    if (touched === null && pendingRemovalRef.current === null && !holdOrderRef.current) return

    // Left the grid or moved to a different card — ends the interaction
    // immediately, with no grace period: a real accidental slip off a card's
    // edge lasts longer than any window short enough to not cost latency.
    if (animatingRef.current || removingCountRef.current > 0) {
      wantsEndRef.current = true // hand off to whatever is still playing
      return
    }

    endInteractionRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId])

  // A tab switch or popup close never fires mouseleave
  useEffect(() => {
    return () => {
      clearScheduled()
      const removalId = pendingRemovalRef.current
      if (removalId !== null) {
        pendingRemovalRef.current = null
        setList((prev) => prev?.filter((item) => item.id !== removalId) ?? prev)
        markStatsDirty()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Predicts updatedAt so "Last Updated" isn't stale all session; the
  // background reconciles it with the server's real value after the flush.
  const updateLocalList = (entryId: number, updates: Partial<any>) => {
    setList(
      (prev) =>
        prev?.map((entry) =>
          entry.id === entryId
            ? { ...entry, ...updates, updatedAt: Math.floor(Date.now() / 1000) }
            : entry
        ) ?? prev
    )
  }

  const handleProgressChange = (entry: MediaEntry, newProgress: number) => {
    // Cap to whichever is lower: totalEpisodes or aired-so-far (nextAiringEpisode - 1)
    const airedEpisodes = entry.nextAiringEpisode ? entry.nextAiringEpisode - 1 : null
    const episodeCaps = [entry.totalEpisodes, airedEpisodes].filter(
      (v): v is number => v !== null
    )
    const max = episodeCaps.length ? Math.min(...episodeCaps) : 9999
    const clampedProgress = Math.min(Math.max(0, newProgress), max)
    const finished = Boolean(entry.totalEpisodes && clampedProgress >= entry.totalEpisodes)

    touchedRef.current = entry.id

    if (finished && !manualCompletion) {
      pendingRemovalRef.current = entry.id
    } else if (pendingRemovalRef.current === entry.id) {
      pendingRemovalRef.current = null
    }

    updateLocalList(entry.id, { progress: clampedProgress })
    queueUpdate({ entryId: entry.id, progress: clampedProgress })

    if (finished && manualCompletion) {
      queueUpdate({ entryId: entry.id, status: "CURRENT" })
    }
  }

  const handleScoreChange = (entry: MediaEntry, score: number) => {
    touchedRef.current = entry.id
    updateLocalList(entry.id, { score })
    queueUpdate({ entryId: entry.id, score })
  }

  // Built for clearing a season in one pass, so it writes through immediately
  // rather than deferring to end-of-interaction like a progress edit does.
  const handleMarkCompleted = (entry: MediaEntry) => {
    // Drop any deferral already accrued, e.g. from stepping progress to the total
    if (touchedRef.current === entry.id) touchedRef.current = null
    if (pendingRemovalRef.current === entry.id) pendingRemovalRef.current = null

    // Freeze stays on: useStableOrder drops the gone entry while holding the
    // rest still, so later cards shift up by one instead of a full re-sort.
    startRemoval(entry.id)
    queueUpdate({ entryId: entry.id, status: "COMPLETED" })
  }

  const renderGrid = (items: MediaEntry[], title: string) => (
    <div className="mb-6">
      <h3 className="text-lg text-gray font-medium mb-2">
        {title} ({items.length})
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          // Wrapper carries the animation class; removal wins over a move
          <div
            key={item.id}
            className={
              removingIds.has(item.id)
                ? "card-removing"
                : anim?.id === item.id
                  ? `card-${anim.phase}`
                  : undefined
            }
          >
            <MediaCard
              anime={item}
              profileColor={profileColor}
              onScoreChange={(score) => handleScoreChange(item, score)}
              onMarkCompleted={() => handleMarkCompleted(item)}
              onProgressChange={(progress) => handleProgressChange(item, progress)}
              loading={loading}
              scoreFormat={scoreFormat}
              displayAdultContent={displayAdultContent}
              onHoverChange={(hovering) => handleHoverChange(item.id, hovering)}
            />
          </div>
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
          {pending.length > 0 && renderGrid(orderedPending, config.sections.pending)}
          {caughtUp.length > 0 && renderGrid(orderedCaughtUp, config.sections.caughtUp)}
        </>
      ) : (
        renderGrid(orderedCombined, config.sections.combined)
      )}
    </div>
  )
}
