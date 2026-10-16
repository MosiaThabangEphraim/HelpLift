"use client"

// What kind of support a need asks for (needs.support_type, see
// 20261013000300_need_support_type.sql): goods, money or both. Organizations
// choose it when they create or edit a need; it decides which fields are
// required and what givers can do (donate money and/or offer goods/help).

import { SUPPORT_TYPES, needSupportType, type NeedLike, type SupportType } from "@/lib/need-support-type"
export { acceptsGoods, acceptsMoney, needSupportType, supportFieldsProblem, SUPPORT_TYPES, type SupportType } from "@/lib/need-support-type"

/** A small quiet label: "Goods", "Money" or "Goods & money". */
export function SupportTypeLabel({ need, className = "" }: { need: NeedLike; className?: string }) {
  const type = needSupportType(need)
  return (
    <span className={`inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 ${className}`}>
      {SUPPORT_TYPES.find(option => option.value === type)?.label}
    </span>
  )
}

type Fields = { support_type: string; quantity: string; target_amount: string }

/**
 * The "What do you need?" choice plus the fields it calls for: a quantity for
 * goods, a money target for money (both for "Goods & money").
 */
export function NeedSupportFields<T extends Fields>({ value, onChange }: { value: T; onChange: (next: T) => void }) {
  const type = value.support_type as SupportType | ""
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="pl-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">What do you need? (required)</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What do you need?">
          {SUPPORT_TYPES.map(option => {
            const selected = type === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...value, support_type: option.value })}
                className={`rounded-xl px-3 py-2.5 max-sm:px-2 max-sm:text-center text-left transition-colors ${
 selected
 ? "bg-blue-600 text-white "
 : "bg-slate-100 dark:bg-[#1A2740] text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#233350]"
 }`}
              >
                <span className="block text-sm font-bold">{option.label}</span>
                <span className={`block text-[11px] leading-snug max-sm:hidden ${selected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}>{option.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      {type && (
        <div className={`grid grid-cols-1 gap-3 ${type === "both" ? "sm:grid-cols-2" : ""}`}>
          {type !== "money" && (
            <label className="space-y-1">
              <span className="pl-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Quantity of goods (required)</span>
              <input
                required
                placeholder="e.g. 50 boxes"
                value={value.quantity}
                onChange={e => onChange({ ...value, quantity: e.target.value })}
                className="field"
              />
            </label>
          )}
          {type !== "goods" && (
            <label className="space-y-1">
              <span className="pl-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">Money target in Rands (required)</span>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 15000"
                value={value.target_amount}
                onChange={e => onChange({ ...value, target_amount: e.target.value })}
                className="field"
              />
            </label>
          )}
        </div>
      )}
    </div>
  )
}
