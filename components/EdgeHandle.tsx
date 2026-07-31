import React, { useEffect, useRef, useState } from "react"

// Replaces the native scrollbar, hidden in popup.css — see CLAUDE.md for why.

// Container, not the shape — must stay constant or hover changes travel
const HANDLE_HEIGHT = 40
const RESTING_WIDTH = 7
const RESTING_HEIGHT = 28
const ACTIVE_WIDTH = 20
const ACTIVE_HEIGHT = 40
const GRIP_INSET = 4
const HIT_WIDTH = 30
const TRACK_PADDING = 10
const IDLE_HIDE_MS = 1100
const EDGE_ZONE = 48
const RESTING_OPACITY = 0.9

type Metrics = { top: number; visible: boolean }

const HIDDEN: Metrics = { top: 0, visible: false }

// Elliptical: a circular radius is capped at the width, flattening the resting cap
const capRadius = (width: number, height: number) => {
  const rx = Math.min(width, height / 2)
  const ry = height / 2
  return `${rx}px 0 0 ${rx}px / ${ry}px 0 0 ${ry}px`
}

// Shared with the drag handler — they must agree on travel or a drag drifts
const geometry = () => {
  const doc = document.documentElement
  const viewport = doc.clientHeight
  const content = doc.scrollHeight
  return {
    viewport,
    content,
    travel: viewport - TRACK_PADDING * 2 - HANDLE_HEIGHT
  }
}

const measureHandle = (): Metrics => {
  const { viewport, content, travel } = geometry()

  const maxScroll = content - viewport
  if (maxScroll <= 1 || travel <= 0) return HIDDEN

  return { top: TRACK_PADDING + (window.scrollY / maxScroll) * travel, visible: true }
}

const Grip: React.FC<{ shown: boolean }> = ({ shown }) => (
  <span
    className="flex flex-col items-center justify-center gap-[3px]"
    aria-hidden="true"
    style={{
      opacity: shown ? 1 : 0,
      // Leaves faster than the 150ms shrink, or it spills out of the handle
      transition: shown ? "opacity 120ms ease 60ms" : "opacity 70ms ease"
    }}
  >
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 8,
          height: 2,
          borderRadius: 1,
          background: "rgba(255, 255, 255, 0.85)"
        }}
      />
    ))}
  </span>
)

export const EdgeHandle: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>(HIDDEN)
  const [active, setActive] = useState(false)
  const [revealed, setRevealed] = useState(true)
  const dragRef = useRef<{ pointerY: number; scrollTop: number } | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nearEdgeRef = useRef(false)

  // In a ref so every handler can call it without re-subscribing each render
  const refreshRef = useRef(() => {})
  refreshRef.current = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setRevealed(true)
    if (nearEdgeRef.current || dragRef.current) return
    hideTimerRef.current = setTimeout(() => setRevealed(false), IDLE_HIDE_MS)
  }

  useEffect(() => {
    const sync = () => setMetrics(measureHandle())
    sync()
    refreshRef.current()

    const handleScroll = () => {
      sync()
      refreshRef.current()
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // Measure only: a height change isn't the user reaching for the control
    const observer = new ResizeObserver(sync)
    observer.observe(document.documentElement)
    observer.observe(document.body)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    // Acted on at the boundary only, or every frame of movement restarts the timer
    const handlePointerMove = (e: PointerEvent) => {
      const near = e.clientX >= window.innerWidth - EDGE_ZONE
      if (near === nearEdgeRef.current) return
      nearEdgeRef.current = near
      refreshRef.current()
    }

    // relatedTarget is null only when the pointer leaves the window entirely
    const handlePointerOut = (e: PointerEvent) => {
      if (e.relatedTarget || !nearEdgeRef.current) return
      nearEdgeRef.current = false
      refreshRef.current()
    }

    window.addEventListener("pointermove", handlePointerMove)
    document.addEventListener("pointerout", handlePointerOut)
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("pointerout", handlePointerOut)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  // On window, not the handle, so a drag that outruns the pointer isn't dropped
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const { viewport, content, travel } = geometry()
      if (travel <= 0) return

      const moved = (e.clientY - drag.pointerY) / travel
      window.scrollTo({ top: drag.scrollTop + moved * (content - viewport) })
    }

    const handleUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.userSelect = ""
      setActive(false)
      refreshRef.current()
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      // Unmounting mid-drag would otherwise leave the page unselectable
      document.body.style.userSelect = ""
    }
  }, [])

  if (!metrics.visible) return null

  return (
    // pointer-events off the strip, or it eats clicks meant for the content
    <div
      className="fixed top-0 right-0 h-full z-50 pointer-events-none"
      style={{
        width: HIT_WIDTH,
        opacity: revealed ? (active ? 1 : RESTING_OPACITY) : 0,
        transition: "opacity 220ms ease"
      }}
    >
      <div
        className="absolute right-0 flex items-center justify-end pointer-events-auto cursor-grab active:cursor-grabbing"
        style={{ top: metrics.top, height: HANDLE_HEIGHT, width: HIT_WIDTH }}
        onPointerEnter={() => setActive(true)}
        onPointerLeave={() => {
          if (!dragRef.current) setActive(false)
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          dragRef.current = { pointerY: e.clientY, scrollTop: window.scrollY }
          // preventDefault alone doesn't stop Firefox selecting as you drag
          document.body.style.userSelect = "none"
          setActive(true)
        }}
      >
        <div
          className="flex items-center justify-end overflow-hidden"
          style={{
            width: active ? ACTIVE_WIDTH : RESTING_WIDTH,
            height: active ? ACTIVE_HEIGHT : RESTING_HEIGHT,
            paddingRight: GRIP_INSET,
            borderRadius: active
              ? capRadius(ACTIVE_WIDTH, ACTIVE_HEIGHT)
              : capRadius(RESTING_WIDTH, RESTING_HEIGHT),
            // Inherited from the popup root, so it follows the account
            background: "var(--profile-color, #3db4f2)",
            boxShadow: "-2px 1px 6px rgba(16, 22, 40, 0.32)",
            transition: "width 150ms ease, height 150ms ease, border-radius 150ms ease"
          }}
        >
          <Grip shown={active} />
        </div>
      </div>
    </div>
  )
}
