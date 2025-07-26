import React, { useState } from "react"
import { useSettings } from "../contexts/SettingsContext"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => {
  const { profileColor } = useSettings()
  
  return (
    <div className="flex">
      {tabs.map((tab, idx) => (
        <button
          key={tab}
          className={"text-gray flex-1 pt-0.5 pb-2 text-sm font-medium"}
          style={selected === idx ? { color: profileColor } : {}}
          onClick={() => onSelect(idx)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}