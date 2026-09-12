"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import LinkExtension from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import UnderlineExtension from "@tiptap/extension-underline"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmailTemplateEditorProps = {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  variables?: string[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function plainTextToHtml(value: string): string {
  const normalized = value.replace(/\r\n|\r/g, "\n").trim()
  if (!normalized) return ""

  return normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("")
}

function stripUnsafeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
}

function bodyFromFullDocument(value: string): string {
  const match = value.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return match?.[1] ?? value
}

function isHtml(value: string): boolean {
  return /<\s*(html|body|table|div|p|br|span|ul|ol|li|strong|b)\b/i.test(value)
}

function editorContentFromValue(value: string): string {
  const content = value.trim()
  if (!content) return ""
  return stripUnsafeHtml(isHtml(content) ? bodyFromFullDocument(content) : plainTextToHtml(content))
}

function cleanEditorOutput(html: string): string {
  const cleaned = stripUnsafeHtml(html)
  return cleaned === "<p></p>" ? "" : cleaned
}

function ToolbarButton({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0", active && "bg-primary/10 text-primary")}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function EmailTemplateEditor({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Scrivi il corpo del modello...",
  variables = [],
}: EmailTemplateEditorProps) {
  const [initialContent] = useState(() => editorContentFromValue(value))
  const lastEmitted = useRef(value)

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      UnderlineExtension,
      LinkExtension.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        id,
        class:
          "min-h-[420px] w-full outline-none text-[15px] leading-7 text-foreground [&_p]:my-3 [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline [&_.is-editor-empty:first-child:before]:float-left [&_.is-editor-empty:first-child:before]:h-0 [&_.is-editor-empty:first-child:before]:text-muted-foreground [&_.is-editor-empty:first-child:before]:content-[attr(data-placeholder)]",
      },
    },
    onUpdate({ editor }) {
      const next = cleanEditorOutput(editor.getHTML())
      lastEmitted.current = next
      onChange(next)
    },
  })

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [disabled, editor])

  useEffect(() => {
    if (!editor || value === lastEmitted.current) return
    const next = editorContentFromValue(value)
    lastEmitted.current = value
    editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  const editorDisabled = disabled || !editor

  function setLink() {
    if (!editor) return
    const previous = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("Link", previous ?? "")

    if (url === null) return
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-2">
        <ToolbarButton
          title="Grassetto"
          active={editor?.isActive("bold")}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Corsivo"
          active={editor?.isActive("italic")}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Sottolineato"
          active={editor?.isActive("underline")}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <Underline className="size-4" />
        </ToolbarButton>

        <span className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          title="Elenco puntato"
          active={editor?.isActive("bulletList")}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Elenco numerato"
          active={editor?.isActive("orderedList")}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton title="Link" active={editor?.isActive("link")} disabled={editorDisabled} onClick={setLink}>
          <Link2 className="size-4" />
        </ToolbarButton>

        <span className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          title="Allinea a sinistra"
          active={editor?.isActive({ textAlign: "left" })}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Centra"
          active={editor?.isActive({ textAlign: "center" })}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Allinea a destra"
          active={editor?.isActive({ textAlign: "right" })}
          disabled={editorDisabled}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-4" />
        </ToolbarButton>

        <span className="mx-1 h-6 w-px bg-border" />

        <ToolbarButton
          title="Annulla"
          disabled={editorDisabled || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          title="Ripeti"
          disabled={editorDisabled || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="size-4" />
        </ToolbarButton>

        {variables.length > 0 ? (
          <>
            <span className="mx-1 h-6 w-px bg-border" />
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {variables.map((variable) => (
                <Button
                  key={variable}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 bg-card px-2 font-mono text-xs"
                  disabled={editorDisabled}
                  title={`Inserisci ${variable}`}
                  onClick={() => editor?.chain().focus().insertContent(variable).run()}
                >
                  {variable}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="max-h-[52vh] min-h-[460px] overflow-y-auto bg-white px-8 py-6">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
