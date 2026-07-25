import { useEffect, useState } from "react"

// Keeps a list's on-screen order frozen while `hovering` is true (e.g. while
// the user has their mouse over one of its cards, adjusting score/progress),
// so a re-sort triggered by that same edit can't shuffle a different item
// under the cursor mid-interaction. Items' own data still updates live —
// only their position is held still. Re-syncs to the live order as soon as
// hovering ends, and reconciles additions/removals even while frozen: an
// item arriving mid-hover (e.g. moving from a sibling list, such as Behind
// into Caught-Up) is inserted at the position `liveList`'s own order implies
// relative to the still-frozen items, rather than always landing last.
export function useStableOrder<T extends { id: number }>(liveList: T[], hovering: boolean): T[] {
  const liveIds = liveList.map((item) => item.id)
  const liveKey = liveIds.join(",")

  const [frozenIds, setFrozenIds] = useState<number[]>(liveIds)

  useEffect(() => {
    if (!hovering) {
      setFrozenIds(liveIds)
    }
    // liveKey is a stable stand-in for liveIds (a fresh array every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey, hovering])

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
