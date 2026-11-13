"use client";

import { useLayoutEffect, useRef, type ClipboardEvent } from "react";

type TaskRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

const ALLOWED_TAGS = new Set([
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
]);

const UNSAFE_TAGS =
  /<(script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

function escapePlainText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownInlineToHtml(value: string) {
  return escapePlainText(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");
}

function getMarkdownListType(line: string): "ul" | "ol" | null {
  if (/^\s*(?:[-*+•])\s+.+$/.test(line)) return "ul";
  if (/^\s*\d+[.)]\s+.+$/.test(line)) return "ol";
  return null;
}

/** Mendeteksi Markdown umum tanpa menganggap tanda baca biasa sebagai format. */
function looksLikeMarkdown(value: string) {
  return (
    /(^|\n)\s{0,3}#{1,6}\s+/.test(value) ||
    /(^|\n)\s*(?:[-*+•]\s+|\d+[.)]\s+|>\s?)/.test(value) ||
    /(^|\n)\s*(?:-{3,}|\*{3,}|_{3,})\s*(?=\n|$)/.test(value) ||
    /\*\*[^*\n]+\*\*/.test(value) ||
    /(^|[^_])__[^_\n]+__/.test(value) ||
    /(^|[^*])\*[^\s*](?:[^*\n]*?[^\s*])?\*(?!\*)/.test(value) ||
    /(^|[\s(])_[^_\n]+_(?=$|[\s).,!?:;])/.test(value)
  );
}

/** Mengubah heading, paragraf, bold/italic, bullet, dan numbered list Markdown ke HTML. */
function markdownToTaskHtml(value: string): string {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const content = paragraph.join(" ").trim();
    if (content) blocks.push(`<p>${markdownInlineToHtml(content)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listType && listItems.length) {
      const items = listItems
        .map((item) => `<li>${markdownInlineToHtml(item)}</li>`)
        .join("");
      blocks.push(`<${listType}>${items}</${listType}>`);
    }
    listType = null;
    listItems = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }

    if (!line) {
      flushParagraph();
      if (listType) {
        const nextLine = lines
          .slice(index + 1)
          .find((candidate) => candidate.trim().length > 0);
        if (!nextLine || getMarkdownListType(nextLine) !== listType) {
          flushList();
        }
      }
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const tag = headingMatch[1].length <= 2 ? "h2" : "h3";
      blocks.push(`<${tag}>${markdownInlineToHtml(headingMatch[2])}</${tag}>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      if (quoteMatch[1]) {
        blocks.push(`<blockquote><p>${markdownInlineToHtml(quoteMatch[1])}</p></blockquote>`);
      }
      continue;
    }

    const bulletMatch = rawLine.match(/^\s*(?:[-*+•])\s+(.+)$/);
    const orderedMatch = rawLine.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const nextType = bulletMatch ? "ul" : "ol";
      if (listType !== nextType) flushList();
      listType = nextType;
      listItems.push((bulletMatch?.[1] ?? orderedMatch?.[1] ?? "").trim());
      continue;
    }

    // Baris lanjutan yang diindentasi tetap menjadi bagian dari butir sebelumnya.
    if (listType && /^\s{2,}\S/.test(rawLine) && listItems.length) {
      listItems[listItems.length - 1] += ` ${line}`;
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.join("");
}

/**
 * Membersihkan HTML instruksi dengan whitelist tag.
 * Semua atribut dibuang sehingga event handler, style, dan URL asing tidak tersimpan.
 */
export function sanitizeTaskRichText(value: string): string {
  if (!value) return "";

  const withoutUnsafeBlocks = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(UNSAFE_TAGS, "")
    .replace(
      /<\/?(?:script|style|iframe|object|embed|svg|math|template|noscript)\b[^>]*>/gi,
      ""
    );

  const tokenPattern = /<\/?([a-z][a-z0-9-]*)\b[^>]*>|([^<]+)|</gi;
  const output: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(withoutUnsafeBlocks)) !== null) {
    const fullToken = match[0];

    if (match[2] !== undefined) {
      const safeText = match[2]
        .replace(
          /&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);)/gi,
          "&amp;"
        )
        .replace(/>/g, "&gt;");
      output.push(safeText);
      continue;
    }

    if (fullToken === "<") {
      output.push("&lt;");
      continue;
    }

    const originalTag = (match[1] ?? "").toLowerCase();
    // Samakan heading dari Word/Google Docs dengan heading yang didukung editor.
    const tag = originalTag === "h1" ? "h2" :
      originalTag === "h5" || originalTag === "h6" ? "h3" : originalTag;

    if (!ALLOWED_TAGS.has(tag)) continue;

    const isClosing = /^<\//.test(fullToken);
    if (tag === "br") {
      if (!isClosing) output.push("<br>");
      continue;
    }

    output.push(isClosing ? `</${tag}>` : `<${tag}>`);
  }

  return output.join("");
}

/**
 * Mengonversi HTML clipboard/editor menjadi HTML sederhana.
 * Format tebal/miring dari span ber-style dibaca sebagai tag semantik, bukan menyimpan CSS.
 */
function htmlToTaskHtml(value: string): string {
  if (typeof DOMParser === "undefined" || !value.trim()) return "";

  const documentFromHtml = new DOMParser().parseFromString(value, "text/html");

  const serializeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapePlainText(node.textContent ?? "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    if (["script", "style", "iframe", "object", "embed", "svg", "math"].includes(tag)) {
      return "";
    }

    if (tag === "br") return "<br>";

    const content = Array.from(element.childNodes).map(serializeNode).join("");
    const style = (element.getAttribute("style") ?? "").toLowerCase();
    const isBoldStyle = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    const isItalicStyle = /font-style\s*:\s*italic/.test(style);
    const isUnderlineStyle = /text-decoration(?:-line)?\s*:[^;]*underline/.test(style);

    const applyInlineStyles = (input: string) => {
      let output = input;
      if (isBoldStyle && !["strong", "b", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        output = `<strong>${output}</strong>`;
      }
      if (isItalicStyle && !["em", "i"].includes(tag)) {
        output = `<em>${output}</em>`;
      }
      if (isUnderlineStyle && tag !== "u") {
        output = `<u>${output}</u>`;
      }
      return output;
    };

    switch (tag) {
      case "p":
        return `<p>${applyInlineStyles(content)}</p>`;
      case "div":
        return /<(?:p|h2|h3|ul|ol|blockquote)\b/i.test(content)
          ? content
          : `<p>${applyInlineStyles(content)}</p>`;
      case "h1":
      case "h2":
        return `<h2>${content}</h2>`;
      case "h3":
      case "h4":
      case "h5":
      case "h6":
        return `<h3>${content}</h3>`;
      case "strong":
      case "b":
        return `<strong>${applyInlineStyles(content)}</strong>`;
      case "em":
      case "i":
        return `<em>${applyInlineStyles(content)}</em>`;
      case "u":
        return `<u>${applyInlineStyles(content)}</u>`;
      case "li":
        return `<li>${applyInlineStyles(content)}</li>`;
      case "ul":
      case "ol":
      case "blockquote":
        return `<${tag}>${content}</${tag}>`;
      default:
        return applyInlineStyles(content);
    }
  };

  const html = Array.from(documentFromHtml.body.childNodes)
    .map(serializeNode)
    .join("");

  return sanitizeTaskRichText(html);
}

/** Mendukung data lama berupa teks biasa, Markdown, dan data baru berbentuk HTML. */
export function normalizeTaskRichText(value: string | null | undefined): string {
  const raw = value ?? "";
  if (!raw.trim()) return "";

  const hasRichMarkup =
    /<\/?(?:p|div|br|strong|b|em|i|u|ul|ol|li|h[1-6]|blockquote)\b/i.test(raw);

  if (hasRichMarkup) return sanitizeTaskRichText(raw);
  if (looksLikeMarkdown(raw)) return sanitizeTaskRichText(markdownToTaskHtml(raw));

  return escapePlainText(raw).replace(/\r\n|\r|\n/g, "<br>");
}

export function hasTaskRichTextContent(value: string): boolean {
  const plainText = normalizeTaskRichText(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[2-4]|blockquote)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');

  return plainText.replace(/[\u200B\uFEFF]/g, "").trim().length > 0;
}

export function getTaskRichTextPreview(value: string): string {
  return normalizeTaskRichText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(?:p|div|li|h[2-4]|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function TaskRichTextEditor({
  value,
  onChange,
}: TaskRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const previousPropValueRef = useRef(value);
  const lastEmittedValueRef = useRef<string | null>(null);
  const composingRef = useRef(false);

  /**
   * Jangan mengontrol innerHTML melalui React setiap kali mengetik.
   * Itu akan mengganti node DOM dan membuat caret/kursor meloncat ke awal.
   * Hanya sinkronkan saat inisialisasi atau saat parent benar-benar mengganti data.
   */
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const normalized = normalizeTaskRichText(value);

    if (!initializedRef.current) {
      editor.innerHTML = normalized;
      initializedRef.current = true;
      previousPropValueRef.current = value;
      lastEmittedValueRef.current = normalized;
      return;
    }

    if (value === previousPropValueRef.current) return;
    previousPropValueRef.current = value;

    // Perubahan yang baru saja dikirim editor ke parent adalah echo lokal.
    // Jangan tulis ulang DOM karena posisi kursor harus tetap dipertahankan.
    if (
      lastEmittedValueRef.current !== null &&
      (value === lastEmittedValueRef.current || normalized === lastEmittedValueRef.current)
    ) {
      return;
    }

    if (sanitizeTaskRichText(editor.innerHTML) !== normalized) {
      editor.innerHTML = normalized;
    }
    lastEmittedValueRef.current = normalized;
  }, [value]);

  function syncValue() {
    const editor = editorRef.current;
    if (!editor || composingRef.current) return;

    // Baca tag semantik dan style inline yang mungkin dibuat browser oleh toolbar.
    // Konversi ke HTML aman sebelum dikirim ke state/database.
    const sanitized =
      htmlToTaskHtml(editor.innerHTML) || sanitizeTaskRichText(editor.innerHTML);
    if (sanitized === lastEmittedValueRef.current) return;

    lastEmittedValueRef.current = sanitized;
    onChange(sanitized);
  }

  function runCommand(command: string, commandValue?: string) {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function insertHtmlAtSelection(editor: HTMLDivElement, html: string) {
    const selection = window.getSelection();
    let range: Range;

    if (
      selection &&
      selection.rangeCount > 0 &&
      editor.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    range.deleteContents();
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    range.insertNode(fragment);

    if (selection && lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    const plainText = event.clipboardData.getData("text/plain").replace(/\u00a0/g, " ");
    const clipboardHtml = event.clipboardData.getData("text/html");
    let htmlToInsert = "";
    if (looksLikeMarkdown(plainText)) {
      htmlToInsert = markdownToTaskHtml(plainText);
    } else if (clipboardHtml.trim()) {
      htmlToInsert = htmlToTaskHtml(clipboardHtml);
    }
    // Jika HTML clipboard kosong/tidak terbaca, jangan hilangkan teks biasa.
    if (!htmlToInsert) htmlToInsert = markdownToTaskHtml(plainText);
    if (!htmlToInsert) return;

    editor.focus();
    const inserted = document.execCommand("insertHTML", false, htmlToInsert);
    if (!inserted) insertHtmlAtSelection(editor, htmlToInsert);
    syncValue();
  }

  const toolbarButtonClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 active:bg-violet-100";

  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100">
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 p-2"
        role="toolbar"
        aria-label="Pemformatan instruksi tugas"
      >
        <button
          type="button"
          className={toolbarButtonClass}
          title="Tebalkan"
          aria-label="Tebalkan"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("bold")}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} italic`}
          title="Miring"
          aria-label="Miring"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("italic")}
        >
          I
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} underline`}
          title="Garis bawah"
          aria-label="Garis bawah"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("underline")}
        >
          U
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          className={toolbarButtonClass}
          title="Judul bagian"
          aria-label="Judul bagian"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("formatBlock", "h2")}
        >
          H2
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Paragraf biasa"
          aria-label="Paragraf biasa"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("formatBlock", "p")}
        >
          P
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          className={toolbarButtonClass}
          title="Daftar dengan titik"
          aria-label="Daftar dengan titik"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("insertUnorderedList")}
        >
          • List
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Daftar dengan angka"
          aria-label="Daftar dengan angka"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("insertOrderedList")}
        >
          1. List
        </button>

        <span className="mx-1 h-6 w-px bg-slate-200" />

        <button
          type="button"
          className={toolbarButtonClass}
          title="Kurangi indentasi"
          aria-label="Kurangi indentasi"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("outdent")}
        >
          ←
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Tambah indentasi"
          aria-label="Tambah indentasi"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("indent")}
        >
          →
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Batalkan"
          aria-label="Batalkan"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("undo")}
        >
          ↶
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          title="Ulangi"
          aria-label="Ulangi"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("redo")}
        >
          ↷
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Instruksi pengerjaan tugas"
        aria-multiline="true"
        spellCheck
        onInput={syncValue}
        onBlur={syncValue}
        onPaste={handlePaste}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          syncValue();
        }}
        className="min-h-[220px] w-full break-words px-4 py-3 text-sm leading-7 text-slate-700 outline-none sm:min-h-[250px] [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-extrabold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
      />

      <div className="border-t border-slate-100 bg-white px-3 py-2">
        <p className="text-[10px] leading-5 text-slate-400">
          Paste teks dengan format Markdown juga didukung: # untuk judul, **teks**
          untuk tebal, - untuk bullet, dan 1. untuk penomoran. Format akan
          dikonversi otomatis. Posisi kursor tetap dijaga saat mengedit.
        </p>
      </div>
    </div>
  );
}

export function TaskRichTextContent({
  value,
}: {
  value: string | null | undefined;
}) {
  const safeHtml = normalizeTaskRichText(value);

  if (!safeHtml) {
    return <p className="mt-3 text-sm text-slate-500">Instruksi belum tersedia.</p>;
  }

  return (
    <div
      className="mt-3 break-words text-sm leading-7 text-slate-700 sm:text-[15px] [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-violet-200 [&_blockquote]:pl-4 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-extrabold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
