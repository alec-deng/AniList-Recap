import React from "react"
import { useQuery, useMutation, gql } from "@apollo/client"
import { AnimeCard } from "./AnimeCard"

const VIEWER_QUERY = gql`
  query {
    Viewer {
      id
      name
      avatar {
        medium
      }
    }
  }
`

const WATCHING_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
      lists {
        entries {
          media {
            id
            title {
              romaji
            }
            coverImage {
              medium
            }
          }
          progress
          score
          id
        }
      }
    }
  }
`

const UPDATE_PROGRESS_MUTATION = gql`
  mutation ($id: Int!, $progress: Int!) {
    SaveMediaListEntry(id: $id, progress: $progress) {
      id
      progress
    }
  }
`

const UPDATE_SCORE_MUTATION = gql`
  mutation ($id: Int!, $score: Float!) {
    SaveMediaListEntry(id: $id, score: $score) {
      id
      score
    }
  }
`

export const DashboardTab: React.FC = () => {
  const { data: viewerData, loading: viewerLoading } = useQuery(VIEWER_QUERY)
  const userId = viewerData?.Viewer?.id

  const { data, loading, error, refetch } = useQuery(WATCHING_LIST_QUERY, {
    variables: { userId },
    skip: !userId
  })

  const [updateProgress] = useMutation(UPDATE_PROGRESS_MUTATION)
  const [updateScore] = useMutation(UPDATE_SCORE_MUTATION)

  if (viewerLoading || loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-500">Error loading anime list.</div>

  const watchingList = data?.MediaListCollection?.lists?.[0]?.entries ?? []

  return (
    <div className="p-2">
      <div className="font-bold text-center mb-2">Currently Watching</div>
      {watchingList.length === 0 && <div className="text-center text-gray-500">No anime found.</div>}
      {watchingList.map((entry: any) => (
        <AnimeCard
          key={entry.id}
          anime={{
            id: entry.id,
            title: entry.media.title.romaji,
            cover: entry.media.coverImage.medium,
            progress: entry.progress,
            score: entry.score
          }}
          onIncrement={async () => {
            await updateProgress({ variables: { id: entry.id, progress: entry.progress + 1 } })
            refetch()
          }}
          onScoreChange={async (score) => {
            await updateScore({ variables: { id: entry.id, score } })
            refetch()
          }}
        />
      ))}
    </div>
  )
}