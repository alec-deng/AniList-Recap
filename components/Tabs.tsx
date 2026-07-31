import React from "react"
import { useSettings } from "../contexts/SettingsContext"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => {
  const { profileColor } = useSettings()

  // Scaled with count: a flat gap crowds 4 tabs or strands 3
  const gapClass = tabs.length >= 4 ? 'gap-x-12' : 'gap-x-20'

  return (
    <div className={`flex justify-center ${gapClass} px-10 pt-[0.0625rem] pb-[0.55625rem]`} style={{ '--profile-color': profileColor } as React.CSSProperties}>
      {tabs.map((tab, idx) => (
        <button
          key={tab}
          className={`min-w-[64px] text-center text-sm font-medium rounded transition-colors duration-200 ${
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