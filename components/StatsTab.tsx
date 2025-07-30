import React, { useMemo, useState, useEffect } from "react"
import { useQuery, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { ScoreChart } from "./ScoreChart"
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

  const { data, loading, error} = useQuery(COMPLETED_LIST_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const entries = data?.MediaListCollection?.lists?.[0]?.entries ?? []

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
      <div className="mb-2 flex items-center gap-2">
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

      {/* Stats Display Section */}
      <div className="mb-4 flex justify-center gap-8 p-4 border rounded-lg bg-gray-50">
        <div className="text-center">
          <div 
            className="text-2xl font-bold mb-1"
            style={{ color: profileColor }}
          >
            {totalWatched}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide">
            Total Watched
          </div>
        </div>
        <div className="text-center">
          <div 
            className="text-2xl font-bold mb-1"
            style={{ color: profileColor }}
          >
            {meanScore.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 uppercase tracking-wide">
            Mean Score
          </div>
        </div>
      </div>

      <ScoreChart data={scoreData} />
    </div>
  )
}