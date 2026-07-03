import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { createClient } from "@supabase/supabase-js"

const PROFILE_ROLE_MAP = new Map([
  ["Administrator", "ADMIN"],
  ["Direttore", "DIRECTOR"],
  ["Superdirettore", "DIRECTOR"],
  ["Agente", "AGENT"],
  ["Standard", "STANDARD"],
])

const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const inputArg = process.argv.find((arg) => arg.startsWith("--input="))
const inputPath = path.resolve(
  inputArg?.slice("--input=".length) ??
    process.env.ZOHO_USERS_FILE ??
    path.join(process.env.HOME ?? "", "Downloads", "Zoho_Users_2026_07_03.json"),
)

function normalizeZohoId(value) {
  return String(value ?? "").replace(/^zcrm_/, "").trim()
}

function normalizeUser(user) {
  const profileName = user.profile?.name ?? null
  const suggestedRoleCode = PROFILE_ROLE_MAP.get(profileName) ?? "STANDARD"

  return {
    zoho_id: normalizeZohoId(user.id),
    full_name: String(user.full_name ?? "").trim(),
    email: String(user.email ?? "").trim().toLowerCase(),
    status: String(user.status ?? "").toLowerCase(),
    role_id: normalizeZohoId(user.role?.id) || null,
    role_name: user.role?.name ?? null,
    profile_id: normalizeZohoId(user.profile?.id) || null,
    profile_name: profileName,
    reporting_to_id: normalizeZohoId(user.Reporting_To?.id) || null,
    reporting_to_name: user.Reporting_To?.name ?? null,
    suggested_role_code: suggestedRoleCode,
  }
}

function validate(users) {
  const errors = []
  const ids = new Set()
  const activeEmails = new Set()

  for (const user of users) {
    if (!user.zoho_id) errors.push("Utente senza Zoho ID")
    if (!user.full_name) errors.push(`Utente ${user.zoho_id || "?"} senza nome`)
    if (!user.email) errors.push(`Utente ${user.zoho_id || "?"} senza email`)
    if (!["active", "inactive", "deleted"].includes(user.status)) {
      errors.push(`Stato non supportato per ${user.full_name}: ${user.status}`)
    }
    if (ids.has(user.zoho_id)) errors.push(`Zoho ID duplicato: ${user.zoho_id}`)
    ids.add(user.zoho_id)

    if (user.status === "active") {
      if (activeEmails.has(user.email)) {
        errors.push(`Email attiva duplicata: ${user.email}`)
      }
      activeEmails.add(user.email)
    }

    if (user.suggested_role_code === "SUPERADMIN") {
      errors.push(`Escalation Superadmin vietata per ${user.full_name}`)
    }
  }

  return errors
}

function summarize(users) {
  const countBy = (field) =>
    Object.fromEntries(
      [...users.reduce((counts, user) => {
        const value = user[field] ?? "(vuoto)"
        counts.set(value, (counts.get(value) ?? 0) + 1)
        return counts
      }, new Map())].sort(([a], [b]) => String(a).localeCompare(String(b))),
    )

  return {
    input: inputPath,
    mode: apply ? "apply" : "dry-run",
    total: users.length,
    activeToPromote: users.filter((user) => user.status === "active").length,
    historicalOnly: users.filter((user) => user.status !== "active").length,
    byStatus: countBy("status"),
    byProfile: countBy("profile_name"),
    roleMapping: countBy("suggested_role_code"),
  }
}

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"))
const sourceUsers = Array.isArray(payload) ? payload : payload.users
if (!Array.isArray(sourceUsers)) {
  throw new Error("Il file Zoho non contiene un array users valido.")
}

const users = sourceUsers.map(normalizeUser)
const validationErrors = validate(users)
console.log(JSON.stringify(summarize(users), null, 2))

if (validationErrors.length > 0) {
  console.error(JSON.stringify({ validationErrors }, null, 2))
  process.exit(1)
}

if (!apply) {
  console.log("Dry-run completato. Nessun dato scritto su Supabase.")
  process.exit(0)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Per --apply servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
  )
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { error: stagingError } = await supabase
  .from("zoho_user_staging")
  .upsert(
    users.map((user) => ({
      ...user,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "zoho_id" },
  )
if (stagingError) throw new Error(`Staging utenti Zoho: ${stagingError.message}`)

const { data: roles, error: rolesError } = await supabase
  .from("ruoli")
  .select("id, code")
if (rolesError) throw new Error(`Lettura ruoli CRM: ${rolesError.message}`)
const roleIds = new Map((roles ?? []).map((role) => [role.code, role.id]))

const activeUsers = users.filter((user) => user.status === "active")
const crmRows = activeUsers.map((user) => {
  const roleId = roleIds.get(user.suggested_role_code)
  if (!roleId) throw new Error(`Ruolo CRM assente: ${user.suggested_role_code}`)

  return {
    zoho_id: user.zoho_id,
    nome: user.full_name,
    email: user.email,
    ruolo: user.suggested_role_code,
    ruolo_id: roleId,
    attivo: true,
    updated_at: new Date().toISOString(),
  }
})

const { data: promoted, error: usersError } = await supabase
  .from("utenti")
  .upsert(crmRows, { onConflict: "zoho_id" })
  .select("id, zoho_id")
if (usersError) throw new Error(`Promozione utenti CRM: ${usersError.message}`)

const promotedIds = new Map((promoted ?? []).map((user) => [user.zoho_id, user.id]))
for (const [zohoId, crmUserId] of promotedIds) {
  const { error } = await supabase
    .from("zoho_user_staging")
    .update({ crm_user_id: crmUserId, updated_at: new Date().toISOString() })
    .eq("zoho_id", zohoId)
  if (error) throw new Error(`Collegamento utente ${zohoId}: ${error.message}`)
}

console.log(
  JSON.stringify(
    {
      staged: users.length,
      promoted: promoted?.length ?? 0,
      invitationsSent: 0,
      authUsersCreated: 0,
    },
    null,
    2,
  ),
)
