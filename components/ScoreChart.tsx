import React from "react"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LabelList } from "recharts"
import { Star, Frown, Meh, Smile } from "lucide-react"
import { useSettings } from "../contexts/SettingsContext"

type Props = {
  data: { score: number; count: number }[]
  allScores: number[]
}

// Custom tick component for X-axis
const CustomXAxisTick = ({ x, y, payload, scoreFormat }: any) => {
  const score = parseInt(payload.value)
  
  if (scoreFormat === 'POINT_5') {
    // Show stars for POINT_5 format
    return (
      <g transform={`translate(${x},${y})`}>
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            size={12}
            x={-30 + (index * 12)}
            y={0}
            fill={index < score ? '#fbbf24' : 'none'}
            strokeWidth={0.6}
          />
        ))}
      </g>
    )
  } else if (scoreFormat === 'POINT_3') {
    // Show emoji-style icons for POINT_3 format
    let IconComponent
    
    switch (score) {
      case 1:
        IconComponent = Frown
        break
      case 2:
        IconComponent = Meh
        break
      case 3:
        IconComponent = Smile
        break
      default:
        IconComponent = Meh
    }
    
    return (
      <g transform={`translate(${x},${y})`}>
        <IconComponent
          size={16}
          x={-8}
          y={-2}
        />
      </g>
    )
  } else {
    // Default numeric display
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={10}
          textAnchor="middle"
          fill="#5c728a"
          fontSize={12}
          fontWeight="bold"
        >
          {payload.value}
        </text>
      </g>
    )
  }
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
                tick={(props) => <CustomXAxisTick {...props} scoreFormat={scoreFormat} />}
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