export type AppearanceTheme = "light" | "dark" | "system"
export type AppearanceAccent = "navy" | "teal" | "blue"
export type AppearanceDensity = "compact" | "comfortable"
export type AppearanceRadius = "compact" | "soft"

export type AppearancePreferences = {
  theme: AppearanceTheme
  accent: AppearanceAccent
  density: AppearanceDensity
  radius: AppearanceRadius
}

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  theme: "light",
  accent: "navy",
  density: "comfortable",
  radius: "soft",
}

export function normalizeAppearance(value: unknown): AppearancePreferences {
  const input =
    value && typeof value === "object"
      ? (value as Partial<AppearancePreferences>)
      : {}
  return {
    theme: ["light", "dark", "system"].includes(input.theme ?? "")
      ? input.theme!
      : DEFAULT_APPEARANCE.theme,
    accent: ["navy", "teal", "blue"].includes(input.accent ?? "")
      ? input.accent!
      : DEFAULT_APPEARANCE.accent,
    density: ["compact", "comfortable"].includes(input.density ?? "")
      ? input.density!
      : DEFAULT_APPEARANCE.density,
    radius: ["compact", "soft"].includes(input.radius ?? "")
      ? input.radius!
      : DEFAULT_APPEARANCE.radius,
  }
}
