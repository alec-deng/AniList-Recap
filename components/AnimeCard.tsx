import React, { useState } from "react"

type Anime = {
  id: number
  title: string
  cover: string
  progress: number
  score: number
  totalEpisodes: number | null
  isAdult: boolean
}

type Props = {
  anime: Anime
  onScoreChange: (score: number) => void
  onMarkCompleted: () => void
  onProgressChange: (progress: number) => void
  loading?: boolean
  scoreFormat: string
  manualCompletion: boolean
  displayAdultContent: boolean
}

const getMaxScore = (format: string): number => {
  switch (format) {
    case 'POINT_100': return 100
    case 'POINT_10_DECIMAL': return 10
    case 'POINT_10': return 10
    case 'POINT_5': return 5
    case 'POINT_3': return 3
    default: return 100
  }
}

const formatScore = (score: number, format: string): string => {
  if (score === 0) return '0'
  
  switch (format) {
    case 'POINT_100': return score.toString()
    case 'POINT_10_DECIMAL': return score.toFixed(1)
    case 'POINT_10': return Math.round(score).toString()
    case 'POINT_5': return Math.round(score).toString()
    case 'POINT_3': return Math.round(score).toString()
    default: return score.toString()
  }
}

export const AnimeCard: React.FC<Props> = ({
  anime,
  onScoreChange, 
  onMarkCompleted,
  onProgressChange,
  loading,
  scoreFormat,
  manualCompletion,
  displayAdultContent
}) => {
  const [score, setScore] = useState(anime.score)
  const [progress, setProgress] = useState(anime.progress)
  const maxScore = getMaxScore(scoreFormat)
  const maxEpisodes = anime.totalEpisodes || 999
  
  // Don't render adult content if setting is disabled
  if (anime.isAdult && !displayAdultContent) {
    return null
  }

  const handleScoreChange = (newScore: number) => {
    const clampedScore = Math.min(Math.max(0, newScore), maxScore)
    setScore(clampedScore)
    onScoreChange(clampedScore)
  }

  const handleProgressChange = (newProgress: number) => {
    const clampedProgress = Math.min(Math.max(0, newProgress), maxEpisodes)
    setProgress(clampedProgress)
    onProgressChange(clampedProgress)
  }

  const isCompleted = anime.totalEpisodes !== null && anime.progress >= anime.totalEpisodes

  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-3">
      {/* Header with cover and title */}
      <div className="flex gap-3 mb-3">
        <img 
          src={anime.cover} 
          alt={anime.title} 
          className="w-16 h-20 object-cover rounded flex-shrink-0" 
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
            {anime.title}
          </h4>
          <div className="text-xs text-gray-500 space-y-1">
            <div>Progress: {anime.progress}/{anime.totalEpisodes || '?'}</div>
            <div>Score: {formatScore(anime.score, scoreFormat)}/{maxScore}</div>
          </div>
        </div>
      </div>

      {/* Progress Controls */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          min={0}
          max={maxEpisodes}
          value={progress}
          onChange={(e) => handleProgressChange(Number(e.target.value))}
          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center"
          disabled={loading}
        />
      </div>

      {/* Score Controls */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-600 w-10">Score:</span>
        <input
          type="number"
          min={0}
          max={maxScore}
          step={scoreFormat === 'POINT_10_DECIMAL' ? 0.1 : 1}
          value={score}
          onChange={(e) => handleScoreChange(Number(e.target.value))}
          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center"
          disabled={loading}
        />
        <span className="text-xs text-gray-500">/{maxScore}</span>
      </div>

      {/* Manual Completion Button */}
      {manualCompletion && (
        <button
          className="w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium disabled:opacity-50"
          onClick={onMarkCompleted}
          disabled={loading}
        >
          Mark as Completed
        </button>
      )}

      {/* Completion Status */}
      {isCompleted && (
        <div className="text-xs text-green-600 font-medium text-center mt-2">
          ✓ Completed
        </div>
      )}
    </div>
  )
}