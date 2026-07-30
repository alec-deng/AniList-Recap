import React from "react"
import { gql } from "@apollo/client"
import { BookOpen } from "lucide-react"
import { MediaListTab, type MediaListConfig } from "./MediaListTab"

const READING_LIST_QUERY = gql`
  query ($userId: Int) {
    MediaListCollection(userId: $userId, type: MANGA, status: CURRENT) {
      lists {
        entries {
          media {
            id
            title {
              english
              native
              romaji
            }
            isAdult
            coverImage {
              large
            }
            chapters
          }
          progress
          score
          id
          updatedAt
          status
        }
      }
    }
  }
`

const mangaConfig: MediaListConfig = {
  type: "manga",
  query: READING_LIST_QUERY,
  getTotal: (media) => media.chapters,
  isCaughtUp: (manga) =>
    Boolean(manga.totalEpisodes && manga.progress >= manga.totalEpisodes),
  sections: { pending: "Reading", caughtUp: "Completed", combined: "Reading" },
  loadingMessage: "Loading your manga list...",
  errorMessage: "Error loading manga list.",
  empty: {
    icon: BookOpen,
    title: "No Manga In Progress",
    message: "Manga you're currently reading will show up here."
  }
}

export const MangaTab: React.FC = () => <MediaListTab config={mangaConfig} />
