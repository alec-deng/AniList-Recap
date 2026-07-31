import React, { useState, useRef, useEffect } from "react"
import '../styles/animation.css'

type Anime = {
  id: number
  title: string
  cover: string
  progress: number
  score: number
  nextAiringEpisode: number | null
  totalEpisodes: number | null
  isAdult: boolean
}

type Props = {
  anime: Anime
  profileColor: string
  onScoreChange: (score: number) => void
  onMarkCompleted: () => void
  onProgressChange: (progress: number) => void
  scoreFormat: string
  displayAdultContent: boolean
  onHoverChange?: (hovering: boolean) => void
  onEditingChange?: (editing: boolean) => void
  // Cap used only when the media has no known total (e.g. an airing series)
  maxProgressFallback?: number
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

// Drawn with CSS borders instead of a "▲"/"▼" glyph so it renders identically
// across browsers — font fallback for that glyph differs enough between
// Chrome and Firefox that the two buttons could visually overlap.
const ArrowIcon: React.FC<{ direction: 'up' | 'down'; color: string }> = ({ direction, color }) => (
  <span
    className="block w-0 h-0"
    style={{
      borderLeft: '4.5px solid transparent',
      borderRight: '4.5px solid transparent',
      ...(direction === 'up'
        ? { borderBottom: `6px solid ${color}` }
        : { borderTop: `6px solid ${color}` })
    }}
  />
)

export const MediaCard: React.FC<Props> = ({
  anime,
  profileColor,
  onScoreChange, 
  onMarkCompleted,
  onProgressChange,
  scoreFormat,
  displayAdultContent,
  onHoverChange,
  onEditingChange,
  maxProgressFallback = 9999
}) => {
  const [score, setScore] = useState(anime.score)
  const [progress, setProgress] = useState(anime.progress)
  const [isEditingScore, setIsEditingScore] = useState(false)
  const [isEditingProgress, setIsEditingProgress] = useState(false)
  const [tempProgress, setTempProgress] = useState(anime.progress.toString())
  const [tempScore, setTempScore] = useState(anime.score.toString())
  const maxScore = getMaxScore(scoreFormat)
  // Cap to whichever is lower: totalEpisodes or aired-so-far (nextAiringEpisode - 1)
  const airedEpisodes = anime.nextAiringEpisode ? anime.nextAiringEpisode - 1 : null
  const episodeCaps = [anime.totalEpisodes, airedEpisodes].filter(
    (v): v is number => v !== null
  )
  const maxEpisodes = episodeCaps.length ? Math.min(...episodeCaps) : maxProgressFallback
  // The cap only limits increases — progress set past it elsewhere must still
  // step down one at a time rather than snapping to the cap
  const progressCeiling = Math.max(maxEpisodes, progress)

  // A removed card never fires mouseleave, so release on unmount instead
  const isHoveredRef = useRef(false)
  const handleMouseEnter = () => {
    isHoveredRef.current = true
    onHoverChange?.(true)
  }
  const handleMouseLeave = () => {
    isHoveredRef.current = false
    onHoverChange?.(false)
  }

  // An open input is an interaction of its own: the typed value commits on
  // blur, which is usually after the pointer has left the card.
  const isEditingRef = useRef(false)
  const setEditing = (editing: boolean) => {
    isEditingRef.current = editing
    onEditingChange?.(editing)
  }

  useEffect(() => {
    return () => {
      if (isHoveredRef.current) {
        onHoverChange?.(false)
      }
      if (isEditingRef.current) {
        onEditingChange?.(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    if (isNaN(numValue)) {
      setTempScore(score.toString())
      setIsEditingScore(false)
      setEditing(false)
      return
    }

    // Clamped, not rejected: the arrows already stop at the bound rather than
    // handing back the old value, so typing shouldn't answer it differently.
    const clampedScore = Math.min(Math.max(numValue, 0), maxScore)

    // Sent unrounded — AniList applies the account's score format itself
    setScore(clampedScore)
    setTempScore(clampedScore.toString())
    setIsEditingScore(false)
    // Already at the bound is the arrow's disabled state — nothing to queue
    if (clampedScore !== score) onScoreChange(clampedScore)
    // After the edit, never before: ending the interaction first would leave
    // the value landing on an unfrozen grid, with no animation.
    setEditing(false)
  }

  const handleScoreInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScoreInputBlur()
    } else if (e.key === 'Escape') {
      setTempScore(score.toString())
      setIsEditingScore(false)
      setEditing(false)
    }
  }

  const handleProgressChange = (newProgress: number) => {
    const clampedProgress = Math.min(Math.max(0, newProgress), progressCeiling)
    setProgress(clampedProgress)
    setTempProgress(clampedProgress.toString())
    onProgressChange(clampedProgress)
  }

  const handleProgressInputChange = (value: string) => {
    setTempProgress(value)
  }

  const handleProgressInputBlur = () => {
    const numValue = parseInt(tempProgress)

    // A fractional episode is malformed rather than out of range — no bound to clamp to
    if (isNaN(numValue) || !Number.isInteger(parseFloat(tempProgress))) {
      setTempProgress(progress.toString())
      setIsEditingProgress(false)
      setEditing(false)
      return
    }

    // Clamped to the same ceiling the arrows stop at — see handleScoreInputBlur
    const clampedProgress = Math.min(Math.max(numValue, 0), progressCeiling)

    setProgress(clampedProgress)
    setTempProgress(clampedProgress.toString())
    setIsEditingProgress(false)
    if (clampedProgress !== progress) onProgressChange(clampedProgress)
    // After the edit, never before — see handleScoreInputBlur
    setEditing(false)
  }

  const handleProgressInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProgressInputBlur()
    } else if (e.key === 'Escape') {
      setTempProgress(progress.toString())
      setIsEditingProgress(false)
      setEditing(false)
    }
  }

  // Shown regardless of manualCompletion, or a maxed entry has no way to
  // finish once that setting is off
  const showCompletionButton = anime.totalEpisodes !== null && progress >= anime.totalEpisodes

  return (
    <div
      className="relative w-full aspect-[3/4] overflow-hidden rounded-lg shadow-md transition-all duration-200 group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        backgroundImage: `url(${anime.cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {showCompletionButton && (
        <div className="absolute top-2 left-2 right-2 opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-hover:pointer-events-auto transition-opacity duration-150">
          <button
            className="w-full text-white px-2 py-1 rounded text-xs font-medium shadow-lg hover:brightness-105"
            style={{ backgroundColor: profileColor }}
            onClick={onMarkCompleted}
          >
            Mark as Completed
          </button>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-black/65 p-3">
        <h4 className="font-medium text-xs leading-tight mb-1 text-white line-clamp-4">
          {anime.title}
        </h4>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isEditingProgress ? (
              <input
                type="text"
                value={tempProgress}
                onChange={(e) => handleProgressInputChange(e.target.value)}
                onBlur={handleProgressInputBlur}
                onKeyDown={handleProgressInputKeyDown}
                onFocus={(e) => e.currentTarget.select()}
                className="bg-transparent text-xs w-5 text-right border-b border-white/50 focus:border-white focus:outline-none"
                style={{ 
                  color: profileColor,
                  borderBottomColor: `${profileColor}50` // 50% opacity
                }}
                autoFocus
              />
            ) : (
              <span 
                className="text-xs cursor-pointer hover:underline"
                style={{ color: profileColor }}
                onClick={() => {
                  setIsEditingProgress(true)
                  setTempProgress(progress.toString())
                  setEditing(true)
                }}
              >
                {progress}
              </span>
            )}
            <span className="text-xs" style={{ color: profileColor }}>
              {anime.totalEpisodes && `/${anime.totalEpisodes}`}
            </span>
            <div className="flex flex-col -space-y-0.5 ml-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150">
              <button
                className="w-3.5 h-3.5 flex items-center justify-center leading-none rounded-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent outline-offset-0"
                onClick={() => handleProgressChange(progress + 1)}
                disabled={progress >= maxEpisodes}
              >
                <ArrowIcon direction="up" color={profileColor} />
              </button>
              <button
                className="w-3.5 h-3.5 flex items-center justify-center leading-none rounded-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent outline-offset-0"
                onClick={() => handleProgressChange(progress - 1)}
                disabled={progress <= 0}
              >
                <ArrowIcon direction="down" color={profileColor} />
              </button>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="flex flex-col -space-y-0.5 mr-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-150">
              <button
                className="w-3.5 h-3.5 flex items-center justify-center leading-none rounded-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent outline-offset-0"
                onClick={() => handleScoreChange(score + 1)}
                disabled={score >= maxScore}
              >
                <ArrowIcon direction="up" color={profileColor} />
              </button>
              <button
                className="w-3.5 h-3.5 flex items-center justify-center leading-none rounded-sm hover:bg-white/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent outline-offset-0"
                onClick={() => handleScoreChange(score - 1)}
                disabled={score <= 0}
              >
                <ArrowIcon direction="down" color={profileColor} />
              </button>
            </div>
            {isEditingScore ? (
              <input
                type="text"
                value={tempScore}
                onChange={(e) => handleScoreInputChange(e.target.value)}
                onBlur={handleScoreInputBlur}
                onKeyDown={handleScoreInputKeyDown}
                onFocus={(e) => e.currentTarget.select()}
                className="bg-transparent text-xs w-5 text-right border-b border-white/50 focus:border-white focus:outline-none"
                style={{ 
                  color: profileColor,
                  borderBottomColor: `${profileColor}50` // 50% opacity
                }}
                autoFocus
              />
            ) : (
              <span 
                className="text-xs cursor-pointer hover:underline"
                style={{ color: profileColor }}
                onClick={() => {
                  setIsEditingScore(true)
                  setTempScore(score.toString())
                  setEditing(true)
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