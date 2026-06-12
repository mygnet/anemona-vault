<script lang="ts">
  import { tick } from "svelte";
  import { smartPopover } from "../utils/smartPopover";

  export let notes: {
    name: string;
    filePath: string;
    fileType?: string;
    displayName?: string;
    icon?: string;
    progress?: number;
  }[] = [];
  export let folders: { name: string; path: string; color?: string; isEmpty?: boolean }[] = [];
  export let selectedCategory = "";
  export let parentFolderPath: string | null = null;
  export let folderBreadcrumb: string[] = [];
  export let selectedCategoryConfig: { color?: string; icon?: string } = {};
  export let canDeleteCategory = false;
  export let onSelect: (note: { name: string; filePath: string }) => void;
  export let onCreate: (title: string, fileType: string) => void;
  export let onDelete: (note: { name: string; filePath: string }) => void;
  export let onDeleteCategory: (category: string) => void;
  export let onRename: (note: { name: string; filePath: string }) => void;
  export let onMove: (note: { name: string; filePath: string }) => void;
  export let onExport: (note: { name: string; filePath: string }) => void;
  export let onRenameCategory: (category: string) => void;
  export let onUpdateCategoryColor: (category: string, color: string) => void;
  export let onOpenFolder: (folder: { name: string; path: string }) => void;
  export let onFolderBack: () => void;
  export let onBreadcrumbClick: (index: number) => void;
  export let onDeleteFolder: (folder: { name: string; path: string }) => void;
  export let onRenameFolder: (
    folder: { name: string; path: string },
    newName: string,
  ) => void;
  export let onMoveFolder: (folder: { name: string; path: string }) => void;
  export let onUpdateFolderColor: (
    folder: { name: string; path: string },
    color: string,
  ) => void;

  let newNoteName = "";
  let showInput = false;
  let addTitleInput: HTMLInputElement;
  let selectedType: string = "md";
  let isCategoryMenuOpen = false;
  let activeNoteMenu: string | null = null;
  let activeFolderMenu: string | null = null;
  let folderRenamePrompt: {
    folder: { name: string; path: string };
    value: string;
  } | null = null;
  let folderRenameInput = "";
  let folderColorPicker: string | null = null;

  const categoryColors = [
    {
      value: "vscode-default",
      swatch: "var(--vscode-sideBarTitle-foreground)",
      title: "VS Code default",
    },
    {
      value: "vscode-muted",
      swatch:
        "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)",
      title: "VS Code muted",
    },
    {
      value: "vscode-soft",
      swatch: "var(--vscode-editor-background)",
      title: "VS Code surface",
    },
    { value: "#fc5c65", swatch: "#fc5c65", title: "Red" },
    { value: "#fd9644", swatch: "#fd9644", title: "Orange" },
    { value: "#fed330", swatch: "#fed330", title: "Gold" },
    { value: "#26de81", swatch: "#26de81", title: "Green" },
    { value: "#2bcbba", swatch: "#2bcbba", title: "Turquoise" },
    { value: "#eb3b5a", swatch: "#eb3b5a", title: "Crimson" },
    { value: "#fa8231", swatch: "#fa8231", title: "Tangerine" },
    { value: "#f7b731", swatch: "#f7b731", title: "Amber" },
    { value: "#20bf6b", swatch: "#20bf6b", title: "Emerald" },
    { value: "#0fb9b1", swatch: "#0fb9b1", title: "Teal" },
    { value: "#45aaf2", swatch: "#45aaf2", title: "Sky" },
    { value: "#4b7bec", swatch: "#4b7bec", title: "Blue" },
    { value: "#a55eea", swatch: "#a55eea", title: "Purple" },
    { value: "#d1d8e0", swatch: "#d1d8e0", title: "Silver" },
    { value: "#778ca3", swatch: "#778ca3", title: "Steel" },
    { value: "#2d98da", swatch: "#2d98da", title: "Ocean" },
    { value: "#3867d6", swatch: "#3867d6", title: "Royal blue" },
    { value: "#8854d0", swatch: "#8854d0", title: "Violet" },
    { value: "#a5b1c2", swatch: "#a5b1c2", title: "Cloud" },
    { value: "#4b6584", swatch: "#4b6584", title: "Slate" },
  ];

  const systemCategoryColors = categoryColors.slice(0, 3);
  const customCategoryColors = categoryColors.slice(3);

  function resolveFolderAccent(color?: string): string | undefined {
    if (
      !color ||
      color === "vscode-default" ||
      color === "vscode-muted" ||
      color === "vscode-soft"
    )
      return undefined;
    return color;
  }

  function select(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onSelect(note);
  }

  function create() {
    if (newNoteName.trim()) {
      onCreate(newNoteName.trim(), selectedType);
      newNoteName = "";
      showInput = false;
    }
  }

  async function toggleInput() {
    showInput = !showInput;
    isCategoryMenuOpen = false;
    activeNoteMenu = null;
    if (showInput) {
      await tick();
      addTitleInput?.focus();
    }
  }

  function requestDeleteCategory() {
    isCategoryMenuOpen = false;
    onDeleteCategory(selectedCategory);
  }

  function requestRenameCategory() {
    isCategoryMenuOpen = false;
    onRenameCategory(selectedCategory);
  }

  function updateCategoryColor(color: string) {
    onUpdateCategoryColor(selectedCategory, color);
    isCategoryMenuOpen = false;
  }

  function toggleCategoryMenu() {
    isCategoryMenuOpen = !isCategoryMenuOpen;
    activeNoteMenu = null;
  }

  function toggleNoteMenu(notePath: string) {
    activeNoteMenu = activeNoteMenu === notePath ? null : notePath;
    isCategoryMenuOpen = false;
  }

  function requestRenameFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onRename(note);
  }

  function requestDeleteFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onDelete(note);
  }

  function requestMoveFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onMove(note);
  }

  function requestExportFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onExport(note);
  }

  function getIconClass(note: { fileType?: string; name?: string }): string {
    if (note.name?.endsWith(".anemona-lock")) return "icon-file-lock";
    if (note.fileType === "key") return "icon-file-key";
    if (note.fileType === "command") return "icon-file-terminal";
    if (note.fileType === "todo") return "icon-list-todo";
    if (note.fileType === "snippet") return "icon-file-snippet";
    return "icon-file-text";
  }

  function closeCategoryMenu() {
    isCategoryMenuOpen = false;
  }

  function closeNoteMenu() {
    activeNoteMenu = null;
  }

  function openFolder(folder: { name: string; path: string }) {
    activeFolderMenu = null;
    onOpenFolder(folder);
  }

  function toggleFolderMenu(folderPath: string) {
    activeFolderMenu = activeFolderMenu === folderPath ? null : folderPath;
    activeNoteMenu = null;
    isCategoryMenuOpen = false;
    folderColorPicker = null;
  }

  function closeFolderMenu() {
    activeFolderMenu = null;
  }

  function requestFolderRename(folder: { name: string; path: string }) {
    activeFolderMenu = null;
    folderRenamePrompt = { folder, value: folder.name };
    folderRenameInput = folder.name;
  }

  function confirmFolderRename() {
    if (folderRenamePrompt && folderRenameInput.trim()) {
      onRenameFolder(folderRenamePrompt.folder, folderRenameInput.trim());
      folderRenamePrompt = null;
      folderRenameInput = "";
    }
  }

  function cancelFolderRename() {
    folderRenamePrompt = null;
    folderRenameInput = "";
  }

  function requestFolderDelete(folder: { name: string; path: string }) {
    activeFolderMenu = null;
    onDeleteFolder(folder);
  }

  function requestFolderMove(folder: { name: string; path: string }) {
    activeFolderMenu = null;
    onMoveFolder(folder);
  }

  function toggleFolderColorPicker(folderPath: string) {
    activeFolderMenu = null;
    folderColorPicker = folderColorPicker === folderPath ? null : folderPath;
  }

  function closeFolderColorPicker() {
    folderColorPicker = null;
  }

  function updateFolderColor(
    folder: { name: string; path: string },
    color: string,
  ) {
    onUpdateFolderColor(folder, color);
    folderColorPicker = null;
  }
</script>

<div class="notes-list">
  <div class="header">
    <div class="title-row">
      {#if parentFolderPath !== null}
        <button
          class="icon-btn back-btn"
          on:click={onFolderBack}
          title="Back to parent folder"
          ><span class="anemona icon-chevron-left"></span></button
        >
      {/if}
      <span class="title">{selectedCategory}</span>
    </div>
    <div class="header-actions">
      <button
        class="icon-btn primary-action"
        on:click={toggleInput}
        title="Add file"><span class="anemona icon-plus"></span></button
      >
      <div class="menu-wrap" class:menu-open={isCategoryMenuOpen}>
        <button
          class="icon-btn menu-trigger"
          on:click={toggleCategoryMenu}
          title="Category options"
          ><span class="anemona icon-cog"></span></button
        >
        {#if isCategoryMenuOpen}
          <div
            class="menu-popover category-menu"
            use:smartPopover={{
              open: isCategoryMenuOpen,
              onClose: closeCategoryMenu,
            }}
          >
            <button class="menu-item" on:click={requestRenameCategory}
              ><span class="anemona icon-edit-alt"></span><span>Rename</span
              ></button
            >
            {#if canDeleteCategory}
              <button class="menu-item danger" on:click={requestDeleteCategory}
                ><span class="anemona icon-trash-alt"></span><span>Delete</span
                ></button
              >
            {/if}
            <div class="menu-section-label"></div>
            <div class="color-grid system-colors">
              {#each systemCategoryColors as color}
                <button
                  class="color-swatch"
                  class:active={selectedCategoryConfig.color === color.value}
                  style={`--swatch:${color.swatch}`}
                  on:click={() => updateCategoryColor(color.value)}
                  title={color.title}
                ></button>
              {/each}
            </div>
            <div class="color-divider"></div>
            <div class="color-grid custom-colors">
              {#each customCategoryColors as color}
                <button
                  class="color-swatch"
                  class:active={selectedCategoryConfig.color === color.value}
                  style={`--swatch:${color.swatch}`}
                  on:click={() => updateCategoryColor(color.value)}
                  title={color.title}
                ></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#if folderBreadcrumb.length > 0}
    <div class="breadcrumb">
      <button
        class="breadcrumb-item icon-btn"
        aria-label="Root"
        on:click={() => onBreadcrumbClick(-1)}
        ><span class="anemona icon-home"></span></button
      >
      {#each folderBreadcrumb as segment, i}
        <span class="breadcrumb-sep">/</span>
        <button
          class="breadcrumb-item"
          class:active={i === folderBreadcrumb.length - 1}
          on:click={() => onBreadcrumbClick(i)}
        >
          {segment}
        </button>
      {/each}
    </div>
  {/if}

  {#each folders as folder}
    <div
      class="note-item folder-item"
      style={resolveFolderAccent(folder.color)
        ? `background: color-mix(in srgb, ${resolveFolderAccent(folder.color)} 10%, var(--vscode-editor-background))`
        : ""}
    >
      <button class="note-btn" on:click={() => openFolder(folder)}>
        <span
          class="note-icon anemona icon-folder"
          style={resolveFolderAccent(folder.color)
            ? `color: ${resolveFolderAccent(folder.color)}`
            : ""}
        ></span>
        <span class="note-name">{folder.name}</span>
      </button>
      <div class="note-actions">
        <div
          class="menu-wrap"
          class:menu-open={activeFolderMenu === folder.path}
        >
          <button
            class="icon-btn note-action-btn"
            on:click|stopPropagation={() => toggleFolderMenu(folder.path)}
            title="Folder options"
            ><span class="anemona icon-dots-vertical"></span></button
          >
          {#if activeFolderMenu === folder.path}
            <div
              class="menu-popover folder-menu"
              use:smartPopover={{
                open: activeFolderMenu === folder.path,
                onClose: closeFolderMenu,
              }}
            >
              <button
                class="menu-item"
                on:click|stopPropagation={() => requestFolderRename(folder)}
                ><span class="anemona icon-edit-alt"></span><span>Rename</span
                ></button
              >
              <button
                class="menu-item"
                on:click|stopPropagation={() => requestFolderMove(folder)}
                ><span class="anemona icon-move"></span><span>Move to</span
                ></button
              >
              <button
                class="menu-item"
                on:click|stopPropagation={() =>
                  toggleFolderColorPicker(folder.path)}
                ><span class="anemona icon-color-fill"></span><span>Color</span
                ></button
              >
              {#if folder.isEmpty !== false}
                <button
                  class="menu-item danger"
                  on:click|stopPropagation={() => requestFolderDelete(folder)}
                  ><span class="anemona icon-trash-alt"></span><span>Delete</span
                  ></button
                >
              {/if}
            </div>
          {/if}
        </div>
      </div>
      {#if folderColorPicker === folder.path}
        <div class="folder-color-popover">
          <div class="color-grid system-colors">
            {#each systemCategoryColors as color}
              <button
                class="color-swatch"
                class:active={folder.color === color.value}
                style={`--swatch:${color.swatch}`}
                on:click|stopPropagation={() =>
                  updateFolderColor(folder, color.value)}
                title={color.title}
              ></button>
            {/each}
          </div>
          <div class="color-divider"></div>
          <div class="color-grid custom-colors">
            {#each customCategoryColors as color}
              <button
                class="color-swatch"
                class:active={folder.color === color.value}
                style={`--swatch:${color.swatch}`}
                on:click|stopPropagation={() =>
                  updateFolderColor(folder, color.value)}
                title={color.title}
              ></button>
            {/each}
          </div>
          <button
            class="color-picker-cancel"
            on:click|stopPropagation={closeFolderColorPicker}
            title="Close color picker">Cancel</button
          >
        </div>
      {/if}
    </div>
  {/each}

  {#each notes as note}
    <div class="note-item">
      <button class="note-btn" on:click={() => select(note)}>
        <span class={`note-icon anemona ${getIconClass(note)}`}></span>
        <span class="note-name">{note.displayName || note.name}</span>
      </button>
      <div class="note-actions">
        <div
          class="menu-wrap"
          class:menu-open={activeNoteMenu === note.filePath}
        >
          <button
            class="icon-btn note-action-btn"
            on:click|stopPropagation={() => toggleNoteMenu(note.filePath)}
            title="File options"
            ><span class="anemona icon-dots-vertical"></span></button
          >
          {#if activeNoteMenu === note.filePath}
            <div
              class="menu-popover note-menu"
              use:smartPopover={{
                open: activeNoteMenu === note.filePath,
                onClose: closeNoteMenu,
              }}
            >
              <button
                class="menu-item"
                on:click|stopPropagation={() => requestRenameFromMenu(note)}
                ><span class="anemona icon-edit-alt"></span><span>Rename</span
                ></button
              >
              <button
                class="menu-item"
                on:click|stopPropagation={() => requestMoveFromMenu(note)}
                ><span class="anemona icon-move"></span><span>Move to</span
                ></button
              >
              <button
                class="menu-item"
                on:click|stopPropagation={() => requestExportFromMenu(note)}
                ><span class="anemona icon-export"></span><span>Export</span
                ></button
              >
              <button
                class="menu-item danger"
                on:click|stopPropagation={() => requestDeleteFromMenu(note)}
                ><span class="anemona icon-trash-alt"></span><span>Delete</span
                ></button
              >
            </div>
          {/if}
        </div>
      </div>
      {#if note.fileType === "todo" && note.progress}
        <div class="todo-progress-bar">
          <span class="todo-progress-fill" style="width:{note.progress}%"
          ></span>
        </div>
      {/if}
    </div>
  {/each}

  <button class="add-entry-btn" on:click={toggleInput}
    ><span class="anemona icon-plus"></span> Add entry</button
  >
</div>

{#if showInput}
  <button class="modal-backdrop" on:click={toggleInput} aria-label="Close"
  ></button>
  <div class="add-modal">
    <h3>Add entry</h3>
    <input
      class="modal-field"
      type="text"
      placeholder="Name"
      bind:this={addTitleInput}
      bind:value={newNoteName}
      on:keydown={(e) => e.key === "Enter" && create()}
    />
    <select class="modal-field" bind:value={selectedType}>
      <option value="md">Text</option>
      <option value="key">Key</option>
      <option value="command">Cmd</option>
      <option value="todo">Todo</option>
      <option value="snippet">Snip</option>
      <option value="folder">Folder</option>
    </select>
    <div class="modal-actions">
      <button class="btn" on:click={toggleInput}>Cancel</button>
      <button class="btn primary" on:click={create}>Add</button>
    </div>
  </div>
{/if}

{#if folderRenamePrompt}
  <button
    class="modal-backdrop"
    on:click={cancelFolderRename}
    aria-label="Close"
  ></button>
  <div class="add-modal">
    <h3>Rename folder</h3>
    <input
      class="modal-field"
      type="text"
      placeholder="New name"
      bind:value={folderRenameInput}
      on:keydown={(e) => e.key === "Enter" && confirmFolderRename()}
    />
    <div class="modal-actions">
      <button class="btn" on:click={cancelFolderRename}>Cancel</button>
      <button class="btn primary" on:click={confirmFolderRename}>Save</button>
    </div>
  </div>
{/if}

<style>
  .notes-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 0.12rem 0.18rem 0.24rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 0.16rem;
    flex-shrink: 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    margin-bottom: 0.16rem;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 0.12rem;
    min-width: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.12rem;
  }

  .title {
    font-size: var(--ui-font-title);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    opacity: 0.95;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .primary-action {
    color: color-mix(
      in srgb,
      var(--accent-color, var(--vscode-textLink-foreground)) 82%,
      white 18%
    );
  }

  .menu-wrap {
    position: relative;
    z-index: 0;
  }

  .menu-wrap.menu-open {
    z-index: 20;
  }

  .add-entry-btn {
    width: 100%;
    background: color-mix(
      in srgb,
      var(--accent-color) 5%,
      var(--vscode-editor-background)
    );
    border: 1px dashed var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    min-height: var(--ui-control-height);
    padding: 0.26rem 0.38rem;
    font-size: var(--ui-font-control);
    font-weight: 400;
    margin-bottom: 0.24rem;
    opacity: 0.84;
  }

  .add-entry-btn:hover {
    opacity: 1;
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .note-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    transition:
      background 0.14s,
      border-color 0.14s,
      border-color 0.14s;
    min-height: calc(var(--ui-control-height) + 0.04rem);
  }

  .note-item:hover {
    background: color-mix(in srgb, var(--accent-color) 6%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 12%, transparent);
  }

  .note-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.16rem;
    background: none;
    border: none;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: var(--ui-font-entry);
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.78;
  }

  .note-btn:hover {
    opacity: 1;
  }

  .note-icon {
    font-size: 0.9em;
    flex-shrink: 0;
    opacity: 0.92;
  }

  .note-name {
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 400;
    letter-spacing: 0;
  }

  .note-actions {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0;
    margin-right: 0.12rem;
  }

  .note-action-btn {
    opacity: 0.55;
    font-size: 1em;
  }

  .todo-progress-bar {
    width: 100%;
    height: 2px;
    background: color-mix(in srgb, var(--accent-color) 12%, transparent);
    border-radius: 1px;
    margin: 0 0.34rem 0.1rem;
    overflow: hidden;
    flex: 0 0 100%;
  }

  .todo-progress-fill {
    display: block;
    height: 100%;
    background: color-mix(in srgb, var(--accent-color) 60%, white 40%);
    border-radius: 1px;
    transition: width 0.3s ease;
  }

  .icon-btn {
    background: color-mix(
      in srgb,
      var(--vscode-editor-background) 96%,
      white 4%
    );
    border: 1px solid color-mix(in srgb, var(--accent-color) 10%, transparent);
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.72em;
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 14%, transparent);
  }

  .menu-popover {
    position: absolute;
    top: calc(100% + 0.16rem);
    bottom: auto;
    left: auto;
    right: 0;
    min-width: 6.9rem;
    max-width: min(var(--popover-max-width, 20rem), calc(100vw - 1rem));
    max-height: var(--popover-max-height, 24rem);
    overflow-y: auto;
    background: color-mix(
      in srgb,
      var(--vscode-editor-background) 97%,
      white 3%
    );
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
    padding: 0.14rem;
    z-index: 12;
  }

  :global(.menu-popover[data-vertical="up"]) {
    top: auto;
    bottom: calc(100% + 0.16rem);
  }

  :global(.menu-popover[data-horizontal="left"]) {
    left: 0;
    right: auto;
  }

  .category-menu {
    width: 8.5rem;
  }

  .note-menu {
    min-width: 6.9rem;
  }

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.34rem;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    border-radius: 0;
    padding: var(--ui-menu-pad-y) var(--ui-menu-pad-x);
    cursor: pointer;
    font-size: var(--ui-menu-font);
    text-align: left;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .menu-item.danger {
    color: #e87070;
  }

  .menu-section-label {
    padding: 0.14rem 0 0.08rem;
    font-size: var(--ui-font-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ui-muted);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    padding: 0;
    justify-items: stretch;
    align-items: stretch;
  }

  .color-grid.system-colors {
    grid-template-columns: repeat(3, 1fr);
    padding-bottom: 0;
  }

  .color-grid.custom-colors {
    padding-top: 0;
  }

  .color-divider {
    display: none;
  }

  .color-swatch {
    width: 100%;
    aspect-ratio: 1;
    height: auto;
    border-radius: 0;
    border: 1px solid color-mix(in srgb, var(--swatch) 70%, white 30%);
    background: var(--swatch);
    cursor: pointer;
    box-shadow: none;
    transition:
      outline-color 0.12s ease,
      filter 0.12s ease;
  }

  .color-swatch:hover {
    filter: brightness(1.08);
  }

  .color-swatch.active {
    outline: 2px solid
      color-mix(in srgb, var(--vscode-focusBorder) 78%, white 22%);
    outline-offset: -2px;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 30;
  }

  .add-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(300px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .add-modal h3 {
    margin: 0;
    font-size: var(--ui-font-lg);
    font-weight: 600;
  }

  .modal-field {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    font-size: var(--ui-font-control);
  }

  .modal-field:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-gap-2);
    margin-top: 0.2rem;
  }

  .btn {
    padding: 0.3rem 0.62rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-control);
    font-weight: 500;
    background: var(--ui-soft);
    color: var(--vscode-foreground);
  }

  .btn:hover {
    background: var(--ui-soft-2);
  }

  .btn.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: color-mix(
      in srgb,
      var(--vscode-button-background) 60%,
      transparent
    );
  }

  .btn.primary:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .back-btn {
    font-size: 0.78em;
    flex-shrink: 0;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.08rem;
    padding: 0.12rem 0.18rem;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    border-bottom: 1px solid
      color-mix(in srgb, var(--accent-color) 8%, var(--ui-border));
    flex-shrink: 0;
    overflow-x: auto;
    white-space: nowrap;
  }

  .breadcrumb-item {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: var(--ui-font-xs);
    padding: 0.06rem 0.1rem;
    border-radius: var(--ui-radius-sm);
    opacity: 0.75;
  }

  .breadcrumb-item:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
  }

  .breadcrumb-item.active {
    opacity: 1;
    color: var(--vscode-sideBarTitle-foreground);
    cursor: default;
    font-weight: 500;
  }

  .breadcrumb-sep {
    opacity: 0.4;
  }

  .folder-item .note-btn {
    opacity: 0.92;
  }

  .folder-item .note-btn:hover {
    opacity: 1;
  }

  .folder-menu {
    min-width: 6.9rem;
  }

  .folder-color-popover {
    width: 100%;
    padding: 0.24rem 0.34rem 0.1rem;
    box-sizing: border-box;
    flex: 0 0 100%;
    border-top: 1px solid
      color-mix(in srgb, var(--accent-color) 8%, var(--ui-border));
    margin-top: 0.08rem;
  }

  .folder-color-popover .color-grid {
    gap: 0.04rem;
  }

  .folder-color-popover .color-swatch {
    aspect-ratio: 1;
    width: 100%;
    height: auto;
    border-radius: 0;
    border: 1px solid color-mix(in srgb, var(--swatch) 70%, white 30%);
    background: var(--swatch);
    cursor: pointer;
  }

  .folder-color-popover .color-swatch:hover {
    filter: brightness(1.08);
  }

  .folder-color-popover .color-swatch.active {
    outline: 2px solid
      color-mix(in srgb, var(--vscode-focusBorder) 78%, white 22%);
    outline-offset: -2px;
  }

  .folder-color-popover .color-divider {
    display: none;
  }

  .color-picker-cancel {
    width: 100%;
    margin-top: 0.24rem;
    padding: 0.2rem 0;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-control);
    background: var(--ui-soft);
    color: var(--vscode-foreground);
    text-align: center;
  }

  .color-picker-cancel:hover {
    background: var(--ui-soft-2);
  }
</style>
