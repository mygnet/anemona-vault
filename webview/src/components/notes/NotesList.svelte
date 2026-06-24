<script lang="ts" context="module">
  let suppressNavigationUntil = 0;
</script>

<script lang="ts">
  import { t } from '../../i18n';
  import BreadcrumbBar from './BreadcrumbBar.svelte';
  import CategoryHeader from './CategoryHeader.svelte';
  import ColorPicker from '../ui/ColorPicker.svelte';
  import CreateEntryModal from './CreateEntryModal.svelte';
  import FolderListItem from './FolderListItem.svelte';
  import NoteListItem from './NoteListItem.svelte';
  import RenameFolderModal from './RenameFolderModal.svelte';

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
  export let folderBreadcrumb: string[] = [];
  export let selectedCategoryConfig: { color?: string; icon?: string } = {};
  export let currentFolderColor = '';
  export let categoryPath = "";
  export let canDeleteCategory = false;
  export let onSelect: (note: { name: string; filePath: string }) => void;
  export let onCreate: (title: string, fileType: string) => void;
  export let onDelete: (note: { name: string; filePath: string }) => void;
  export let onDeleteCategory: (category: string) => void;
  export let onRename: (note: { name: string; filePath: string }) => void;
  export let onMove: (note: { name: string; filePath: string }) => void;
  export let onExport: (note: { name: string; filePath: string }) => void;
  export let onImport: (note: { name: string; filePath: string }) => void;
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
  export let onDropItem: (data: {
    sourcePath: string;
    targetPath: string;
  }) => void;
  export let selectionSuggestion: { title?: string; type?: string } | null = null;
  export let onRequestSelectionCheck: () => void;

  let newNoteName = "";
  let selectionCheckPending = false;
  let selectionCheckTimer: ReturnType<typeof setTimeout> | null = null;
  let dragOverFolder: string | null = null;
  let isDragActive = false;
  let dropGuard = false;

  function guard(fn: () => void) {
    return (e: Event) => {
      if (isDragActive || dropGuard || Date.now() < suppressNavigationUntil) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }
      fn();
    };
  }
  let showInput = false;
  let selectedType: string = "md";
  let nameError = false;
  let isCategoryMenuOpen = false;
  let activeNoteMenu: string | null = null;
  let activeFolderMenu: string | null = null;
  let folderRenamePrompt: {
    folder: { name: string; path: string };
    value: string;
  } | null = null;
  let folderRenameInput = "";
  let showColorPicker: { type: 'category', active: string } | { type: 'folder', folder: { name: string; path: string; color?: string }, active: string } | null = null;

  $: currentFolder = folderBreadcrumb.length > 0
    ? {
        name: folderBreadcrumb[folderBreadcrumb.length - 1],
        path: `${categoryPath}/${folderBreadcrumb.join('/')}`,
        color: currentFolderColor,
        isEmpty: folders.length === 0 && notes.length === 0,
      }
    : null;

  function select(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onSelect(note);
  }

  function create() {
    const name = newNoteName.trim()
    if (!name) {
      nameError = true
      return
    }
    nameError = false
    onCreate(name, selectedType)
    newNoteName = ""
    showInput = false
  }

  async function toggleInput() {
    showInput = !showInput;
    isCategoryMenuOpen = false;
    activeNoteMenu = null;
    if (showInput) {
      newNoteName = "";
      selectedType = "md";
      nameError = false;
      showInput = false;
      selectionCheckPending = true;
      if (selectionCheckTimer) clearTimeout(selectionCheckTimer);
      onRequestSelectionCheck();
      selectionCheckTimer = setTimeout(() => {
        if (selectionCheckPending) {
          selectionCheckPending = false;
          newNoteName = "";
          showInput = true;
        }
      }, 250);
    } else {
      newNoteName = "";
      selectionCheckPending = false;
      if (selectionCheckTimer) clearTimeout(selectionCheckTimer);
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

  function handleCategoryColorSelect(color: string) {
    onUpdateCategoryColor(selectedCategory, color);
    showColorPicker = null;
  }

  function handleFolderColorSelect(color: string) {
    if (showColorPicker?.type === 'folder') {
      onUpdateFolderColor(showColorPicker.folder, color);
    }
    showColorPicker = null;
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

  function requestImportFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onImport(note);
  }

  function requestExportFromMenu(note: { name: string; filePath: string }) {
    activeNoteMenu = null;
    onExport(note);
  }

  $: if (selectionSuggestion && selectionCheckPending && (selectionSuggestion.title || selectionSuggestion.type)) {
    if (selectionSuggestion.title) newNoteName = selectionSuggestion.title;
    if (selectionSuggestion.type) selectedType = selectionSuggestion.type;
    selectionCheckPending = false;
    if (selectionCheckTimer) clearTimeout(selectionCheckTimer);
    showInput = true;
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

  function openFolderColorPicker(folder: { name: string; path: string; color?: string }) {
    activeFolderMenu = null;
    showColorPicker = { type: 'folder', folder, active: folder.color || '' };
  }

  function openCategoryColorPicker() {
    isCategoryMenuOpen = false;
    showColorPicker = { type: 'category', active: selectedCategoryConfig.color || '' };
  }

  function requestCurrentFolderRename() {
    isCategoryMenuOpen = false;
    if (currentFolder) requestFolderRename(currentFolder);
  }

  function requestCurrentFolderMove() {
    isCategoryMenuOpen = false;
    if (currentFolder) onMoveFolder(currentFolder);
  }

  function requestCurrentFolderDelete() {
    isCategoryMenuOpen = false;
    if (currentFolder) onDeleteFolder(currentFolder);
  }

  function openCurrentFolderColorPicker() {
    isCategoryMenuOpen = false;
    if (currentFolder) showColorPicker = { type: 'folder', folder: currentFolder, active: currentFolder.color || '' };
  }

  function handleColorPickerSelect(e: CustomEvent<string>) {
    if (showColorPicker?.type === 'category') handleCategoryColorSelect(e.detail)
    else handleFolderColorSelect(e.detail)
  }

  function handleDragStart(event: DragEvent, itemPath: string) {
    isDragActive = true;
    event.dataTransfer?.setData("text/plain", itemPath);
    event.dataTransfer!.effectAllowed = "move";
  }

  function handleDragEnd() {
    isDragActive = false;
    dragOverFolder = null;
  }

  function handleDragOver(event: DragEvent, targetPath?: string) {
    event.preventDefault();
    event.dataTransfer!.dropEffect = "move";
    if (targetPath) dragOverFolder = targetPath;
  }

  function handleDragEnter(event: DragEvent, folderPath: string) {
    event.preventDefault();
    dragOverFolder = folderPath;
  }

  function handleDragLeave() {
    dragOverFolder = null;
  }

  function handleDrop(event: DragEvent, targetPath: string) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    isDragActive = false;
    dropGuard = true;
    suppressNavigationUntil = Date.now() + 800;
    setTimeout(() => { dropGuard = false; }, 800);
    const sourcePath = event.dataTransfer?.getData("text/plain");
    if (sourcePath && sourcePath !== targetPath) {
      onDropItem({ sourcePath, targetPath });
    }
  }
</script>

<div class="notes-list">
  <CategoryHeader
    {selectedCategory}
    currentFolderName={currentFolder?.name || ''}
    isFolderContext={currentFolder !== null}
    {canDeleteCategory}
    canDeleteFolder={currentFolder?.isEmpty === true}
    canGoBack={folderBreadcrumb.length > 0}
    menuOpen={isCategoryMenuOpen}
    on:back={guard(onFolderBack)}
    on:add={toggleInput}
    on:toggleMenu={toggleCategoryMenu}
    on:closeMenu={closeCategoryMenu}
    on:rename={requestRenameCategory}
    on:delete={requestDeleteCategory}
    on:color={openCategoryColorPicker}
    on:folderRename={requestCurrentFolderRename}
    on:folderMove={requestCurrentFolderMove}
    on:folderDelete={requestCurrentFolderDelete}
    on:folderColor={openCurrentFolderColorPicker}
  />

  <BreadcrumbBar
    segments={folderBreadcrumb}
    {categoryPath}
    dragOverPath={dragOverFolder}
    on:navigate={(event) => guard(() => onBreadcrumbClick(event.detail))(event)}
    on:dragOver={(event) => handleDragOver(event.detail.event, event.detail.path)}
    on:dragEnter={(event) => handleDragEnter(event.detail.event, event.detail.path)}
    on:dragLeave={handleDragLeave}
    on:drop={(event) => handleDrop(event.detail.event, event.detail.path)}
  />

  {#each folders as folder}
    <FolderListItem
      {folder}
      menuOpen={activeFolderMenu === folder.path}
      dragOver={dragOverFolder === folder.path}
      on:open={guard(() => openFolder(folder))}
      on:toggleMenu={() => toggleFolderMenu(folder.path)}
      on:closeMenu={closeFolderMenu}
      on:rename={() => requestFolderRename(folder)}
      on:move={() => requestFolderMove(folder)}
      on:color={() => openFolderColorPicker(folder)}
      on:delete={() => requestFolderDelete(folder)}
      on:dragStart={(event) => handleDragStart(event.detail.event, event.detail.path)}
      on:dragEnd={handleDragEnd}
      on:dragOver={(event) => handleDragOver(event.detail.event, event.detail.path)}
      on:dragEnter={(event) => handleDragEnter(event.detail.event, event.detail.path)}
      on:dragLeave={handleDragLeave}
      on:drop={(event) => handleDrop(event.detail.event, event.detail.path)}
    />
  {/each}

  {#each notes as note}
    <NoteListItem
      {note}
      menuOpen={activeNoteMenu === note.filePath}
      on:select={guard(() => select(note))}
      on:toggleMenu={() => toggleNoteMenu(note.filePath)}
      on:closeMenu={closeNoteMenu}
      on:rename={() => requestRenameFromMenu(note)}
      on:move={() => requestMoveFromMenu(note)}
      on:import={() => requestImportFromMenu(note)}
      on:export={() => requestExportFromMenu(note)}
      on:delete={() => requestDeleteFromMenu(note)}
      on:dragStart={(event) => handleDragStart(event.detail.event, event.detail.path)}
      on:dragEnd={handleDragEnd}
    />
  {/each}

  <button
    class="notes-list__add-entry"
    class:notes-list__add-entry--empty={notes.length === 0 && folders.length === 0}
    on:click={toggleInput}
    ><span class="anemona icon-plus"></span> {$t('notesList.addEntry')}</button
  >
</div>

{#if showInput}
  <CreateEntryModal
    bind:name={newNoteName}
    bind:selectedType
    {nameError}
    on:add={create}
    on:cancel={toggleInput}
  />
{/if}

{#if folderRenamePrompt}
  <RenameFolderModal
    bind:value={folderRenameInput}
    on:save={confirmFolderRename}
    on:cancel={cancelFolderRename}
  />
{/if}

{#if showColorPicker}
<ColorPicker
  activeColor={showColorPicker.active}
  on:select={handleColorPickerSelect}
  on:close={() => showColorPicker = null}
/>
{/if}

<style>
  .notes-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.12rem 0.18rem 0;
    box-sizing: border-box;
  }

</style>
