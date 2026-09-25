import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import { useState } from "react"
import { initialArticleContent, isRichText, richTextPrefix, safeArticleLink } from "../model/articleText"

export function RichTextEditor({
  initialBody,
  onChange,
  disabled,
}: {
  initialBody: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const [link, setLink] = useState<string | null>(null)
  const [linkError, setLinkError] = useState("")
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false,
        link: { openOnClick: false, autolink: false, isAllowedUri: safeArticleLink },
      }),
      Markdown,
    ],
    content: initialArticleContent(initialBody),
    contentType: isRichText(initialBody) ? "markdown" : "json",
    editorProps: {
      attributes: {
        id: "article_body",
        role: "textbox",
        "aria-label": "Текст",
        "aria-multiline": "true",
        "aria-describedby": "article-character-count",
        class: "library-prose min-h-[26rem] px-4 py-3 font-serif text-base leading-7 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? "" : richTextPrefix + current.getMarkdown())
    },
  })
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      heading: current.isActive("heading", { level: 2 }),
      subheading: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      code: current.isActive("codeBlock"),
      link: current.isActive("link"),
      undo: current.can().undo(),
      redo: current.can().redo(),
    }),
  })
  const controls = [
    {
      id: "bold",
      label: "Жирный",
      text: "Ж",
      active: state.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "Курсив",
      text: "К",
      active: state.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "strike",
      label: "Зачёркнутый",
      text: "З̶",
      active: state.strike,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "heading",
      label: "Заголовок",
      text: "H2",
      active: state.heading,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "subheading",
      label: "Подзаголовок",
      text: "H3",
      active: state.subheading,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      id: "bullet",
      label: "Маркированный список",
      text: "• Список",
      active: state.bullet,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: "ordered",
      label: "Нумерованный список",
      text: "1. Список",
      active: state.ordered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: "quote",
      label: "Цитата",
      text: "❝",
      active: state.quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "code",
      label: "Блок кода",
      text: "</>",
      active: state.code,
      run: () => editor.chain().focus().toggleCodeBlock().run(),
    },
  ]
  function applyLink() {
    const value = link?.trim() ?? ""
    if (!safeArticleLink(value)) {
      setLinkError("Укажи полный адрес http:// или https://.")
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run()
    setLink(null)
  }
  return (
    <div>
      <p id="article-body-label" className="mb-2 text-sm font-medium text-zinc-200">
        Текст
      </p>
      <fieldset
        disabled={disabled}
        className="min-w-0 overflow-hidden rounded-xl border border-stone-700 bg-stone-900 focus-within:border-amber-400"
      >
        <legend className="sr-only">Редактор текста статьи</legend>
        <div
          role="group"
          aria-label="Форматирование текста"
          className="flex flex-wrap gap-1 border-b border-stone-700 bg-stone-950/60 p-2"
        >
          {controls.map((control) => (
            <button
              key={control.id}
              id={`article-format-${control.id}`}
              type="button"
              aria-label={control.label}
              title={control.label}
              aria-pressed={control.active}
              onClick={control.run}
              className="library-format-button"
            >
              {control.text}
            </button>
          ))}
          <button
            id="article-format-link"
            type="button"
            aria-pressed={state.link}
            onClick={() => {
              const href: unknown = editor.getAttributes("link").href
              setLink(typeof href === "string" ? href : "https://")
              setLinkError("")
            }}
            className="library-format-button"
          >
            Ссылка
          </button>
          <button
            id="article-format-rule"
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="library-format-button"
            title="Разделитель"
            aria-label="Разделитель"
          >
            ―
          </button>
          <button
            id="article-format-clear"
            type="button"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            className="library-format-button"
          >
            Без стиля
          </button>
          <button
            id="article-format-undo"
            type="button"
            disabled={!state.undo}
            onClick={() => editor.chain().focus().undo().run()}
            className="library-format-button"
            aria-label="Отменить"
          >
            ↶
          </button>
          <button
            id="article-format-redo"
            type="button"
            disabled={!state.redo}
            onClick={() => editor.chain().focus().redo().run()}
            className="library-format-button"
            aria-label="Повторить"
          >
            ↷
          </button>
        </div>
        {link !== null && (
          <div className="space-y-2 border-b border-stone-700 p-3">
            <label htmlFor="article-link-url" className="block text-sm">
              Адрес ссылки
            </label>
            <input
              id="article-link-url"
              type="url"
              value={link}
              onChange={(e) => {
                setLink(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyLink()
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  e.stopPropagation()
                  setLink(null)
                  editor.commands.focus()
                }
              }}
              className="w-full rounded border border-stone-600 bg-stone-950 px-3 py-2"
            />
            {linkError && (
              <p role="alert" className="text-sm text-red-300">
                {linkError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" id="article-link-apply" onClick={applyLink} className="library-format-button">
                Применить
              </button>
              <button
                type="button"
                id="article-link-remove"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run()
                  setLink(null)
                }}
                className="library-format-button"
              >
                Убрать ссылку
              </button>
              <button
                type="button"
                onClick={() => {
                  setLink(null)
                  editor.commands.focus()
                }}
                className="library-format-button"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
        <EditorContent editor={editor} inert={disabled} />
      </fieldset>
      <p className="mt-2 text-xs text-stone-500">
        Выдели текст и выбери оформление. Ctrl/⌘ + B — жирный, I — курсив, Z — отмена.
      </p>
    </div>
  )
}
