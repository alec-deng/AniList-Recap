import React from "react"
import { useSettings } from "../contexts/SettingsContext"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => {
  const { profileColor } = useSettings()

  // Fewer tabs means more leftover room, so a flat gap would either
  // crowd 4 tabs or leave 3 tabs stranded — scale it with the count instead.
  const gapClass = tabs.length >= 4 ? 'gap-x-12' : 'gap-x-20'

  return (
    <div className={`flex justify-center ${gapClass} px-10`} style={{ '--profile-color': profileColor } as React.CSSProperties}>
      {tabs.map((tab, idx) => (
        <button
          key={tab}
          className={`min-w-[64px] text-center pt-0.5 pb-2 text-sm font-medium transition-colors duration-200 ${
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