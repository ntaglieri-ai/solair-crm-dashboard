import Link from "next/link"
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Flame,
  MapPinned,
  Sparkles,
  Users,
} from "lucide-react"
import { requirePage } from "@/lib/permissions/server"
import { getDashboardData, type DashboardLead } from "@/lib/dashboard/repository"
import { ItalyMap } from "@/components/dashboard/italy-map"
import { Noticeboard } from "@/components/dashboard/noticeboard"

function LeadQueue({
  leads,
  empty,
}: {
  leads: DashboardLead[]
  empty: string
}) {
  if (leads.length === 0) {
    return (
      <div className="flex min-h-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-6 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {leads.slice(0, 5).map((lead) => (
        <Link
          key={lead.id}
          href={`/leads/${lead.id}`}
          className="group flex min-h-16 items-center justify-between gap-4 rounded-lg border border-transparent px-4 py-3 transition-all hover:border-border hover:bg-card hover:shadow-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-foreground">{lead.nome}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {[lead.stato, lead.sede].filter(Boolean).join(" · ") || "Dati da completare"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lead.valutazione > 0 ? (
              <span className="rounded-md bg-[#fff1d6] px-2.5 py-1 text-xs font-bold text-[#9a5b00]">
                {lead.valutazione}
              </span>
            ) : null}
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  )
}

const ROLE_MANAGERS = new Set(["SUPERADMIN", "ADMIN", "DIRECTOR"])

export default async function DashboardPage() {
  const permissions = await requirePage("dashboard")
  const data = await getDashboardData()
  const subject = permissions.snapshot.subject

  return (
    <div className="mx-auto flex max-w-[1520px] flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <Sparkles className="size-4" />
            Il tuo spazio di lavoro
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
            Buongiorno, {subject.nome.split(" ")[0]}
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Comunicazioni, priorità e territorio in un’unica vista.
          </p>
        </div>
        <Link
          href="/leads"
          className="group flex min-h-12 items-center gap-3 rounded-lg bg-[#1e3a5f] px-5 text-[15px] font-bold text-white shadow-[0_12px_30px_rgba(30,58,95,.2)] transition-all hover:-translate-y-0.5 hover:bg-[#294d79]"
        >
          Apri area Lead
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </header>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Noticeboard
          initialItems={data.noticeboard}
          canManage={ROLE_MANAGERS.has(subject.ruoloCode)}
          author={subject.nome}
        />

        <section className="overflow-hidden rounded-lg border border-border bg-[#0f2945] text-white shadow-[0_20px_55px_rgba(15,41,69,.18)]">
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[#72d5b8]">
                <MapPinned className="size-5" />
                Presenza sul territorio
              </div>
              <h2 className="mt-2 text-2xl font-bold">Sedi Solair</h2>
              <p className="mt-1 text-sm text-white/65">Sedi operative configurate nel CRM</p>
            </div>
            <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold">
              {data.mapMarkers.length} sedi
            </span>
          </div>
          <div className="h-[390px] px-4 pb-4">
            <ItalyMap markers={data.mapMarkers} dark />
          </div>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/leads" className="dashboard-signal group border-[#cbd8ff] bg-[#eef3ff]">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[#4f7cff] text-white">
            <Users className="size-6" />
          </span>
          <span>
            <strong>{data.counts.leads.toLocaleString("it-IT")}</strong>
            <small>Lead attivi nel CRM</small>
          </span>
          <ArrowRight className="ml-auto size-5 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/clienti" className="dashboard-signal group border-[#bfe7da] bg-[#e9f8f2]">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[#2e9f7b] text-white">
            <BriefcaseBusiness className="size-6" />
          </span>
          <span>
            <strong>{data.counts.clienti.toLocaleString("it-IT")}</strong>
            <small>Clienti registrati</small>
          </span>
          <ArrowRight className="ml-auto size-5 transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/scadenze" className="dashboard-signal group border-[#ffd9ba] bg-[#fff3e8]">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[#f28b39] text-white">
            <CalendarClock className="size-6" />
          </span>
          <span>
            <strong>{data.counts.scadenze.toLocaleString("it-IT")}</strong>
            <small>Scadenze da gestire</small>
          </span>
          <ArrowRight className="ml-auto size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <Flame className="size-5 text-[#f05b50]" />
                Lead da seguire
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Priorità calcolate sui dati correnti
              </p>
            </div>
            <Link href="/leads" className="text-sm font-bold text-primary hover:underline">
              Vedi tutti
            </Link>
          </div>
          <LeadQueue
            leads={data.hotLeads}
            empty="Non ci sono lead con valutazione superiore a 80."
          />
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Ultimi ingressi</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                I lead acquisiti più recentemente
              </p>
            </div>
            <Link href="/leads" className="text-sm font-bold text-primary hover:underline">
              Apri elenco
            </Link>
          </div>
          <LeadQueue leads={data.recentLeads} empty="Nessun lead recente." />
        </section>
      </div>
    </div>
  )
}
