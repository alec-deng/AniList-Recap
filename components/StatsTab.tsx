import React, { useMemo, useState, useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { useAniListData } from "../contexts/AniListDataContext"
import { ScoreChart } from "./ScoreChart"
import { CustomSelect } from "./CustomSelect"
import { MonitorCheck, BookOpen, Percent } from "lucide-react"
import CancelIcon from "@mui/icons-material/Cancel"
import * as Slider from "@radix-ui/react-slider"

const COMPLETED_ANIME_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME) {
      lists {
        entries {
          media {
            season
            seasonYear
            isAdult
            title {
              romaji
            }
          }
          score
        }
      }
    }
  }
`

const COMPLETED_MANGA_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: MANGA) {
      lists {
        entries {
          media {
            isAdult
            title {
              romaji
            }
          }
          score
        }
      }
    }
  }
`

const VIEWER_QUERY = gql`
  query {
    Viewer {
      id
    }
  }
`

export const StatsTab: React.FC = () => {
  const {
    profileColor,
    displayAdultContent,
    scoreFormat
  } = useSettings()

  const {
    statsList,
    statsDirty,
    setStatsList,
    clearStatsDirty,
    mangaStatsList,
    mangaStatsDirty,
    setMangaStatsList,
    clearMangaStatsDirty
  } = useAniListData()

  const [year, setYear] = useState<number | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [season, setSeason] = useState<string>("All")
  const [isSliderActive, setIsSliderActive] = useState(false)

  const { data: viewerData, loading: viewerLoading } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { loading: animeLoading, error: animeError, refetch: refetchAnime } = useQuery(COMPLETED_ANIME_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const { loading: mangaLoading, error: mangaError, refetch: refetchManga } = useQuery(COMPLETED_MANGA_QUERY, {
    variables: { userId },
    skip: !userId
  })

  // Fetch anime only if not cached or dirty
  useEffect(() => {
    if (!userId) return
    if (statsList && !statsDirty) return
    refetchAnime().then(res => {
      // Flatten all entries from all lists (CURRENT, COMPLETED, etc.)
      const allLists = res.data?.MediaListCollection?.lists ?? []
      const allEntries = allLists.flatMap((list: any) => list.entries ?? [])
      // Filter to only include entries with scores
      const scoredEntries = allEntries.filter((entry: any) => entry.score > 0)
      setStatsList(scoredEntries)
      clearStatsDirty()
    })
  }, [userId, statsDirty])

  // Fetch manga only if not cached or dirty
  useEffect(() => {
    if (!userId) return
    if (mangaStatsList && !mangaStatsDirty) return
    refetchManga().then(res => {
      // Flatten all entries from all lists (CURRENT, COMPLETED, etc.)
      const allLists = res.data?.MediaListCollection?.lists ?? []
      const allEntries = allLists.flatMap((list: any) => list.entries ?? [])
      // Filter to only include entries with scores
      const scoredEntries = allEntries.filter((entry: any) => entry.score > 0)
      setMangaStatsList(scoredEntries)
      clearMangaStatsDirty()
    })
  }, [userId, mangaStatsDirty])

  const animeEntries = statsList ?? []
  const mangaEntries = mangaStatsList ?? []

  // Anime score distribution
  const animeAllScores = useMemo(() => {
    const scores: Record<number, boolean> = {}
    animeEntries.forEach((e: any) => e.score && (scores[e.score] = true))
    return Object.keys(scores).map(Number).sort((a, b) => a - b)
  }, [animeEntries])

  // Manga score distribution
  const mangaAllScores = useMemo(() => {
    const scores: Record<number, boolean> = {}
    mangaEntries.forEach((e: any) => e.score && (scores[e.score] = true))
    return Object.keys(scores).map(Number).sort((a, b) => a - b)
  }, [mangaEntries])

  const years = useMemo(() => {
    const set = new Set<number>()
    animeEntries.forEach((e: any) => e.media.seasonYear && set.add(e.media.seasonYear))
    return Array.from(set).sort((a, b) => a - b)
  }, [animeEntries])

  const filteredAnime = useMemo(() => {
    return animeEntries.filter((e: any) => {
      const matchYear = year ? e.media.seasonYear === year : true
      const matchSeason = season !== "All" ? e.media.season === season : true
      const matchAdult = displayAdultContent ? true : !e.media.isAdult
      return matchYear && matchSeason && matchAdult
    })
  }, [animeEntries, year, season, displayAdultContent])

  const filteredManga = useMemo(() => {
    return mangaEntries.filter((e: any) => {
      const matchAdult = displayAdultContent ? true : !e.media.isAdult
      return matchAdult
    })
  }, [mangaEntries, displayAdultContent])

  // Anime stats
  const totalWatched = filteredAnime.length
  const animeMeanScore = totalWatched
    ? filteredAnime.reduce((sum, e: any) => sum + (e.score || 0), 0) / totalWatched
    : 0

  // Manga stats
  const totalRead = filteredManga.length
  const mangaMeanScore = totalRead
    ? filteredManga.reduce((sum, e: any) => sum + (e.score || 0), 0) / totalRead
    : 0

  // Anime score distribution
  const animeScoreData = useMemo(() => {
    const counts: Record<number, number> = {}
    filteredAnime.forEach((e: any) => e.score && (counts[e.score] = (counts[e.score] || 0) + 1))
    return Object.entries(counts).map(([score, count]) => ({ score: Number(score), count }))
  }, [filteredAnime])

  // Manga score distribution
  const mangaScoreData = useMemo(() => {
    const counts: Record<number, number> = {}
    filteredManga.forEach((e: any) => e.score && (counts[e.score] = (counts[e.score] || 0) + 1))
    return Object.entries(counts).map(([score, count]) => ({ score: Number(score), count }))
  }, [filteredManga])

  // Early return when loading or getting an error
  if (viewerLoading || animeLoading || mangaLoading)
    return <div className="p-4 text-sm text-gray tracking-wide font-semibold">Loading...</div>
  if (animeError || mangaError)
    return <div className="p-4 text-sm text-red tracking-wide font-semibold">Error loading stats.</div>

  return (
    <div className="p-2">

      {/* Anime Stats Section */}
      <div className="mb-8 mt-4">
        <h3 className="text-xl text-gray font-bold text-center mb-2">Anime Stats</h3>
        
        {/* Anime Stats Display */}
        <div className="flex justify-center gap-[114px] m-4 -translate-x-2">
          <div className="flex space-x-4 items-center justify-center">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg">
              <MonitorCheck size={20} className="text-gray" />
            </div>
            <div className="text-start">
              <div className="text-2xl font-bold" style={{ color: profileColor }}>
                {totalWatched}
              </div>
              <div className="text-sm text-gray tracking-wide font-semibold">Total Anime</div>
            </div>
          </div>
          <div className="flex space-x-4 items-center justify-center">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg">
              <Percent size={20} className="text-gray" />
            </div>
            <div className="text-start">
              <div className="text-2xl font-bold" style={{ color: profileColor }}>
                {animeMeanScore.toFixed(2)}
              </div>
              <div className="text-sm text-gray tracking-wide font-semibold">Mean Score</div>
            </div>
          </div>
        </div>

        {/* Anime Filters */}
        <div className="pl-6 pr-6 flex justify-between items-start">
          {/* Year Section */}
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray">Year</span>
              {year && (
                <div className="flex items-center gap-1">
                  <button onClick={() => { setYear(null); setSliderValue(0) }} className="text-gray leading-none">
                    <CancelIcon sx={{ fontSize: "1rem" }} />
                  </button>
                  <span className="text-medium text-gray">{year}</span>
                </div>
              )}
            </div>
            <Slider.Root
              className="relative flex items-center select-none touch-none w-full h-8"
              min={0}
              max={years.length}
              step={1}
              value={[sliderValue]}
              onValueChange={(values) => {
                const i = values[0]
                setSliderValue(i)
                setYear(i === 0 ? null : years[i - 1])
              }}
              onPointerDown={() => setIsSliderActive(true)}
              onPointerUp={() => setIsSliderActive(false)}
            >
              <Slider.Track className="bg-white-100 relative grow rounded-full h-1.5">
                <Slider.Range className="absolute rounded-full h-full" style={{ background: profileColor }} />
              </Slider.Track>
              <Slider.Thumb
                className="block w-4 h-4 bg-white-100 shadow-lg border-2 rounded-full hover:w-5 hover:h-5 transition-all duration-200 cursor-pointer"
                style={{ borderColor: profileColor }}
                aria-label="Year"
              >
                <div className={`flex items-center justify-center absolute min-w-14 min-h-8 -top-10 left-1/2 transform -translate-x-1/2 bg-[#242538] text-white text-xs px-2 py-1 rounded transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10
                    ${isSliderActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {sliderValue === 0 ? "All Years" : years[sliderValue - 1]}
                  </div>
              </Slider.Thumb>
            </Slider.Root>
          </div>

          {/* Season Section */}
          <div className="ml-10 min-w-[170px]">
            <h3 className="text-sm font-medium mb-1 text-gray ml-1">Season</h3>
            <CustomSelect
              options={[
                { name: "Any", value: "All"},
                { name: "Winter", value: "WINTER"},
                { name: "Spring", value: "SPRING"},
                { name: "Summer", value: "SUMMER"},
                { name: "Fall", value: "FALL"}
              ]}
              value={season}
              onChange={setSeason}
              profileColor={profileColor}
            />
          </div>
        </div>

        {/* Anime Score Chart */}
        <div className="-mt-2">
          <ScoreChart data={animeScoreData} allScores={animeAllScores} />
        </div>
      </div>

      {/* Manga Stats Section */}
      <div>
        <h3 className="text-xl text-gray font-bold text-center mb-2">Manga Stats</h3>
        
        {/* Manga Stats Display */}
        <div className="flex justify-center gap-[114px] m-4 -translate-x-2">
          <div className="flex space-x-4 items-center justify-center">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg">
              <BookOpen size={20} className="text-gray" />
            </div>
            <div className="text-start">
              <div className="text-2xl font-bold" style={{ color: profileColor }}>
                {totalRead}
              </div>
              <div className="text-sm text-gray tracking-wide font-semibold">Total Manga</div>
            </div>
          </div>
          <div className="flex space-x-4 items-center justify-center">
            <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg">
              <Percent size={20} className="text-gray" />
            </div>
            <div className="text-start">
              <div className="text-2xl font-bold" style={{ color: profileColor }}>
                {mangaMeanScore.toFixed(2)}
              </div>
              <div className="text-sm text-gray tracking-wide font-semibold">Mean Score</div>
            </div>
          </div>
        </div>

        {/* Manga Score Chart */}
        <div className="mt-6">
          <ScoreChart data={mangaScoreData} allScores={mangaAllScores} />
        </div>
      </div>
    </div>
  )
}