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
  setAnimeList: ListSetter
  setStatsList: ListSetter
  setMangaList: ListSetter
  setMangaStatsList: ListSetter
  markAnimeDirty: () => void
  markStatsDirty: () => void
  markMangaDirty: () => void
  markMangaStatsDirty: () => void
  clearAnimeDirty: () => void
  clearStatsDirty: () => void
  clearMangaDirty: () => void
  clearMangaStatsDirty: () => void
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

  const markAnimeDirty = useCallback(() => {
    setAnimeList([])
    setAnimeDirty(true)
  }, [])
  const markStatsDirty = useCallback(() => {
    setStatsList([])
    setStatsDirty(true)
  }, [])
  const markMangaDirty = useCallback(() => {
    setMangaList([])
    setMangaDirty(true)
  }, [])
  const markMangaStatsDirty = useCallback(() => {
    setMangaStatsList([])
    setMangaStatsDirty(true)
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

  const clearAnimeDirty = useCallback(() => setAnimeDirty(false), [])
  const clearStatsDirty = useCallback(() => setStatsDirty(false), [])
  const clearMangaDirty = useCallback(() => setMangaDirty(false), [])
  const clearMangaStatsDirty = useCallback(() => setMangaStatsDirty(false), [])

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
        setAnimeList,
        setStatsList,
        setMangaList,
        setMangaStatsList,
        markAnimeDirty,
        markStatsDirty,
        markMangaDirty,
        markMangaStatsDirty,
        clearAnimeDirty,
        clearStatsDirty,
        clearMangaDirty,
        clearMangaStatsDirty
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