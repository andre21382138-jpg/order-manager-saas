import 'server-only'

export const BRAND_COLORS = [
  '#f97316', // orange
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#eab308', // yellow
  '#f43f5e', // rose
] as const

export function pickBrandColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return BRAND_COLORS[hash % BRAND_COLORS.length]
}
