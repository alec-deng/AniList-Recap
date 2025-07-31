import React from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"
import { useSettings } from "../contexts/SettingsContext"

type Props = {
  data: { score: number; count: number }[]
  allScores: number[]
}

export const ScoreChart: React.FC<Props> = ({ data, allScores }) => {
  const { profileColor, scoreFormat } = useSettings()
  console.log("allScores:", allScores)

  // Convert scores to strings for proper category handling
  const completeData = allScores.map(score => {
    const existing = data.find(item => item.score === score)
    return {
      score: score.toString(), // Convert to string for category axis
      count: existing ? existing.count : 0
    }
  })

  // Calculate width based on number of scores (minimum bar width + spacing)
  const minBarWidth = 40 // Minimum width per bar
  const calculatedWidth = Math.max(100, allScores.length * minBarWidth)
  const shouldScroll = allScores.length > 11 // Scroll if more than 11 entries

  // Find max count for height calculation
  const maxCount = Math.max(...completeData.map(d => d.count))

  return (
    <div className="border rounded-xl border-white bg-white-100 m-4 shadow-lg overflow-hidden">
      <div className={`${shouldScroll ? 'overflow-x-auto' : ''}`}>
        {/* Chart area with white background */}
        <div className={`bg-white-100`}>
          <ResponsiveContainer 
            width={shouldScroll ? calculatedWidth : "100%"}
            height={200}
          >
            <BarChart 
              data={completeData}
              margin={{ top: 10, right: 10, bottom: 0, left: 10 }}
              style={{ outline: 'none', pointerEvents: 'none' }}
            >
              <YAxis 
                allowDecimals={false} 
                tick={false}
                axisLine={false}
                tickLine={false}
                width={0}
                domain={[0, maxCount + Math.ceil(maxCount * 0.15)]}
              />
              <Bar 
                dataKey="count" 
                fill={profileColor}
                maxBarSize={25}
                radius={[5, 5, 0, 0]}
              >
                <LabelList 
                  dataKey="count" 
                  position="top"
                  formatter={(value: any) => value > 0 ? value : ''}
                  style={{ fill: '#5c728a', fontSize: 12, fontWeight: 'bold' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* X-axis labels area with gray background */}
        <div 
          className="bg-[#e8edf3]"
          style={{ width: shouldScroll ? `${calculatedWidth}px` : '100%' }}
        >
          <ResponsiveContainer 
            width={shouldScroll ? calculatedWidth : "100%"}
            height={35}
          >
            <BarChart 
              data={completeData}
              margin={{ top: 0, right: 10, bottom: 0, left: 10 }}
              style={{ outline: 'none', pointerEvents: 'none' }}
            >
              <XAxis 
                dataKey="score" 
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#5c728a', fontWeight: 'bold' }}
              />
              {/* Invisible bars to maintain spacing */}
              <Bar 
                dataKey="count" 
                fill="transparent"
                maxBarSize={25}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}