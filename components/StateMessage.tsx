import React from "react"
import type { LucideIcon } from "lucide-react"

type Props = {
  icon?: LucideIcon
  title?: string
  message: string
  tone?: "default" | "error"
  spin?: boolean
}

export const StateMessage: React.FC<Props> = ({ icon: Icon, title, message, tone = "default", spin = false }) => {
  const color = tone === "error" ? "text-red" : "text-gray"

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-10 py-12">
      {Icon && (
        <div className="flex justify-center items-center w-12 h-12 rounded-full bg-white-100 shadow-lg mb-4">
          <Icon size={22} className={`${color} ${spin ? "animate-spin" : ""}`} />
        </div>
      )}
      {title && <h3 className={`text-base font-semibold ${color} mb-2`}>{title}</h3>}
      <p className={`text-sm ${color} leading-relaxed max-w-[280px]`}>{message}</p>
    </div>
  )
}
