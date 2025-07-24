import React from "react"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => (
  <div className="flex">
    {tabs.map((tab, idx) => (
      <button
        key={tab}
        className={`flex-1 pt-0.5 pb-2 text-sm font-medium ${
          selected === idx ? "text-pink" : "text-[#7a858f]"
        }`}
        onClick={() => onSelect(idx)}
      >
        {tab}
      </button>
    ))}
  </div>
)