import React, { useMemo, useState } from "react"
import { useQuery, gql } from "@apollo/client"
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

const seasons = ["Winter", "Spring", "Summer", "Fall"]

export const StatsTab: React.FC = () => {
  const { data: viewerData } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error } = useQuery(COMPLETED_LIST_QUERY, {
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

  // Filtered entries
  const filtered = useMemo(() => {
    return entries.filter((e: any) => {
      const matchYear = year ? e.media.seasonYear === year : true
      const matchSeason = season !== "All" ? e.media.season === season : true
      return matchYear && matchSeason
    })
  }, [entries, year, season])

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
          <option value="All">All Seasons</option>
          {seasons.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <ScoreChart data={scoreData} />
    </div>
  )
}