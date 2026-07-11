"use client"

import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Archive,
  File,
  ExternalLink,
  FolderOpen,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type DocumentoRecente,
  fileExtension,
  formatSize,
  openNextcloudUrl,
  relativeDateIt,
} from "@/lib/documenti-data"

function iconFor(name: string): { Icon: LucideIcon; className: string } {
  const ext = fileExtension(name)
  if (ext === "pdf") return { Icon: FileText, className: "text-destructive" }
  if (["xls", "xlsx", "csv"].includes(ext)) return { Icon: FileSpreadsheet, className: "text-teal" }
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return { Icon: FileImage, className: "text-blue-500" }
  if (["zip", "rar", "7z"].includes(ext)) return { Icon: Archive, className: "text-amber-600" }
  return { Icon: File, className: "text-muted-foreground" }
}

/** Directory contenente il file, per aprire la cartella giusta su Nextcloud. */
function parentDir(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx > 0 ? path.slice(0, idx) : ""
}

export function DocumentiRecenti({ documenti }: { documenti: DocumentoRecente[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">Documenti recenti</h2>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Nome file</TableHead>
              <TableHead>Dimensione</TableHead>
              <TableHead>Modificato</TableHead>
              <TableHead className="pr-4 text-right">Azione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documenti.map((doc) => {
              const { Icon, className } = iconFor(doc.name)
              // Deep link diretto al file quando abbiamo l'oc:fileid; senza,
              // degradiamo aprendo la cartella contenitore (comportamento sicuro).
              const fileHref = doc.fileId
                ? openNextcloudUrl(doc.path, doc.fileId)
                : openNextcloudUrl(parentDir(doc.path))
              const folderHref = openNextcloudUrl(parentDir(doc.path))
              return (
                <TableRow key={doc.path}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 shrink-0 ${className}`} aria-hidden="true" />
                      <a
                        href={fileHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                        title={`Apri ${doc.name}`}
                      >
                        {doc.name}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatSize(doc.size)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeDateIt(doc.modified)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              nativeButton={false}
                              aria-label={`Apri il file ${doc.name}`}
                              render={
                                <a
                                  href={fileHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              <ExternalLink className="size-4" aria-hidden="true" />
                            </Button>
                          }
                        />
                        <TooltipContent>Apri file</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              nativeButton={false}
                              aria-label={`Vai alla cartella di ${doc.name}`}
                              render={
                                <a
                                  href={folderHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              <FolderOpen className="size-4" aria-hidden="true" />
                            </Button>
                          }
                        />
                        <TooltipContent>Vai alla cartella</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {documenti.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  Nessun documento recente.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </section>
  )
}
