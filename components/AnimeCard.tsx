import React, { useState } from "react"
import '../styles/animation.css'

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
  profileColor: string
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

export const AnimeCard: React.FC<Props> = ({
  anime,
  profileColor,
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
  const [isEditingScore, setIsEditingScore] = useState(false)
  const [isEditingProgress, setIsEditingProgress] = useState(false)
  const [tempProgress, setTempProgress] = useState(anime.progress.toString())
  const [tempScore, setTempScore] = useState(anime.score.toString())
  const maxScore = getMaxScore(scoreFormat)
  const maxEpisodes = anime.totalEpisodes || 999
  
  // Don't render adult content if setting is disabled
  if (anime.isAdult && !displayAdultContent) {
    return null
  }

  const handleScoreChange = (newScore: number) => {
    const clampedScore = Math.min(Math.max(0, newScore), maxScore)
    setScore(clampedScore)
    setTempScore(clampedScore.toString())
    onScoreChange(clampedScore)
  }

  const handleScoreInputChange = (value: string) => {
    setTempScore(value)
  }

  const handleScoreInputBlur = () => {
    const numValue = parseFloat(tempScore)

    // Check if it's a valid number and within range
    if (isNaN(numValue) || numValue < 0 || numValue > maxScore) {
      // Invalid input - revert to current score
      setTempScore(score.toString())
      setIsEditingScore(false)
      return
    }
    
    // Valid input - update the score (let AniList handle formatting)
    setScore(numValue)
    setTempScore(numValue.toString())
    setIsEditingScore(false)
    onScoreChange(numValue)
  }

  const handleScoreInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScoreInputBlur()
    } else if (e.key === 'Escape') {
      setTempScore(score.toString())
      setIsEditingScore(false)
    }
  }

  const handleProgressChange = (newProgress: number) => {
    const clampedProgress = Math.min(Math.max(0, newProgress), maxEpisodes)
    setProgress(clampedProgress)
    setTempProgress(clampedProgress.toString())
    onProgressChange(clampedProgress)
  }

  const handleProgressInputChange = (value: string) => {
    setTempProgress(value)
  }

  const handleProgressInputBlur = () => {
    const numValue = parseInt(tempProgress)
    
    // Check if it's a valid integer and within range
    if (isNaN(numValue) || numValue < 0 || numValue > maxEpisodes || !Number.isInteger(parseFloat(tempProgress))) {
      // Invalid input - revert to current progress
      setTempProgress(progress.toString())
      setIsEditingProgress(false)
      return
    }
    
    // Valid input - update the progress
    setProgress(numValue)
    setTempProgress(numValue.toString())
    setIsEditingProgress(false)
    onProgressChange(numValue)
  }

  const handleProgressInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProgressInputBlur()
    } else if (e.key === 'Escape') {
      setTempProgress(progress.toString())
      setIsEditingProgress(false)
    }
  }

  // Show completion button only when progress equals total episodes
  const showCompletionButton = manualCompletion && anime.totalEpisodes !== null && progress >= anime.totalEpisodes

  return (
    <div 
      className="relative w-full aspect-[3/4] overflow-hidden transition-all duration-200 group"
      style={{
        backgroundImage: `url(${anime.cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Completion button - top center, show on hover */}
      {showCompletionButton && (
        <div className="absolute top-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            className="w-full text-white px-2 py-1 rounded text-xs font-medium shadow-lg"
            style={{ backgroundColor: profileColor }}
            onClick={onMarkCompleted}
            disabled={loading}
          >
            Mark as Completed
          </button>
        </div>
      )}

      {/* Full bottom overlay covering all content */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/65 p-3">
        {/* Title */}
        <h4 className="font-medium text-xs leading-tight mb-1 text-white">
          {anime.title}
        </h4>
        
        {/* Progress and Score row */}
        <div className="flex items-center justify-between">
          {/* Progress section - aligned left */}
          <div className="flex items-center">
            {isEditingProgress ? (
              <input
                type="text"
                value={tempProgress}
                onChange={(e) => handleProgressInputChange(e.target.value)}
                onBlur={handleProgressInputBlur}
                onKeyDown={handleProgressInputKeyDown}
                className="flash-on-group-hover bg-transparent text-xs w-5 text-right border-b border-white/50 focus:border-white focus:outline-none"
                style={{ 
                  color: profileColor,
                  borderBottomColor: `${profileColor}50` // 50% opacity
                }}
                autoFocus
              />
            ) : (
              <span 
                className="text-xs cursor-pointer hover:underline flash-on-group-hover"
                style={{ color: profileColor }}
                onClick={() => {
                  setIsEditingProgress(true)
                  setTempProgress(progress.toString())
                }}
              >
                {progress}
              </span>
            )}
            <span className="text-xs flash-on-group-hover" style={{ color: profileColor }}>
              /{anime.totalEpisodes || '?'}
            </span>
            <div className="flex flex-col ml-1 opacity-0 group-hover:opacity-100 duration-150">
              <button
                className="text-xs w-4 h-3 flex items-center justify-center leading-none"
                style={{ color: profileColor }}
                onClick={() => handleProgressChange(progress + 1)}
                disabled={loading || (anime.totalEpisodes !== null && progress >= anime.totalEpisodes)}
              >
                <span className="scale-x-[0.90] scale-y-[0.75]">▲</span>
              </button>
              <button
                className="text-xs w-4 h-3 flex items-center justify-center leading-none"
                style={{ color: profileColor }}
                onClick={() => handleProgressChange(progress - 1)}
                disabled={loading || progress <= 0}
              >
                <span className="scale-x-[0.90] scale-y-[0.75]">▼</span>
              </button>
            </div>
          </div>
          
          {/* Score section - aligned right */}
          <div className="flex items-center">
            <div className="flex flex-col mr-1 opacity-0 group-hover:opacity-100 duration-150">
              <button
                className="text-xs w-4 h-3 flex items-center justify-center leading-none"
                style={{ color: profileColor }}
                onClick={() => handleScoreChange(score + 1)}
                disabled={loading || score >= maxScore}
              >
                <span className="scale-x-[0.90] scale-y-[0.75]">▲</span>
              </button>
              <button
                className="text-xs w-4 h-3 flex items-center justify-center leading-none"
                style={{ color: profileColor }}
                onClick={() => handleScoreChange(score - 1)}
                disabled={loading || score <= 0}
              >
                <span className="scale-x-[0.90] scale-y-[0.75]">▼</span>
              </button>
            </div>
            {isEditingScore ? (
              <input
                type="text"
                value={tempScore}
                onChange={(e) => handleScoreInputChange(e.target.value)}
                onBlur={handleScoreInputBlur}
                onKeyDown={handleScoreInputKeyDown}
                className="flash-on-group-hover bg-transparent text-xs w-5 text-right border-b border-white/50 focus:border-white focus:outline-none"
                style={{ 
                  color: profileColor,
                  borderBottomColor: `${profileColor}50` // 50% opacity
                }}
                autoFocus
              />
            ) : (
              <span 
                className="text-xs cursor-pointer hover:underline flash-on-group-hover"
                style={{ color: profileColor }}
                onClick={() => {
                  setIsEditingScore(true)
                  setTempScore(score.toString())
                }}
              >
                {score}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}