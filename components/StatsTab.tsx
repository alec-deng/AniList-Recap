import React, { useMemo, useState, useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { ScoreChart } from "./ScoreChart"
import { CustomSelect } from "./CustomSelect"
import { MonitorCheck, Percent } from 'lucide-react';
import CancelIcon from '@mui/icons-material/Cancel';
import * as Slider from "@radix-ui/react-slider"

const COMPLETED_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, status: COMPLETED) {
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

  const [year, setYear] = useState<number | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0)
  const [season, setSeason] = useState<string>("All")
  const [isSliderActive, setIsSliderActive] = useState(false);

  const { data: viewerData } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error, refetch} = useQuery(COMPLETED_LIST_QUERY, {
    variables: { userId },
    skip: !userId
  })
    
  // Force refetch when settings changes
  useEffect(() => {
    if (userId) {
      refetch()
    }
  }, [scoreFormat, displayAdultContent, userId, refetch])

  const entries = data?.MediaListCollection?.lists?.[0]?.entries ?? []

  // Score distribution
  const allScores = useMemo(() => {
    const scores: Record<number, boolean> = {}
    entries.forEach((entry: any) => {
      if (entry.score) {
        scores[entry.score] = true
      }
    })
    return Object.keys(scores).map(score => Number(score)).sort((a, b) => a - b)
  }, [entries])

  // Extract years
  const years = useMemo(() => {
    const set = new Set<number>()
    entries.forEach((e: any) => {
      if (e.media.seasonYear) set.add(e.media.seasonYear)
    })
    return Array.from(set).sort((a, b) => a - b)
  }, [entries])

  // Filtered entries by adult content, year, and season
  const filtered = useMemo(() => {
    return entries.filter((e: any) => {
      const matchYear = year ? e.media.seasonYear === year : true
      const matchSeason = season !== "All" ? e.media.season === season : true
      const matchAdult = displayAdultContent ? true : !e.media.isAdult
      return matchYear && matchSeason && matchAdult
    })
  }, [entries, year, season, displayAdultContent])

  // total watched count (filtered)
  const totalWatched = useMemo(() => filtered.length || 0, [filtered])

  // mean score
  const meanScore = useMemo(() => {
    if (totalWatched === 0) return 0
    const totalScore = filtered.reduce((sum: number, e: any) => sum + (e.score || 0), 0)
    return totalScore / totalWatched
  }, [filtered, totalWatched])

  // Score distribution
  const scoreData = useMemo(() => {
    const counts: Record<number, number> = {}
    filtered.forEach((e: any) => {
      if (e.score) counts[e.score] = (counts[e.score] || 0) + 1
    })
    return Object.entries(counts).map(([score, count]) => ({
      score: Number(score),
      count: count as number
    }))
  }, [filtered])

  if (loading) return <div className="p-4 text-sm text-gray tracking-wide font-semibold">Loading...</div>
  if (error) return <div className="p-4 text-sm text-red tracking-wide font-semibold">Error loading stats.</div>

  return (
    <div className="p-2">

      {/* Stats Display Section */}
      <div className="flex justify-center gap-[114px] m-4 -translate-x-2">

        {/* Total Anime */}
        <div className="flex space-x-4 items-center justify-center">
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg ">
            <MonitorCheck size={20} className="text-gray" />
          </div>
          <div className="text-start">
            <div className="text-2xl font-bold" style={{ color: profileColor }}>
              {totalWatched}
            </div>
            <div className="text-sm text-gray tracking-wide font-semibold">
              Total Anime
            </div>
          </div>
        </div>

        <div className="flex space-x-4 items-center justify-center">
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg ">
            <Percent size={20} className="text-gray" />
          </div>
          <div className="text-start">
            <div className="text-2xl font-bold" style={{ color: profileColor }}>
              {meanScore.toFixed(2)}
            </div>
            <div className="text-sm text-gray tracking-wide font-semibold">
              Mean Score
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="pl-6 pr-6 flex justify-between items-start">
      {/* Year Section */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray">Year</span>
            {year && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setYear(null)
                    setSliderValue(0)
                  }}
                  className="text-gray leading-none"
                >
                  <CancelIcon sx={{ fontSize: '1rem' }}/>
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
              const yearIndex = values[0]
              setSliderValue(yearIndex)
              if (yearIndex == 0) {
                setYear(null)
              } else {
                const selectedYear = years[yearIndex - 1]
                setYear(selectedYear)
              }
            }}
            onPointerDown={() => setIsSliderActive(true)}
            onPointerUp={() => setIsSliderActive(false)}
          >
            <Slider.Track className="bg-white-100 relative grow rounded-full h-1.5">
              <Slider.Range className="absolute rounded-full h-full" 
                style={{ background: profileColor }}/>
            </Slider.Track>
            <Slider.Thumb 
              className="block relative w-4 h-4 bg-white-100 shadow-lg border-2 rounded-full hover:w-5 hover:h-5 transition-all duration-200 ease-in-out cursor-pointer group"
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
          <h3 className="text-sm font-medium mb-2 text-gray ml-1">Season</h3>
          <CustomSelect
            options={[
              {name: "Any", value: "All"},
              { name: "Winter", value: "WINTER" },
              { name: "Spring", value: "SPRING" },
              { name: "Summer", value: "SUMMER" },
              { name: "Fall", value: "FALL" }
            ]}
            value={season}
            onChange={setSeason}
            profileColor={profileColor}
            className="w-full [&>button]:py-1"
          />
        </div>
      </div>
      
      {/* Score Chart */}
      <div className="-mt-2">
        <ScoreChart data={scoreData} allScores={allScores} />
      </div>
    </div>
  )
}