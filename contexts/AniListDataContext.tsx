import React, { createContext, useState, useContext, useCallback, useEffect } from "react"

type ListSetter = React.Dispatch<React.SetStateAction<any[] | null>>

type AniListDataContextType = {
  animeList: any[] | null
  statsList: any[] | null
  mangaList: any[] | null
  mangaStatsList: any[] | null
  animeDirty: boolean
  statsDirty: boolean
  mangaDirty: boolean
  mangaStatsDirty: boolean
  // The subset of dirty whose *meaning* changed, not just its contents — see markAllRescaled
  animeRescaled: boolean
  statsRescaled: boolean
  mangaRescaled: boolean
  mangaStatsRescaled: boolean
  setAnimeList: ListSetter
  setStatsList: ListSetter
  setMangaList: ListSetter
  setMangaStatsList: ListSetter
  markAnimeDirty: () => void
  markStatsDirty: () => void
  markMangaDirty: () => void
  markMangaStatsDirty: () => void
  markAllRescaled: () => void
  clearAnimeDirty: () => void
  clearStatsDirty: () => void
  clearMangaDirty: () => void
  clearMangaStatsDirty: () => void
  resetData: () => void
}

const AniListDataContext = createContext<AniListDataContextType | null>(null)

export const AniListDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [animeList, setAnimeList] = useState<any[] | null>(null)
  const [statsList, setStatsList] = useState<any[] | null>(null)
  const [mangaList, setMangaList] = useState<any[] | null>(null)
  const [mangaStatsList, setMangaStatsList] = useState<any[] | null>(null)
  const [animeDirty, setAnimeDirty] = useState(false)
  const [statsDirty, setStatsDirty] = useState(false)
  const [mangaDirty, setMangaDirty] = useState(false)
  const [mangaStatsDirty, setMangaStatsDirty] = useState(false)
  const [animeRescaled, setAnimeRescaled] = useState(false)
  const [statsRescaled, setStatsRescaled] = useState(false)
  const [mangaRescaled, setMangaRescaled] = useState(false)
  const [mangaStatsRescaled, setMangaStatsRescaled] = useState(false)

  // The flag alone drives the refetch. Blanking the list too made the refetch
  // window render as an empty list — "0 / 0.00" in Stats reads as a real answer.
  const markAnimeDirty = useCallback(() => setAnimeDirty(true), [])
  const markStatsDirty = useCallback(() => setStatsDirty(true), [])
  const markMangaDirty = useCallback(() => setMangaDirty(true), [])
  const markMangaStatsDirty = useCallback(() => setMangaStatsDirty(true), [])

  // Separates the two reasons a list goes stale. Completing an entry leaves the cached copy
  // a hair out of date — one off the count — so it stays on screen and corrects itself. A
  // score format change rescales every score, so the cached copy is not slightly old but
  // wrong on its face: an 8 rendered under POINT_100. Only that gets a loading state.
  // All four at once, because that format change is the only thing that rescales anything.
  const markAllRescaled = useCallback(() => {
    setAnimeRescaled(true)
    setStatsRescaled(true)
    setMangaRescaled(true)
    setMangaStatsRescaled(true)
  }, [])
  // Corrects the optimistic updatedAt the list tab writes, with the server's real stamp
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message?.type !== "ENTRIES_SYNCED" || !Array.isArray(message.payload)) return

      const stamps = new Map<number, number>(
        message.payload.map((e: { id: number; updatedAt: number }) => [e.id, e.updatedAt])
      )

      for (const setList of [setAnimeList, setStatsList, setMangaList, setMangaStatsList]) {
        setList((list) =>
          list?.map((entry) =>
            stamps.has(entry.id) ? { ...entry, updatedAt: stamps.get(entry.id) } : entry
          ) ?? list
        )
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [])

  // Each clears its own rescale flag alongside the dirty one — the refetch it marks the end
  // of is exactly the one that brought back the rescaled values.
  const clearAnimeDirty = useCallback(() => {
    setAnimeDirty(false)
    setAnimeRescaled(false)
  }, [])
  const clearStatsDirty = useCallback(() => {
    setStatsDirty(false)
    setStatsRescaled(false)
  }, [])
  const clearMangaDirty = useCallback(() => {
    setMangaDirty(false)
    setMangaRescaled(false)
  }, [])
  const clearMangaStatsDirty = useCallback(() => {
    setMangaStatsDirty(false)
    setMangaStatsRescaled(false)
  }, [])

  // Back to the state a freshly opened popup starts in.
  const resetData = useCallback(() => {
    setAnimeList(null)
    setStatsList(null)
    setMangaList(null)
    setMangaStatsList(null)
    setAnimeDirty(false)
    setStatsDirty(false)
    setMangaDirty(false)
    setMangaStatsDirty(false)
    setAnimeRescaled(false)
    setStatsRescaled(false)
    setMangaRescaled(false)
    setMangaStatsRescaled(false)
  }, [])

  return (
    <AniListDataContext.Provider
      value={{
        animeList,
        statsList,
        mangaList,
        mangaStatsList,
        animeDirty,
        statsDirty,
        mangaDirty,
        mangaStatsDirty,
        animeRescaled,
        statsRescaled,
        mangaRescaled,
        mangaStatsRescaled,
        setAnimeList,
        setStatsList,
        setMangaList,
        setMangaStatsList,
        markAnimeDirty,
        markStatsDirty,
        markMangaDirty,
        markMangaStatsDirty,
        markAllRescaled,
        clearAnimeDirty,
        clearStatsDirty,
        clearMangaDirty,
        clearMangaStatsDirty,
        resetData
      }}
    >
      {children}
    </AniListDataContext.Provider>
  )
}

export const useAniListData = () => {
  const ctx = useContext(AniListDataContext)
  if (!ctx) throw new Error("useAniListData must be used within AniListDataProvider")
  return ctx
}