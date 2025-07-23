import React from "react"

type TabsProps = {
  tabs: string[]
  selected: number
  onSelect: (idx: number) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, selected, onSelect }) => (
  <div className="flex border-b mb-2">
    {tabs.map((tab, idx) => (
      <button
        key={tab}
        className={`flex-1 py-2 text-sm font-medium ${
          selected === idx ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500"
        }`}
        onClick={() => onSelect(idx)}
      >
        {tab}
      </button>
    ))}
  </div>
)