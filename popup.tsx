import React, { useState } from "react"
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { AnimeTab } from "./components/AnimeTab"
import { StatsTab } from "./components/StatsTab"
import { SettingsTab } from "./components/SettingsTab"
import { LoginPage } from "./components/LoginPage"
import { useAuth } from "./hooks/useAuth"
import { ExternalLink } from "lucide-react"
import "./styles/popup.css"

const TAB_NAMES = ["Anime List", "Stats", "Settings"]

function PopupContent() {
  const [selectedTab, setSelectedTab] = useState(0)
  const { user } = useAuth()
  const avatar = user?.data?.Viewer?.avatar?.medium
  const userName = user?.data?.Viewer?.name
  const { profileColor } = useSettings()

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="w-[500px] min-h-[400px]">
      <div className="flex items-center justify-between mb-2 pt-10 pr-8 pl-10 bg-gradient-to-b from-[#242538] to-[#242538]">
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
          className="text-white flex items-center space-x-2 pt-6 pr-4 group transition-colors duration-200"
          style={{ '--profile-color': profileColor } as React.CSSProperties}
        >
          <span className="text-sm font-medium">AniList</span>
          <ExternalLink 
            className="group-hover:[color:var(--profile-color)] transition-colors duration-200" 
            size={16} 
          />
        </a>
        
      </div>
      <Tabs tabs={TAB_NAMES} selected={selectedTab} onSelect={setSelectedTab} />
      <div className="bg-white">
        {selectedTab === 0 && <AnimeTab />}
        {selectedTab === 1 && <StatsTab />}
        {selectedTab === 2 && <SettingsTab />}
      </div>
    </div>
  )
}

function Popup() {
  return (
    <ApolloProvider client={client}>
      <SettingsProvider>
        <PopupContent />
      </SettingsProvider>
    </ApolloProvider>
  )
}

export default Popup