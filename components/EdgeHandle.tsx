import React, { useEffect, useRef, useState } from "react"

// The native scrollbar is hidden in popup.css (it takes layout width, and Chrome
// sizes the popup window to its document, so it widened the window sideways).
// This replaces it with a D-shaped handle riding the right edge: flat against
// the window, rounded inward, accent-coloured and shadowed.
//
// A floating shape rather than a flat bar because a bar flush to the edge has to
// read convincingly on both the near-black header and the light list, and no
// single flat colour manages that. A shadowed widget reads as sitting *above*
// whatever is behind it, so the background stops mattering — which is also why
// it sits above the header rather than being occluded by it.

// Fixed size, unlike a proportional thumb: it's a grab handle, not a length
// indicator, so it stays comfortable to hit however long the list is.
const HANDLE_HEIGHT = 30
const RESTING_WIDTH = 15
const ACTIVE_WIDTH = 19
// Grab area reaching inward from the edge, so the handle is easy to catch
const HIT_WIDTH = 30
const TRACK_PADDING = 10
// How long it lingers after the last scroll before fading out
const IDLE_HIDE_MS = 1100
// Reaching for it counts from well before the pointer arrives, so it has faded
// in by the time the cursor is there
const EDGE_ZONE = 48
const RESTING_OPACITY = 0.9

type Metrics = { top: number; visible: boolean }

const HIDDEN: Metrics = { top: 0, visible: false }

// Shared by the measure pass and the drag handler — they have to agree on the
// travel distance or a drag drifts away from the handle under the pointer
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

  // A sub-pixel overflow isn't worth a control
  const maxScroll = content - viewport
  if (maxScroll <= 1 || travel <= 0) return HIDDEN

  return { top: TRACK_PADDING + (window.scrollY / maxScroll) * travel, visible: true }
}

// Three short rules, the usual shorthand for "this is draggable"
const Grip: React.FC = () => (
  <span className="flex flex-col items-center justify-center gap-[3px]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 8,
          height: 2,
          borderRadius: 1,
          background: "rgba(255, 255, 255, 0.8)"
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

  // Held in a ref so the scroll, pointer and drag handlers can all call it
  // without re-subscribing on every render
  const refreshRef = useRef(() => {})
  refreshRef.current = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setRevealed(true)
    // Hovering the edge or holding a drag keeps it up indefinitely
    if (nearEdgeRef.current || dragRef.current) return
    hideTimerRef.current = setTimeout(() => setRevealed(false), IDLE_HIDE_MS)
  }

  useEffect(() => {
    const sync = () => setMetrics(measureHandle())
    sync()
    // Shows itself once on open, then fades — otherwise nothing announces that
    // the list scrolls at all
    refreshRef.current()

    const handleScroll = () => {
      sync()
      refreshRef.current()
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    // Tab switches and list edits change height without scrolling. Measure
    // only, since that isn't the user reaching for the control.
    const observer = new ResizeObserver(sync)
    observer.observe(document.documentElement)
    observer.observe(document.body)

    return () => {
      window.removeEventListener("scroll", handleScroll)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    // Only acted on at the boundary, so moving around inside the popup doesn't
    // restart the timer on every frame
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

  // Listeners live on window, not the handle, so a fast drag that outruns the
  // pointer doesn't drop the gesture
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
      setActive(false)
      // Restarts the idle countdown the drag was holding off
      refreshRef.current()
    }

    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [])

  if (!metrics.visible) return null

  return (
    // pointer-events stay off the strip so it never eats a click meant for the
    // content behind it; only the handle is grabbable
    <div
      className="fixed top-0 right-0 h-full z-50 pointer-events-none"
      style={{
        width: HIT_WIDTH,
        opacity: revealed ? (active ? 1 : RESTING_OPACITY) : 0,
        transition: "opacity 220ms ease"
      }}
    >
      <div
        // active: is the :active pseudo-class — held mouse button — so the grab
        // cursor tracks the drag without needing state
        className="absolute right-0 flex items-center justify-end pointer-events-auto cursor-grab active:cursor-grabbing"
        style={{ top: metrics.top, height: HANDLE_HEIGHT, width: HIT_WIDTH }}
        onPointerEnter={() => setActive(true)}
        onPointerLeave={() => {
          if (!dragRef.current) setActive(false)
        }}
        onPointerDown={(e) => {
          e.preventDefault()
          dragRef.current = { pointerY: e.clientY, scrollTop: window.scrollY }
          setActive(true)
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: active ? ACTIVE_WIDTH : RESTING_WIDTH,
            height: HANDLE_HEIGHT,
            // Flat against the window, rounded inward — a half-pill whose left
            // cap is a semicircle of half the handle's height
            borderRadius: `${HANDLE_HEIGHT / 2}px 0 0 ${HANDLE_HEIGHT / 2}px`,
            // Inherited from the popup root, so it follows the AniList account
            background: "var(--profile-color, #3db4f2)",
            // Thrown inward, since the handle is flush with the right edge
            boxShadow: "-2px 1px 6px rgba(16, 22, 40, 0.32)",
            transition: "width 150ms ease"
          }}
        >
          <Grip />
        </div>
      </div>
    </div>
  )
}
