import React, { useState } from "react"
import { ApolloProvider } from "@apollo/client"
import { client } from "./apollo/client"
import { Tabs } from "./components/Tabs"
import { DashboardTab } from "./components/DashboardTab"
import { StatsTab } from "./components/StatsTab"
import { useAuth } from "./hooks/useAuth"
import "./styles/popup.css"

const TAB_NAMES = ["Dashboard", "Stats"]

function Popup() {
  const [selectedTab, setSelectedTab] = useState(0)
  const { user, loading, login, logout } = useAuth()

  return (
    <ApolloProvider client={client}>
      <div className="w-[350px] min-h-[400px] bg-gray-50 p-2">
        <div className="flex items-center justify-between mb-2">
          {user?.Viewer?.avatar?.medium && (
            <img
              src={user.Viewer.avatar.medium}
              alt="Avatar"
              className="w-10 h-10 rounded-full"
            />
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
        <div>
          {selectedTab === 0 && <DashboardTab />}
          {selectedTab === 1 && <StatsTab />}
        </div>
      </div>
    </ApolloProvider>
  )
}

export default Popup