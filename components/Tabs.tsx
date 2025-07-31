import React from "react"
import { useSettings } from "../contexts/SettingsContext"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => {
  const { profileColor } = useSettings()
  
  return (
    <div className="flex" style={{ '--profile-color': profileColor } as React.CSSProperties}>
      {tabs.map((tab, idx) => (
        <button
          key={tab}
          className={`flex-1 pt-0.5 pb-2 text-sm font-medium transition-colors duration-200 ${
            selected === idx 
              ? '[color:var(--profile-color)]' 
              : 'text-gray hover:[color:var(--profile-color)]'
          }`}
          onClick={() => onSelect(idx)}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}