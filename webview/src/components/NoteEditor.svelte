<script lang="ts">
  import { t } from '../i18n'
  import EditorHeader from '../lib/EditorHeader.svelte'
  export let noteContent = "";
  export let selectedNote: { name: string; filePath: string };
  export let searchText = "";
  export let onSave: (content: string) => void;
  export let onBack: () => void;

  let editing = false;
  let editContent = "";

  function startEdit() {
    editContent = noteContent;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  function toggleEditing() {
    if (editing) {
      save();
    } else {
      startEdit();
    }
  }

  function save() {
    onSave(editContent);
    editing = false;
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInline(text: string) {
    const escaped = escapeHtml(text);

    return escaped
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function renderMarkdown(content: string) {
    if (!content.trim()) {
      return `<p class="empty-render">${$t('noteEditor.selectNote')}</p>`;
    }

    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const html: string[] = [];
    let inCodeBlock = false;
    let inUl = false;
    let inOl = false;
    let paragraph: string[] = [];

    const flushParagraph = () => {
      if (paragraph.length) {
        html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    };

    const closeLists = () => {
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        flushParagraph();
        closeLists();
        if (!inCodeBlock) {
          html.push("<pre><code>");
          inCodeBlock = true;
        } else {
          html.push("</code></pre>");
          inCodeBlock = false;
        }
        continue;
      }

      if (inCodeBlock) {
        html.push(`${escapeHtml(line)}\n`);
        continue;
      }

      if (!trimmed) {
        flushParagraph();
        closeLists();
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        flushParagraph();
        closeLists();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      const quote = trimmed.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeLists();
        html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        continue;
      }

      const ulItem = trimmed.match(/^[-*]\s+(.*)$/);
      if (ulItem) {
        flushParagraph();
        if (inOl) {
          html.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          html.push("<ul>");
          inUl = true;
        }
        html.push(`<li>${renderInline(ulItem[1])}</li>`);
        continue;
      }

      const olItem = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olItem) {
        flushParagraph();
        if (inUl) {
          html.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          html.push("<ol>");
          inOl = true;
        }
        html.push(`<li>${renderInline(olItem[1])}</li>`);
        continue;
      }

      paragraph.push(trimmed);
    }

    flushParagraph();
    closeLists();

    if (inCodeBlock) {
      html.push("</code></pre>");
    }

    return html.join("");
  }

  function filterPreviewContent(content: string, query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return content;

    const matchedLines = content
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((line) => line.toLowerCase().includes(normalizedQuery));

    return matchedLines.length > 0
      ? matchedLines.join("\n")
      : `${$t('noteEditor.noVisibleMatches', { query })}`;
  }

  $: previewContent = filterPreviewContent(noteContent, searchText);
  $: renderedContent = renderMarkdown(previewContent);
</script>

<div class="editor">
  <EditorHeader noteName={selectedNote.name} on:back={onBack}>
    <div class="header-actions">
      <button class="icon-btn primary-btn" on:click={toggleEditing} title={editing ? $t('noteEditor.save') : $t('noteEditor.edit')}><span class="anemona {editing ? 'icon-check' : 'icon-edit-alt'}"></span></button>
    </div>
  </EditorHeader>

  <div class="editor-body">
    {#if editing}
      <textarea
        class="editor-textarea"
        bind:value={editContent}
        spellcheck="false"
      ></textarea>
    {:else}
      <div class="preview">
        {@html renderedContent}
      </div>
    {/if}
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.18rem;
    box-sizing: border-box;
  }

  .editor-body {
    flex: 1;
    overflow: hidden;
    margin-top: 0.16rem;
    border: 1px solid color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-lg);
    background: color-mix(in srgb, var(--accent-color) 6%, var(--vscode-editor-background));
  }

  .editor-textarea {
    width: 100%;
    height: 100%;
    resize: none;
    border: none;
    background: transparent;
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    padding: 0.44rem;
    outline: none;
    box-sizing: border-box;
    line-height: 1.6;
  }

  .preview {
    height: 100%;
    overflow-y: auto;
    padding: 0.5rem;
    color: var(--vscode-editor-foreground);
    font-size: var(--ui-font-sm);
    line-height: 1.45;
    box-sizing: border-box;
  }

  .preview :global(h1),
  .preview :global(h2),
  .preview :global(h3),
  .preview :global(h4),
  .preview :global(h5),
  .preview :global(h6) {
    margin: 0 0 0.55rem;
    line-height: 1.25;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .preview :global(h1) {
    font-size: 1.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--accent-color) 18%, var(--ui-border));
    padding-bottom: 0.3rem;
  }

  .preview :global(h2) { font-size: 1.22rem; }
  .preview :global(h3) { font-size: 1.06rem; }

  .preview :global(p),
  .preview :global(ul),
  .preview :global(ol),
  .preview :global(blockquote),
  .preview :global(pre) {
    margin: 0 0 0.62rem;
  }

  .preview :global(ul),
  .preview :global(ol) {
    padding-left: 1.15rem;
  }

  .preview :global(li + li) {
    margin-top: 0.2rem;
  }

  .preview :global(blockquote) {
    border-left: 3px solid color-mix(in srgb, var(--accent-color) 45%, transparent);
    padding: 0.1rem 0 0.1rem 0.62rem;
    color: var(--ui-muted);
  }

  .preview :global(code) {
    font-family: var(--vscode-editor-font-family, monospace);
    background: color-mix(in srgb, var(--vscode-sideBar-background) 68%, transparent);
    border-radius: 0.35rem;
    padding: 0.12rem 0.32rem;
    font-size: 0.92em;
  }

  .preview :global(pre) {
    background: color-mix(in srgb, var(--accent-color) 8%, var(--vscode-sideBar-background));
    border: 1px solid color-mix(in srgb, var(--accent-color) 16%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    padding: 0.62rem 0.72rem;
    overflow-x: auto;
  }

  .preview :global(pre code) {
    background: transparent;
    padding: 0;
    border-radius: 0;
  }

  .preview :global(a) {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
  }

  .preview :global(a:hover) {
    text-decoration: underline;
  }

  .preview :global(.empty-render) {
    color: var(--ui-muted);
  }
</style>
