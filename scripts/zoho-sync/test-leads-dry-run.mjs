import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { createClient } from "@supabase/supabase-js"

const repoRoot = process.cwd()
const defaultCsv = "/Users/imacnando/Downloads/Lead_2026_08_15.csv"

function argument(name, fallback = null) {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function loadEnvLocal() {
  const envPath = path.join(repoRoot, ".env.local")
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "")
  }
}

function compileZohoSyncLib() {
  const outDir = path.join(repoRoot, ".next/cache", `zoho-sync-${process.pid}-${Date.now()}`)
  const args = [
    "exec",
    "tsc",
    "--target",
    "ES2022",
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--esModuleInterop",
    "--skipLibCheck",
    "--strict",
    "--noEmit",
    "false",
    "--rootDir",
    repoRoot,
    "--outDir",
    outDir,
    path.join(repoRoot, "lib/zoho-sync/runner.ts"),
  ]
  const result = spawnSync("pnpm", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.status !== 0) {
    process.stderr.write(result.stdout)
    process.stderr.write(result.stderr)
    throw new Error("Compilazione temporanea lib/zoho-sync fallita")
  }
  return path.join(outDir, "lib/zoho-sync/runner.js")
}

function printSummary(result, logToDatabase) {
  const { stats, runId } = result
  console.log(JSON.stringify({
    mode: "dry_run",
    databaseLogging: logToDatabase,
    runId,
    csvRows: stats.csvRows,
    mappedRows: stats.mappedRows,
    create: stats.create,
    update: stats.update,
    skip: stats.skip,
    conflict: stats.conflict,
    error: stats.error,
    duplicateZohoIds: stats.duplicateZohoIds,
    missingZohoIds: stats.missingZohoIds,
    unresolvedOwnerIds: stats.unresolvedOwnerIds,
    unmappedHeaders: stats.unmappedHeaders,
  }, null, 2))
}

loadEnvLocal()

const csvPath = argument("csv", defaultCsv)
const logToDatabase = !process.argv.includes("--no-db-log")
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in env/.env.local")
}
if (!fs.existsSync(csvPath)) {
  throw new Error(`CSV non trovato: ${csvPath}`)
}

const runnerPath = compileZohoSyncLib()
const require = createRequire(import.meta.url)
const { runLeadDryRun } = require(runnerPath)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const result = await runLeadDryRun({ csvPath, supabase, logToDatabase })
printSummary(result, logToDatabase)
