"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Building2, ImageUp, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SectionHeader } from "@/components/impostazioni/settings-ui"
import { usePersistentSystemSetting } from "@/lib/crm-settings/use-persistent-system-setting"
import { usePermissions } from "@/lib/permissions/provider"

type CompanyProfile = {
  legalName: string
  vatNumber: string
  taxCode: string
  email: string
  phone: string
  website: string
  registeredOffice: string
  pec: string
  description: string
  logoUrl: string
}

const EMPTY_PROFILE: CompanyProfile = {
  legalName: "",
  vatNumber: "",
  taxCode: "",
  email: "",
  phone: "",
  website: "",
  registeredOffice: "",
  pec: "",
  description: "",
  logoUrl: "",
}

export default function CompanyPage() {
  const permissions = usePermissions()
  const canEdit = permissions.canAction("company.profile.edit")
  const [stored, setStored, store] = usePersistentSystemSetting<CompanyProfile>(
    "company.profile",
    EMPTY_PROFILE,
  )
  const [form, setForm] = useState(stored)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => setForm(stored))
  }, [stored])

  function update<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function uploadLogo(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/crm-settings/company/logo", {
        method: "POST",
        body,
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? "Upload non riuscito")
      update("logoUrl", payload.url)
      toast.success("Logo caricato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload non riuscito")
    } finally {
      setUploading(false)
    }
  }

  function save() {
    setStored(form)
    toast.success("Informazioni aziendali salvate")
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Informazioni aziendali"
        description={
          canEdit
            ? "Identità e riferimenti ufficiali utilizzati nel CRM."
            : "Informazioni aziendali disponibili in sola lettura."
        }
        action={
          canEdit ? (
            <Button onClick={save} disabled={store.saving}>
              {store.saving ? <Loader2 className="animate-spin" /> : <Save />}
              Salva
            </Button>
          ) : undefined
        }
      />

      {store.error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {store.error}
        </p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <span className="text-sm font-semibold">Logo aziendale</span>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/40">
            {form.logoUrl ? (
              <Image
                src={form.logoUrl}
                alt="Logo aziendale"
                width={220}
                height={140}
                unoptimized
                className="max-h-full max-w-full object-contain p-5"
              />
            ) : (
              <Building2 className="size-10 text-muted-foreground" />
            )}
          </div>
          {canEdit ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadLogo(file)
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />}
                Carica logo
              </Button>
            </>
          ) : null}
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
          <Field label="Ragione sociale" value={form.legalName} disabled={!canEdit} onChange={(value) => update("legalName", value)} />
          <Field label="Partita IVA" value={form.vatNumber} disabled={!canEdit} onChange={(value) => update("vatNumber", value)} />
          <Field label="Codice fiscale" value={form.taxCode} disabled={!canEdit} onChange={(value) => update("taxCode", value)} />
          <Field label="Email" value={form.email} disabled={!canEdit} onChange={(value) => update("email", value)} />
          <Field label="PEC" value={form.pec} disabled={!canEdit} onChange={(value) => update("pec", value)} />
          <Field label="Telefono" value={form.phone} disabled={!canEdit} onChange={(value) => update("phone", value)} />
          <Field label="Sito web" value={form.website} disabled={!canEdit} onChange={(value) => update("website", value)} />
          <Field label="Sede legale" value={form.registeredOffice} disabled={!canEdit} onChange={(value) => update("registeredOffice", value)} />
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="company-description">Descrizione</Label>
            <Textarea
              id="company-description"
              value={form.description}
              disabled={!canEdit}
              onChange={(event) => update("description", event.target.value)}
              rows={4}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const id = `company-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
