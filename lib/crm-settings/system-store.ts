export const SYSTEM_SETTING_KEYS = [
  "system.sedi",
  "system.attributi",
  "system.valori",
  "system.communication",
  "company.profile",
  "company.integrations.make",
  "maintenance.nextcloud",
  "roberta.knowledge.sources",
] as const

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number]

export function isSystemSettingKey(value: string): value is SystemSettingKey {
  return SYSTEM_SETTING_KEYS.includes(value as SystemSettingKey)
}
