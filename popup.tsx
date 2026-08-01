import React, { useState, useEffect } from "react"
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { AniListDataProvider, useAniListData } from "./contexts/AniListDataContext"
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { AnimeTab } from "./components/AnimeTab"
import { MangaTab } from "./components/MangaTab"
import { StatsTab } from "./components/StatsTab"
import { SettingsTab } from "./components/SettingsTab"
import { LoginPage } from "./components/LoginPage"
import { EdgeHandle } from "./components/EdgeHandle"
import { useAuth } from "./hooks/useAuth"
import { SquareArrowOutUpRight  } from "lucide-react"
import "./styles/popup.css"

// Paired to hold the card at ~145x194 — a taller card costs a row of the 600px
// viewport. Literal names: Tailwind's JIT can't see interpolated ones.
const GRID_WIDTH = { 3: "w-[516px]", 4: "w-[678px]" } as const

const TAB_DEFS = [
  { key: "anime", label: "Anime List", Component: AnimeTab },
  { key: "manga", label: "Manga List", Component: MangaTab },
  { key: "stats", label: "Stats", Component: StatsTab },
  { key: "settings", label: "Settings", Component: SettingsTab }
]

function PopupContent() {
  const [selectedKey, setSelectedKey] = useState("anime")
  const { user, loading: authLoading } = useAuth()
  const avatar = user?.data?.Viewer?.avatar?.medium
  const userName = user?.data?.Viewer?.name
  const { profileColor, tabVisibility, gridColumns } = useSettings()
  const { resetData } = useAniListData()

  const visibleTabs = TAB_DEFS.filter(({ key }) => {
    if (key === "anime") return tabVisibility !== "manga"
    if (key === "manga") return tabVisibility !== "anime"
    return true
  })

  useEffect(() => {
    if (!visibleTabs.some(({ key }) => key === selectedKey)) {
      setSelectedKey(visibleTabs[0].key)
    }
  }, [tabVisibility])

  // The whole page scrolls, so an offset would otherwise carry into the next tab
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [selectedKey])

  // Reset all local data when user logs out, to avoid showing stale data from previous user
  useEffect(() => {
    if (!user) {
      setSelectedKey(visibleTabs[0].key)
      resetData()
    }
  }, [user])

  // CHECK_AUTH is a round trip to a usually-cold worker, so painting LoginPage
  // first would flash it on every open. Blank at the logged-in width, which is
  // what almost every open resolves to.
  if (authLoading) {
    return <div className={`${GRID_WIDTH[gridColumns]} min-h-[400px] bg-white`} />
  }

  if (!user) {
    return <LoginPage />
  }

  const selectedIndex = visibleTabs.findIndex(({ key }) => key === selectedKey)
  const SelectedComponent = visibleTabs[selectedIndex]?.Component

  return (
    <div
      className={`${GRID_WIDTH[gridColumns]} min-h-[400px] flex flex-col`}
      style={{ '--profile-color': profileColor } as React.CSSProperties}
    >
      {/* Scales with the window, or the content hugs the edges at 708px */}
      <div
        className={`flex items-center justify-between mb-2 pt-10 bg-gradient-to-b from-[#242538] to-[#12162a] ${
          gridColumns === 4 ? "pr-12 pl-14" : "pr-8 pl-10"
        }`}
      >
        <div className="flex items-center space-x-4">
          {avatar && (
            <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-sm"/>
          )}
          {userName && (
            <p className="text-white pt-6 font-bold tracking-wide text-sm">{userName}</p>
          )}
        </div>
        
        {/* The offset that positions the link sits on the wrapper, not the link:
            on the link it padded out the focus outline into a tall empty box. */}
        <div className="pt-6">
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white flex items-center space-x-2 rounded p-0.5 group transition-colors duration-200"
            style={{ '--profile-color': profileColor } as React.CSSProperties}
          >
            <span className="text-sm font-medium">AniList</span>
            <SquareArrowOutUpRight
              className="group-hover:[color:var(--profile-color)] transition-colors duration-200"
              size={16}
            />
          </a>
        </div>
      </div>

      <Tabs
        tabs={visibleTabs.map(({ label }) => label)}
        selected={selectedIndex}
        onSelect={(idx) => setSelectedKey(visibleTabs[idx].key)}
      />

      <div className="bg-white flex-1 flex flex-col">
        {SelectedComponent && <SelectedComponent />}
      </div>

      <EdgeHandle />
    </div>
  )
}

function Popup() {
  useEffect(() => {
    // Connect to background script to detect when popup closes
    const port = chrome.runtime.connect({ name: 'popup' })
    return () => {
      port.disconnect()
    }
  }, [])

  return (
    <ApolloProvider client={client}>
      <SettingsProvider>
        <AniListDataProvider>
          <PopupContent />
        </AniListDataProvider>
      </SettingsProvider>
    </ApolloProvider>
  )
}

export default Popup