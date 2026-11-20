"use client";

import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Code2, Heading1, Heading2, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { useState } from "react";
import { MERGE_FIELDS } from "@/lib/marketing-fields";

// Trimmed port of Zambiel's src/components/admin/rich-text-editor.tsx (email variant) without image upload.
// The HTML is sanitised again on the server before it is saved.

export default function RichTextEditor({ label, name, defaultValue = "", hint }: { label: string; name: string; defaultValue?: string; hint?: string }) {
  const [html, setHtml] = useState(defaultValue);
  const [sourceMode, setSourceMode] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    content: defaultValue,
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), TextStyle, Color],
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
    editorProps: {
      attributes: {
        "aria-label": label,
        class: "marketing-editor min-h-72 max-w-none p-4 text-sm leading-6 text-gray-800 focus:outline-none",
      },
    },
  });

  const command = (commandLabel: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      aria-label={commandLabel}
      title={commandLabel}
      aria-pressed={active}
      onClick={run}
      disabled={sourceMode}
      className="grid size-10 place-items-center border-r border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 aria-pressed:bg-foodeez-primary/10 aria-pressed:text-foodeez-primary"
    >
      {icon}
    </button>
  );

  function toggleSource() {
    if (!editor) return;
    if (sourceMode) editor.commands.setContent(html, { emitUpdate: false });
    else setHtml(editor.getHTML());
    setSourceMode((value) => !value);
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <input type="hidden" name={name} value={html} />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs focus-within:ring-2 focus-within:ring-foodeez-primary/20">
        <div role="toolbar" aria-label={`${label} formatting`} className="flex flex-wrap border-b border-gray-200 bg-gray-50">
          {command("Bold", editor?.isActive("bold") ?? false, () => editor?.chain().focus().toggleBold().run(), <Bold className="size-4" />)}
          {command("Italic", editor?.isActive("italic") ?? false, () => editor?.chain().focus().toggleItalic().run(), <Italic className="size-4" />)}
          {command("Heading 1", editor?.isActive("heading", { level: 1 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), <Heading1 className="size-4" />)}
          {command("Heading 2", editor?.isActive("heading", { level: 2 }) ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="size-4" />)}
          {command("Bullet list", editor?.isActive("bulletList") ?? false, () => editor?.chain().focus().toggleBulletList().run(), <List className="size-4" />)}
          {command("Numbered list", editor?.isActive("orderedList") ?? false, () => editor?.chain().focus().toggleOrderedList().run(), <ListOrdered className="size-4" />)}
          {command("Quote", editor?.isActive("blockquote") ?? false, () => editor?.chain().focus().toggleBlockquote().run(), <Quote className="size-4" />)}
          {command(
            "Link",
            editor?.isActive("link") ?? false,
            () => {
              if (!editor) return;
              const href = window.prompt("Link URL (or {{claim_url}})", editor.getAttributes("link").href ?? "https://");
              if (href === null) return;
              if (!href.trim()) editor.chain().focus().unsetLink().run();
              else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
            },
            <LinkIcon className="size-4" />
          )}
          {command("Undo", false, () => editor?.chain().focus().undo().run(), <Undo2 className="size-4" />)}
          {command("Redo", false, () => editor?.chain().focus().redo().run(), <Redo2 className="size-4" />)}
          <label className="grid size-10 place-items-center border-r border-gray-200 hover:bg-gray-50">
            <span className="sr-only">Text colour</span>
            <input
              type="color"
              defaultValue="#FF4D00"
              disabled={sourceMode}
              onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
              className="size-6 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <label className="inline-flex min-h-10 items-center border-r border-gray-200 px-2">
            <span className="sr-only">Insert personal field</span>
            <select
              value=""
              disabled={sourceMode}
              onChange={(event) => {
                if (event.target.value) editor?.chain().focus().insertContent(event.target.value).run();
              }}
              className="min-h-9 bg-transparent text-xs font-semibold text-foodeez-primary focus:outline-none"
            >
              <option value="">Insert field</option>
              {MERGE_FIELDS.map((field) => (
                <option key={field.token} value={field.token}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={sourceMode}
            onClick={toggleSource}
            className="ml-auto inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 aria-pressed:text-foodeez-primary"
          >
            <Code2 className="size-4" />
            HTML
          </button>
        </div>
        {sourceMode ? (
          <textarea
            aria-label={`${label} HTML`}
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            className="min-h-72 w-full resize-y p-4 font-mono text-sm focus:outline-none"
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
