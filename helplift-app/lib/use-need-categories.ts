"use client"

import { useEffect, useState } from "react"
import { NEED_CATEGORIES } from "@/lib/categories"

// Need categories, admin-managed (Platform Settings). Starts from the
// hardcoded default list (so the UI never shows an empty dropdown while the
// request is in flight, or if it fails) and swaps in the live list once
// fetched.
export function useNeedCategories(): string[] {
  const [categories, setCategories] = useState<string[]>([...NEED_CATEGORIES])

  useEffect(() => {
    let cancelled = false
    fetch("/api/public/need-categories")
      .then(res => res.json())
      .then(data => { if (!cancelled && Array.isArray(data.categories) && data.categories.length > 0) setCategories(data.categories) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return categories
}
