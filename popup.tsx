import React, { useState, useEffect } from "react"
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { AniListDataProvider } from "./contexts/AniListDataContext"
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { AnimeTab } from "./components/AnimeTab"
import { MangaTab } from "./components/MangaTab"
import { StatsTab } from "./components/StatsTab"
import { SettingsTab } from "./components/SettingsTab"
import { LoginPage } from "./components/LoginPage"
import { useAuth } from "./hooks/useAuth"
import { SquareArrowOutUpRight  } from "lucide-react"
import "./styles/popup.css"

const TAB_DEFS = [
  { key: "anime", label: "Anime List", Component: AnimeTab },
  { key: "manga", label: "Manga List", Component: MangaTab },
  { key: "stats", label: "Stats", Component: StatsTab },
  { key: "settings", label: "Settings", Component: SettingsTab }
]

function PopupContent() {
  const [selectedKey, setSelectedKey] = useState("anime")
  const { user } = useAuth()
  const avatar = user?.data?.Viewer?.avatar?.medium
  const userName = user?.data?.Viewer?.name
  const { profileColor, tabVisibility } = useSettings()

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

  if (!user) {
    return <LoginPage />
  }

  const selectedIndex = visibleTabs.findIndex(({ key }) => key === selectedKey)
  const SelectedComponent = visibleTabs[selectedIndex]?.Component

  return (
    <div className="w-[500px] min-h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2 pt-10 pr-8 pl-10 bg-gradient-to-b from-[#242538] to-[#12162a]">
        {/* Avatar and Username */}
        <div className="flex items-center space-x-4">
          {avatar && (
            <img src={avatar} alt="Avatar" className="w-16 h-16"/>
          )}
          {userName && (
            <p className="text-white pt-6 font-bold tracking-wide text-sm">{userName}</p>
          )}
        </div>
        
        {/* AniList Link */}
        <a 
          href="https://anilist.co" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white flex items-center space-x-2 pt-6 group transition-colors duration-200"
          style={{ '--profile-color': profileColor } as React.CSSProperties}
        >
          <span className="text-sm font-medium">AniList</span>
          <SquareArrowOutUpRight  
            className="group-hover:[color:var(--profile-color)] transition-colors duration-200" 
            size={16} 
          />
        </a>
      </div>

      <Tabs
        tabs={visibleTabs.map(({ label }) => label)}
        selected={selectedIndex}
        onSelect={(idx) => setSelectedKey(visibleTabs[idx].key)}
      />
      <div className="bg-white flex-1 flex flex-col">
        {SelectedComponent && <SelectedComponent />}
      </div>
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