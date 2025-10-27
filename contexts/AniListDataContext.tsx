import React, { createContext, useState, useContext, useCallback } from "react"

type AniListDataContextType = {
  animeList: any[] | null
  statsList: any[] | null
  animeDirty: boolean
  statsDirty: boolean
  setAnimeList: (data: any[]) => void
  setStatsList: (data: any[]) => void
  markAnimeDirty: () => void
  markStatsDirty: () => void
  clearAnimeDirty: () => void
  clearStatsDirty: () => void
}

const AniListDataContext = createContext<AniListDataContextType | null>(null)

export const AniListDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [animeList, setAnimeList] = useState<any[] | null>(null)
  const [statsList, setStatsList] = useState<any[] | null>(null)
  const [animeDirty, setAnimeDirty] = useState(false)
  const [statsDirty, setStatsDirty] = useState(false)

  const markAnimeDirty = useCallback(() => {
    setAnimeList([])
    setAnimeDirty(true)
  }, [])
  const markStatsDirty = useCallback(() => {
    setStatsList([])
    setStatsDirty(true)
  }, [])
  const clearAnimeDirty = useCallback(() => setAnimeDirty(false), [])
  const clearStatsDirty = useCallback(() => setStatsDirty(false), [])

  return (
    <AniListDataContext.Provider
      value={{
        animeList,
        statsList,
        animeDirty,
        statsDirty,
        setAnimeList,
        setStatsList,
        markAnimeDirty,
        markStatsDirty,
        clearAnimeDirty,
        clearStatsDirty
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
