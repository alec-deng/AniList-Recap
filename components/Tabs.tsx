import React from "react"
import { useSettings } from "../contexts/SettingsContext"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => {
  const { profileColor, gridColumns } = useSettings()

  // Scaled with count and width — the row is centred, so a flat gap huddles it
  const wide = gridColumns === 4
  const gapClass =
    tabs.length >= 4
      ? wide ? 'gap-x-20' : 'gap-x-12'
      : wide ? 'gap-x-28' : 'gap-x-20'

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