import React from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

type Props = {
  data: { score: number; count: number }[]
}

export const ScoreChart: React.FC<Props> = ({ data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data}>
      <XAxis dataKey="score" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="count" fill="#3b82f6" />
    </BarChart>
  </ResponsiveContainer>
)