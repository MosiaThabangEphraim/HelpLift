"use client"

import { LayoutGrid, List } from "lucide-react"

export type ListView = "grid" | "list"

// A small grid/list switch for any page listing many cards (needs, gifts,
// organizations...) - the caller owns the view state and picks its own grid
// classes for each mode; this is just the two buttons.
export function ViewToggle({ view, onChange }: { view: ListView; onChange: (view: ListView) => void }) {
  return (
    <div className="flex items-center gap-1 rounded border border-slate-200 dark:border-[#233350] p-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-label="Show as grid"
        aria-pressed={view === "grid"}
        data-tip="Show as a grid"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          view === "grid" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-label="Show as list"
        aria-pressed={view === "list"}
        data-tip="Show as a list"
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
          view === "list" ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1A2740]"
        }`}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  )
}
