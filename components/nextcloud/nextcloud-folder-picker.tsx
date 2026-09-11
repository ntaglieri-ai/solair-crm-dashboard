"use client"

import { useCallback, useState } from "react"
import { ChevronRight, Folder, FolderTree, Home, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export type CartellaNextcloud = { nome: string; path: string }

/**
 * Selettore di cartella Nextcloud: si naviga l'albero vero e si sceglie con
 * un click, invece di digitare il path a mano.
 *
 * La navigazione e' la stessa gia' usata dal browser "Aggiungi cartella
 * preferita" di Documenti (breadcrumb + un livello per chiamata): qui e'
 * estratta in un componente perche' serve anche altrove, e un path scritto a
 * mano e' la classica configurazione che sembra salvata e non punta a niente.
 *
 * `browseUrl` deve rispondere a `?path=<cartella>` con l'elenco delle sole
 * sottocartelle. Sono accettate entrambe le convenzioni gia' presenti nel
 * CRM — `{ cartelle: [{ nome, path }] }` e `{ folders: [{ name, path }] }` —
 * cosi' il componente si aggancia agli endpoint esistenti senza adattatori.
 */
type RigaRemota = { nome?: string; name?: string; path?: string }
type RispostaBrowse = { cartelle?: RigaRemota[]; folders?: RigaRemota[]; error?: string }

function normalizzaRighe(corpo: RispostaBrowse | null): CartellaNextcloud[] {
  const righe = corpo?.cartelle ?? corpo?.folders ?? []
  return righe
    .map((riga) => ({
      nome: riga.nome ?? riga.name ?? (riga.path ?? "").split("/").pop() ?? "",
      path: riga.path ?? "",
    }))
    .filter((riga) => riga.path !== "")
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Segmenti del path -> breadcrumb con path cumulativo. */
function briciole(path: string): CartellaNextcloud[] {
  const parti = path.split("/").filter(Boolean)
  const acc: CartellaNextcloud[] = []
  let corrente = ""
  for (const parte of parti) {
    corrente = corrente ? `${corrente}/${parte}` : parte
    acc.push({ nome: parte, path: corrente })
  }
  return acc
}

/**
 * Cartella che contiene `path`, senza mai risalire sopra `radice`.
 * Su path vuoto o gia' di primo livello si resta sulla radice.
 */
function cartellaGenitore(path: string, radice: string): string {
  if (!path) return radice
  const genitore = path.split("/").slice(0, -1).join("/")
  if (!genitore) return radice
  return genitore === radice || genitore.startsWith(radice) ? genitore : radice
}

export function NextcloudFolderPicker({
  value,
  onSelect,
  browseUrl,
  disabled = false,
  rootPath = "",
  rootLabel = "Home",
  triggerLabel = "Sfoglia",
  title = "Scegli una cartella Nextcloud",
  description = "Naviga l'albero e scegli la cartella: il percorso viene compilato da qui.",
}: {
  value: string
  onSelect: (path: string) => void
  browseUrl: string
  disabled?: boolean
  /** Cartella da cui parte la navigazione. "" = home dell'utente. */
  rootPath?: string
  rootLabel?: string
  triggerLabel?: string
  title?: string
  description?: string
}) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState(rootPath)
  /** Riga scelta con un click. "" = nessuna, e il bottone di conferma resta spento. */
  const [selezionata, setSelezionata] = useState("")
  const [cartelle, setCartelle] = useState<CartellaNextcloud[]>([])
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const carica = useCallback(
    async (destinazione: string) => {
      setCaricamento(true)
      setErrore(null)
      try {
        const risposta = await fetch(
          `${browseUrl}?path=${encodeURIComponent(destinazione)}`,
          { cache: "no-store" },
        )
        const corpo = (await risposta.json().catch(() => null)) as RispostaBrowse | null
        if (!risposta.ok) throw new Error(corpo?.error ?? "Lettura cartella non riuscita.")
        setCartelle(normalizzaRighe(corpo))
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Lettura cartella non riuscita.")
        setCartelle([])
      } finally {
        setCaricamento(false)
      }
    },
    [browseUrl],
  )

  // All'apertura si mostra la cartella che CONTIENE quella gia' configurata,
  // con quella configurata gia' selezionata: chi apre per correggere un
  // percorso se lo trova evidenziato in mezzo alle sorelle, e cambiarlo e' un
  // click solo. Entrare dentro mostrerebbe il contenuto e non la scelta.
  function apri() {
    const partenza = cartellaGenitore(value, rootPath)
    setPath(partenza)
    setSelezionata(value)
    setOpen(true)
    void carica(partenza)
  }

  function vaiA(destinazione: string) {
    setPath(destinazione)
    void carica(destinazione)
  }

  const dentroLaRadice = path !== rootPath
  const briciolePath = briciole(path.startsWith(rootPath) ? path.slice(rootPath.length) : path)
  const prefisso = rootPath ? `${rootPath}/` : ""

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={apri}
        className="shrink-0 gap-1.5"
      >
        <FolderTree className="size-4" aria-hidden="true" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => vaiA(rootPath)}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-foreground",
                  !dentroLaRadice && "font-medium text-foreground",
                )}
              >
                <Home className="size-3.5" aria-hidden="true" />
                {rootLabel}
              </button>
              {briciolePath.map((segmento) => (
                <span key={segmento.path} className="inline-flex items-center gap-1">
                  <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => vaiA(`${prefisso}${segmento.path}`)}
                    className={cn(
                      "rounded px-1.5 py-0.5 hover:text-foreground",
                      `${prefisso}${segmento.path}` === path && "font-medium text-foreground",
                    )}
                  >
                    {segmento.nome}
                  </button>
                </span>
              ))}
            </div>

            <div className="max-h-64 min-h-[8rem] overflow-y-auto rounded-lg border border-border">
              {caricamento ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                </div>
              ) : errore ? (
                <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-destructive">
                  {errore}
                </div>
              ) : cartelle.length === 0 ? (
                <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  Nessuna sottocartella qui.
                </div>
              ) : (
                <ul className="divide-y divide-border" role="listbox" aria-label="Cartelle">
                  {cartelle.map((cartella) => {
                    const scelta = cartella.path === selezionata
                    return (
                      <li key={cartella.path}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={scelta}
                          onClick={() => setSelezionata(cartella.path)}
                          onDoubleClick={() => vaiA(cartella.path)}
                          // Da tastiera il doppio click non esiste: Invio
                          // seleziona (e' il click del bottone) e la freccia
                          // destra apre, come in un albero di cartelle.
                          onKeyDown={(evento) => {
                            if (evento.key === "ArrowRight") {
                              evento.preventDefault()
                              setSelezionata(cartella.path)
                              vaiA(cartella.path)
                            }
                          }}
                          className={cn(
                            "flex w-full select-none items-center gap-2.5 px-3 py-2 text-left text-sm",
                            scelta
                              ? "bg-teal/12 font-medium text-foreground ring-1 ring-inset ring-teal/40"
                              : "hover:bg-muted",
                          )}
                        >
                          <Folder
                            className={cn(
                              "size-4 shrink-0",
                              scelta ? "text-teal" : "text-[#2E8B72]",
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{cartella.nome}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <p className="truncate text-xs text-muted-foreground">
                {selezionata
                  ? `Selezione: /${selezionata}`
                  : "Nessuna cartella selezionata."}
              </p>
              <p className="text-xs text-muted-foreground">
                Un click seleziona la cartella, doppio click la apre.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              type="button"
              disabled={!selezionata}
              onClick={() => {
                onSelect(selezionata)
                setOpen(false)
              }}
            >
              Usa questa cartella
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
