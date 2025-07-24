import React, { useState } from "react"
import { SettingsProvider } from './contexts/SettingsContext'
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { AnimeTab } from "./components/AnimeTab"
import { StatsTab } from "./components/StatsTab"
import { SettingsTab } from "./components/SettingsTab"
import { LoginPage } from "./components/LoginPage"
import { useAuth } from "./hooks/useAuth"
import "./styles/popup.css"

const TAB_NAMES = ["Anime List", "Stats", "Settings"]

function Popup() {
  const [selectedTab, setSelectedTab] = useState(0)
  const { user, loading, login, logout } = useAuth()
  const avatar = user?.data?.Viewer?.avatar?.medium
  const userName = user?.data?.Viewer?.name

  if (!user) {
    return <LoginPage />
  }

  return (
    <ApolloProvider client={client}>
      <SettingsProvider>
        <div className="w-[400px] min-h-[400px]">
          <div className="flex items-center space-x-4 justify-start mb-2 bg-[#1d2033] pt-10 pr-8 pl-10">
            {avatar && (
              <img src={avatar} alt="Avatar" className="w-16 h-16"/>
            )}
            {userName && (
              <p className="text-white pt-6 font-bold tracking-wide text-sm">{userName}</p>
            )}
          </div>
          <Tabs tabs={TAB_NAMES} selected={selectedTab} onSelect={setSelectedTab} />
          <div className="bg-white">
            {selectedTab === 0 && <AnimeTab />}
            {selectedTab === 1 && <StatsTab />}
            {selectedTab === 2 && <SettingsTab />}
          </div>
        </div>
      </SettingsProvider>
    </ApolloProvider>
  )
}

export default Popup