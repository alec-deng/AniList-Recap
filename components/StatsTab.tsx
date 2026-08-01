import React, { useMemo, useState, useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { useAniListData } from "../contexts/AniListDataContext"
import { useUserId } from "../hooks/useUserId"
import { ScoreChart } from "./ScoreChart"
import { CustomSelect } from "./CustomSelect"
import { MonitorCheck, BookOpen, Percent, BarChart3, Loader2, AlertCircle, type LucideIcon } from "lucide-react"
import CancelIcon from "@mui/icons-material/Cancel"
import * as Slider from "@radix-ui/react-slider"
import { StateMessage } from "./StateMessage"
import { getErrorMessage } from "../lib/apolloErrors"

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

// Flatten all entries from all lists (CURRENT, COMPLETED, etc.), keeping only scored ones
const scoredEntries = (data: any) =>
  (data?.MediaListCollection?.lists ?? [])
    .flatMap((list: any) => list.entries ?? [])
    .filter((entry: any) => entry.score > 0)

const distinctScores = (entries: any[]) =>
  Array.from(new Set(entries.map((e: any) => e.score).filter(Boolean))).sort(
    (a, b) => (a as number) - (b as number)
  ) as number[]

const scoreCounts = (entries: any[]) => {
  const counts: Record<number, number> = {}
  entries.forEach((e: any) => e.score && (counts[e.score] = (counts[e.score] || 0) + 1))
  return Object.entries(counts).map(([score, count]) => ({ score: Number(score), count }))
}

const meanScore = (entries: any[]) =>
  entries.length ? entries.reduce((sum, e: any) => sum + (e.score || 0), 0) / entries.length : 0

const StatTile: React.FC<{
  icon: LucideIcon
  value: string | number
  label: string
  profileColor: string
}> = ({ icon: Icon, value, label, profileColor }) => (
  <div className="flex space-x-4 items-center justify-center">
    <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg">
      <Icon size={20} className="text-gray" />
    </div>
    <div className="text-start">
      <div className="text-2xl font-bold" style={{ color: profileColor }}>
        {value}
      </div>
      <div className="text-sm text-gray tracking-wide font-semibold">{label}</div>
    </div>
  </div>
)

const StatSummary: React.FC<{
  heading: string
  icon: LucideIcon
  total: number
  totalLabel: string
  mean: number
  profileColor: string
}> = ({ heading, icon, total, totalLabel, mean, profileColor }) => (
  <>
    <h3 className="text-xl text-gray font-bold text-center mb-2">{heading}</h3>
    <div className="flex justify-center gap-[114px] m-4 -translate-x-2">
      <StatTile icon={icon} value={total} label={totalLabel} profileColor={profileColor} />
      <StatTile
        icon={Percent}
        value={mean.toFixed(2)}
        label="Mean Score"
        profileColor={profileColor}
      />
    </div>
  </>
)

export const StatsTab: React.FC = () => {
  const {
    profileColor,
    displayAdultContent,
    scoreFormat,
    showAnimeStats,
    showMangaStats,
    gridColumns
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

  const { userId, loading: userIdLoading } = useUserId()

  const { data: animeData, loading: animeLoading, error: animeError, refetch: refetchAnime } = useQuery(COMPLETED_ANIME_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const { data: mangaData, loading: mangaLoading, error: mangaError, refetch: refetchManga } = useQuery(COMPLETED_MANGA_QUERY, {
    variables: { userId },
    skip: !userId
  })

  // Refetch only when dirty — the hook's own result is already in flight on a
  // cold load, so calling refetch() too would repeat the request.
  useEffect(() => {
    if (!userId) return
    if (statsList && !statsDirty) return

    if (statsDirty) {
      refetchAnime()
        .then(res => {
          setStatsList(scoredEntries(res.data))
          clearStatsDirty()
        })
        // refetch() rejects on a network error. Stays dirty so the next mount
        // retries; useQuery's own error already drives the StateMessage.
        .catch(err => console.error("[StatsTab] anime refetch failed:", err))
    } else if (animeData) {
      setStatsList(scoredEntries(animeData))
    }
  }, [userId, statsDirty, animeData])

  useEffect(() => {
    if (!userId) return
    if (mangaStatsList && !mangaStatsDirty) return

    if (mangaStatsDirty) {
      refetchManga()
        .then(res => {
          setMangaStatsList(scoredEntries(res.data))
          clearMangaStatsDirty()
        })
        .catch(err => console.error("[StatsTab] manga refetch failed:", err))
    } else if (mangaData) {
      setMangaStatsList(scoredEntries(mangaData))
    }
  }, [userId, mangaStatsDirty, mangaData])

  const animeEntries = statsList ?? []
  const mangaEntries = mangaStatsList ?? []

  const animeAllScores = useMemo(() => distinctScores(animeEntries), [animeEntries])
  const mangaAllScores = useMemo(() => distinctScores(mangaEntries), [mangaEntries])

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

  const animeMeanScore = meanScore(filteredAnime)
  const mangaMeanScore = meanScore(filteredManga)

  const animeScoreData = useMemo(() => scoreCounts(filteredAnime), [filteredAnime])
  const mangaScoreData = useMemo(() => scoreCounts(filteredManga), [filteredManga])

  // Nothing to fetch or show if both lists are hidden from Stats
  if (!showAnimeStats && !showMangaStats) {
    return (
      <StateMessage
        icon={BarChart3}
        title="No Stats Selected"
        message='Enable "Show in Stats" for Anime or Manga in Settings to view your statistics here.'
      />
    )
  }

  if (userIdLoading || animeLoading || mangaLoading)
    return <StateMessage icon={Loader2} spin message="Loading your stats..." />
  if (animeError || mangaError)
    return (
      <StateMessage
        icon={AlertCircle}
        tone="error"
        message={getErrorMessage(animeError || mangaError, "Error loading stats.")}
      />
    )

  return (
    // Margin, not stretch — see SettingsTab
    <div className={`py-2 flex-1 flex flex-col ${gridColumns === 4 ? "px-24" : "px-2"}`}>

      {showAnimeStats && (
      <div className="mb-8 mt-4">
        <StatSummary
          heading="Anime Stats"
          icon={MonitorCheck}
          total={filteredAnime.length}
          totalLabel="Total Anime"
          mean={animeMeanScore}
          profileColor={profileColor}
        />

        <div className="pl-6 pr-6 flex justify-between items-start">
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
                // ?? null: a refetch can shorten years under a held position
                setYear(i === 0 ? null : years[i - 1] ?? null)
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

        <div className="-mt-2">
          <ScoreChart data={animeScoreData} allScores={animeAllScores} />
        </div>
      </div>
      )}

      {showMangaStats && (
      <div>
        <StatSummary
          heading="Manga Stats"
          icon={BookOpen}
          total={filteredManga.length}
          totalLabel="Total Manga"
          mean={mangaMeanScore}
          profileColor={profileColor}
        />

        <div className="mt-6">
          <ScoreChart data={mangaScoreData} allScores={mangaAllScores} />
        </div>
      </div>
      )}
    </div>
  )
}