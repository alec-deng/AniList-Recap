import React, { useState } from "react"
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { AnimeTab } from "./components/AnimeTab"
import { StatsTab } from "./components/StatsTab"
import { useAuth } from "./hooks/useAuth"
import "./styles/popup.css"

const TAB_NAMES = ["Anime List", "Stats"]

function Popup() {
  const [selectedTab, setSelectedTab] = useState(0)
  const { user, loading, login, logout } = useAuth()
  const avatar = user?.data?.Viewer?.avatar?.medium
  const userName = user?.data?.Viewer?.name

  return (
    <ApolloProvider client={client}>
      <div className="w-[400px] min-h-[400px]">
        <div className="flex items-center justify-between mb-2 bg-[#1d2033] pt-10 pr-8 pl-10">
          {avatar && (
            <img src={avatar} alt="Avatar" className="w-16 h-16"/>
          )}
          {userName && (
            <p className="text-[#edf1f5] pl-4 pt-6 font-bold tracking-wide text-sm">{userName}</p>
          )}
          <button
            className="ml-auto px-3 py-1 bg-blue-500 text-white rounded text-xs"
            onClick={user ? logout : login}
            disabled={loading}
          >
            {user ? "Logout" : "Login"}
          </button>
        </div>
        <Tabs tabs={TAB_NAMES} selected={selectedTab} onSelect={setSelectedTab} />
        <div className="bg-[#edf1f5]">
          {selectedTab === 0 && <AnimeTab />}
          {selectedTab === 1 && <StatsTab />}
        </div>
      </div>
    </ApolloProvider>
  )
}

export default Popup