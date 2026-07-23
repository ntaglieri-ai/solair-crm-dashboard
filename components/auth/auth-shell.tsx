// components/auth/auth-shell.tsx
// Guscio visivo condiviso per le pagine di autenticazione (login, recupero
// password, cambio password). Il pannello sinistro e' il "momento firma":
// fotografia golden-hour di un impianto trattata con un duotone di marca
// (navy scuro in alto/ai bordi, caldo ambra/arancio verso il centro-basso
// dove sta il testo) + tipografia editoriale + la barra accento firma in
// cima a tutta la pagina — lo stesso gradiente delle "premium card" della
// dashboard, cosi' il login e' visivamente continuo con il resto dell'app.
import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"

// Sulla pagina di login non c'e' sessione: l'endpoint del logo aziendale
// richiede auth, quindi qui si usa sempre il default hardcoded, stessa
// logica di fallback di components/dashboard/sidebar.tsx per utenti non
// autenticati.
const BRAND_LOGO = "/solair-brand-logo.png"

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#EEF1F9] via-white to-[#eaf5ef]">
      {/* Barra accento firma su TUTTA la pagina — filo conduttore visivo con
          le card della dashboard (stesso gradiente blu->verde->ambra->arancio). */}
      <div className="absolute inset-x-0 top-0 z-30 h-1 bg-[linear-gradient(90deg,#315fc5,#20a47a,#f2b84b,#ef6a47)]" />

      <div className="min-h-screen lg:grid lg:grid-cols-2">
        {/* Pannello immagine — solo desktop. Su mobile il logo passa nel
            pannello destro, altrimenti sparirebbe del tutto. */}
        <div className="relative hidden overflow-hidden bg-[#0f2032] lg:flex lg:flex-col lg:justify-between">
          <img
            src="/auth-solar.jpg"
            alt="Impianto fotovoltaico Solair al tramonto"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          {/* Duotone di marca: (1) direzionale navy — scuro in alto, scuro in
              basso per la leggibilita' del testo; (2) velo caldo ambra/arancio
              dal basso in mix-blend-overlay che "accende" la foto senza
              coprirla; (3) vignettatura che scurisce i bordi lasciando il
              centro-basso piu' aperto e caldo. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#132437]/75 via-[#132437]/10 to-[#0f2032]/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#ef6a47]/25 via-[#f2b84b]/8 to-transparent mix-blend-overlay" />
          <div className="absolute inset-0 bg-[radial-gradient(135%_100%_at_50%_78%,transparent_38%,rgba(15,32,50,0.8)_100%)]" />

          {/* Logo bianco pieno, grande, senza contenitore. */}
          <div className="relative z-10 p-10 lg:p-12">
            <img
              src={BRAND_LOGO}
              alt="Solair Group"
              className="h-14 w-auto brightness-0 invert drop-shadow-md xl:h-16"
            />
          </div>

          {/* Blocco editoriale: eyebrow piccolo/maiuscolo molto spaziato +
              tagline in scala grande, compatta, sicura. */}
          <div className="relative z-10 p-10 lg:p-12">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#7fe0c0]">
              Il centro di controllo di Solair Group
            </p>
            <p className="max-w-md text-4xl font-extrabold leading-[1.05] tracking-tight text-white [text-shadow:0_2px_24px_rgba(9,20,33,0.55)] lg:text-5xl">
              Lead, clienti e impianti, tutto in un unico posto.
            </p>
          </div>
        </div>

        {/* Pannello form */}
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <img src={BRAND_LOGO} alt="Solair Group" className="h-11 w-auto" />
            </div>

            <div className="text-center lg:text-left">
              {eyebrow && (
                <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-primary lg:justify-start">
                  <Sparkles className="size-4" />
                  {eyebrow}
                </div>
              )}
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1E3A5F] lg:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground lg:text-base">{subtitle}</p>
            </div>

            {/* Ingresso sobrio una tantum (fade + slide-up) via tw-animate-css. */}
            <div className="dashboard-premium-card mt-6 !p-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="p-7">{children}</div>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">Powered by Mostag Studio</p>
          </div>
        </div>
      </div>
    </div>
  )
}
