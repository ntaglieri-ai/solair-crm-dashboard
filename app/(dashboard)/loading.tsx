export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1540px] animate-pulse flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-10 w-72 rounded-md bg-muted" />
          <div className="h-5 w-96 max-w-full rounded bg-muted/75" />
        </div>
        <div className="h-11 w-36 rounded-lg bg-muted" />
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-4 h-8 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid min-h-[420px] gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-6 w-44 rounded bg-muted" />
          <div className="mt-6 h-[320px] rounded-lg bg-muted/65" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-6 w-36 rounded bg-muted" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-12 rounded-md bg-muted/65" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
