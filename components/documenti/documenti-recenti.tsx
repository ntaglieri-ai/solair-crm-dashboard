"use client"

import {
  FileText,
  Archive,
  File,
  ExternalLink,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  type DocumentoRecente,
  type DocumentoTipo,
  nextcloudLink,
  relativeDateIt,
} from "@/lib/documenti-data"

const TIPO_ICON: Record<DocumentoTipo, LucideIcon> = {
  pdf: FileText,
  zip: Archive,
  file: File,
}

const TIPO_ICON_CLASSI: Record<DocumentoTipo, string> = {
  pdf: "text-destructive",
  zip: "text-amber-600",
  file: "text-muted-foreground",
}

const MAX_VISIBLE = 5

export function DocumentiRecenti({
  documenti,
  baseUrl,
}: {
  documenti: DocumentoRecente[]
  baseUrl: string
}) {
  const visibili = documenti.slice(0, MAX_VISIBLE)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">
        Documenti recenti
      </h2>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Nome file</TableHead>
              <TableHead>Dimensione</TableHead>
              <TableHead>Modificato</TableHead>
              <TableHead>Lead collegato</TableHead>
              <TableHead className="pr-4 text-right">Azione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibili.map((doc) => {
              const Icon = TIPO_ICON[doc.tipo]
              return (
                <TableRow key={doc.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={`size-4 shrink-0 ${TIPO_ICON_CLASSI[doc.tipo]}`}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground">
                        {doc.nome}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.dimensione}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {relativeDateIt(doc.modificato)}
                  </TableCell>
                  <TableCell>
                    {doc.lead_id && doc.lead_nome ? (
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        render={<a href={`/leads?lead=${doc.lead_id}`} />}
                      >
                        {doc.lead_nome}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Apri ${doc.nome} in Nextcloud`}
                      render={
                        <a
                          href={nextcloudLink(baseUrl, doc.path)}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <Button
        variant="link"
        size="sm"
        className="h-auto self-start p-0 text-primary"
      >
        Vedi tutti i recenti
      </Button>
    </section>
  )
}
