// What kind of support a need asks for (needs.support_type, see
// 20261013000300_need_support_type.sql): goods, money or both. Plain helpers,
// shared by the pages (components/need-support-type.tsx) and the API routes.

export type SupportType = "goods" | "money" | "both"

export const SUPPORT_TYPES: { value: SupportType; label: string; hint: string }[] = [
  { value: "goods", label: "Goods", hint: "Items or help - givers offer them" },
  { value: "money", label: "Money", hint: "Funds only - givers donate" },
  { value: "both", label: "Goods & money", hint: "Givers can do either" },
]

export type NeedLike = { support_type?: string | null; target_amount?: number | string | null; quantity?: string | null }

/** The need's support type - from the column, or worked out from its fields for older data. */
export function needSupportType(need: NeedLike): SupportType {
  if (need.support_type === "goods" || need.support_type === "money" || need.support_type === "both") return need.support_type
  const hasTarget = need.target_amount !== null && need.target_amount !== undefined && need.target_amount !== ""
  if (hasTarget && need.quantity) return "both"
  return hasTarget ? "money" : "goods"
}

export const acceptsMoney = (need: NeedLike) => needSupportType(need) !== "goods"
export const acceptsGoods = (need: NeedLike) => needSupportType(need) !== "money"

/** Checks a need's support fields; returns an error message, or null when they're fine. */
export function supportFieldsProblem(fields: { support_type?: unknown; quantity?: unknown; target_amount?: unknown }): string | null {
  const type = fields.support_type
  if (type !== "goods" && type !== "money" && type !== "both") return "Choose whether this need is for goods, money or both."
  const quantity = typeof fields.quantity === "string" ? fields.quantity.trim() : ""
  const target = fields.target_amount === null || fields.target_amount === undefined || fields.target_amount === "" ? null : Number(fields.target_amount)
  if (type !== "money" && !quantity) return "Enter the quantity of goods needed."
  if (type !== "goods" && (target === null || !Number.isFinite(target) || target <= 0)) return "Enter a money target greater than zero."
  return null
}
