import React from "react"
import { gql } from "@apollo/client"
import { Tv } from "lucide-react"
import { MediaListTab, type MediaListConfig } from "./MediaListTab"

const WATCHING_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: ANIME, status: CURRENT) {
      lists {
        entries {
          media {
            id
            title {
              english
              native
              romaji
            }
            nextAiringEpisode {
              episode
            }
            coverImage {
              large
            }
            episodes
            isAdult
          }
          progress
          score
          id
          updatedAt
        }
      }
    }
  }
`

const animeConfig: MediaListConfig = {
  type: "anime",
  query: WATCHING_LIST_QUERY,
  getTotal: (media) => media.episodes,
  getNextAiringEpisode: (media) => media.nextAiringEpisode?.episode || null,
  isCaughtUp: (anime) =>
    Boolean(
      (anime.totalEpisodes && anime.progress === anime.totalEpisodes) ||
        (anime.nextAiringEpisode && anime.progress >= anime.nextAiringEpisode - 1)
    ),
  sections: { pending: "Behind", caughtUp: "Caught-Up", combined: "Watching" },
  loadingMessage: "Loading your anime list...",
  errorMessage: "Error loading anime list.",
  empty: {
    icon: Tv,
    title: "No Anime In Progress",
    message: "Anime you're currently watching will show up here."
  }
}

export const AnimeTab: React.FC = () => <MediaListTab config={animeConfig} />
