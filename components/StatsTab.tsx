import React, { useMemo, useState, useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { ScoreChart } from "./ScoreChart"
import { MonitorCheck, Percent } from 'lucide-react';
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

const seasons = [
  { name: "Winter", value: "WINTER" },
  { name: "Spring", value: "SPRING" },
  { name: "Summer", value: "SUMMER" },
  { name: "Fall", value: "FALL" }
]

export const StatsTab: React.FC = () => {
  const { 
    profileColor,
    displayAdultContent,
    scoreFormat
  } = useSettings()

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

  const [year, setYear] = useState<number | null>(null)
  const [season, setSeason] = useState<string>("All")

  // Filtered entries by adult content, year, and season
  const filtered = useMemo(() => {
    return entries.filter((e: any) => {
      const matchYear = year ? e.media.seasonYear === year : true
      const matchSeason = season !== "All" ? e.media.season === season : true
      const matchAdult = displayAdultContent ? true : !e.media.isAdult
      return matchYear && matchSeason && matchAdult
    })
  }, [entries, year, season, scoreFormat, displayAdultContent])

  // total watched count (filtered)
  const totalWatched = useMemo(() => filtered.length || 0, [filtered])

  // mean score
  const meanScore = useMemo(() => {
    if (totalWatched === 0) return 0
    const totalScore = filtered.reduce((sum: number, e: any) => sum + (e.score || 0), 0)
    return totalScore / totalWatched
  }, [filtered])

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

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-500">Error loading stats.</div>

    return (
    <div className="p-2">

      {/* Stats Display Section */}
      <div className="flex justify-center gap-20 m-4">

        {/* Total Anime */}
        <div className="flex space-x-4 items-center justify-center">
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg ">
            <MonitorCheck
              size={20}
              className="text-gray"
            />
          </div>
          <div className="text-start">
            <div 
              className="text-2xl font-bold"
              style={{ color: profileColor }}
            >
              {totalWatched}
            </div>
            <div className="text-sm text-gray tracking-wide font-semibold">
              Total Anime
            </div>
          </div>
        </div>

        {/* Mean Score */}
        <div className="flex space-x-4 items-center justify-center">
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-white-100 shadow-lg ">
            <Percent
              size={20}
              className="text-gray"
            />
          </div>
          <div className="text-start">
            <div 
              className="text-2xl font-bold"
              style={{ color: profileColor }}
            >
              {meanScore.toFixed(2)}
            </div>
            <div className="text-sm text-gray tracking-wide font-semibold">
              Mean Score
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="pl-6 pr-6 flex justify-between items-center">
        <span className="text-sm">Year:</span>
        <Slider.Root
          className="w-32 h-4"
          min={years[0] ?? 2000}
          max={years[years.length - 1] ?? 2025}
          step={1}
          value={year ? [year] : [years[0] ?? 2000]}
          onValueChange={v => setYear(v[0])}
        />
        <span className="text-xs">{year ?? "All"}</span>
        <select
          className="ml-2 border rounded px-2 py-1 text-sm"
          value={season}
          onChange={e => setSeason(e.target.value)}
        >
          <option value="All">Any</option>
          {seasons.map(s => (
            <option key={s.value} value={s.value}>{s.name}</option>
          ))}
        </select>
      </div>
      
      {/* Score Chart */}
      <ScoreChart data={scoreData} allScores={allScores} />
    </div>
  )
}