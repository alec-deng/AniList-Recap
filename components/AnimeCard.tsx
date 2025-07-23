import React, { useState } from "react"

type Anime = {
  id: number
  title: string
  cover: string
  progress: number
  score: number
}

type Props = {
  anime: Anime
  onIncrement: () => void
  onScoreChange: (score: number) => void
  loading?: boolean
}

export const AnimeCard: React.FC<Props> = ({ anime, onIncrement, onScoreChange, loading }) => {
  const [score, setScore] = useState(anime.score)
  return (
    <div className="flex items-center gap-2 p-2 border rounded mb-2 bg-white">
      <img src={anime.cover} alt={anime.title} className="w-12 h-16 object-cover rounded" />
      <div className="flex-1">
        <div className="font-semibold">{anime.title}</div>
        <div className="text-xs text-gray-500">Progress: {anime.progress}</div>
        <button
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs mt-1"
          onClick={onIncrement}
          disabled={loading}
        >
          +1 Episode
        </button>
        <div className="mt-2 flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={e => {
              setScore(Number(e.target.value))
              onScoreChange(Number(e.target.value))
            }}
            className="w-12 border rounded px-1 text-xs"
            disabled={loading}
          />
          <span className="text-xs">Score</span>
        </div>
      </div>
    </div>
  )
}