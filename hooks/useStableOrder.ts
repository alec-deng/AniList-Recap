import { useRef } from "react"

// Freezes a list's on-screen order while `hovering`, so an edit's own re-sort
// can't shuffle a different item under the cursor mid-interaction. Item data
// still updates live; only position holds. New/removed items are reconciled
// even while frozen, inserted at the position liveList's order implies.
export function useStableOrder<T extends { id: number }>(liveList: T[], hovering: boolean): T[] {
  const liveIds = liveList.map((item) => item.id)

  // A ref, not state+effect: the reorder animation re-freezes within a frame of
  // releasing, and an effect-timeline update would hand back the pre-release order.
  const frozenIdsRef = useRef<number[]>(liveIds)
  if (!hovering) frozenIdsRef.current = liveIds
  const frozenIds = frozenIdsRef.current

  if (!hovering) {
    return liveList
  }

  const byId = new Map(liveList.map((item) => [item.id, item]))
  const liveIndexById = new Map(liveIds.map((id, index) => [id, index]))
  const frozenSet = new Set(frozenIds)

  const result = frozenIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  const newOnes = liveList.filter((item) => !frozenSet.has(item.id))

  for (const item of newOnes) {
    const liveIndex = liveIndexById.get(item.id)!
    const insertAt = result.findIndex((existing) => liveIndexById.get(existing.id)! > liveIndex)
    if (insertAt === -1) {
      result.push(item)
    } else {
      result.splice(insertAt, 0, item)
    }
  }

  return result
}
