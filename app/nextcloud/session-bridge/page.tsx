import { nextcloudBaseUrl } from "@/lib/nextcloud/config"
import { NextcloudSessionBridgeClient } from "./nextcloud-session-bridge-client"

export const dynamic = "force-dynamic"

function cleanOpenPath(path?: string, fileid?: string) {
  const params = new URLSearchParams({ nc_clean: "1" })
  if (path) params.set("path", path)
  if (fileid && /^\d+$/.test(fileid)) params.set("fileid", fileid)
  return `/api/auth/nextcloud/open?${params.toString()}`
}

export default async function NextcloudSessionBridgePage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; fileid?: string }>
}) {
  const params = await searchParams
  const base = nextcloudBaseUrl()

  return (
    <NextcloudSessionBridgeClient
      logoutUrl={`${base}/apps/user_oidc/sls`}
      continueUrl={cleanOpenPath(params.path, params.fileid)}
    />
  )
}
