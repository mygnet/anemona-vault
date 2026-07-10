<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte'
  import { t } from '../../i18n'
  import { COPY_FEEDBACK_MS } from '../../utils/clipboard'
  import { nextSortDirection, type SortDirection } from '../../utils/sortUtils'
  import SearchToolbar from '../ui/SearchToolbar.svelte'
  import FormModal from '../ui/FormModal.svelte'
  import EditorHeader from '../layout/EditorHeader.svelte'
  import EntryTitleBar from '../layout/EntryTitleBar.svelte'

  type ShotEntry = {
    id: string
    filename: string
    path: string
    mimeType: string
    fileSize?: number
    createdAt: string
    updatedAt: string
    title?: string
    description?: string
    url?: string
    tags?: string[]
  }

  export let entries: ShotEntry[] = []
  export let selectedNote: { name: string; filePath: string }
  export let shotImagesUri = ''
  export let initialFilterText = ''
  export let onRenameNote: (() => void) | null = null
  export let onMoveNote: (() => void) | null = null
  export let onImportNote: (() => void) | null = null
  export let onExportNote: (() => void) | null = null
  export let onDeleteNote: (() => void) | null = null

  let localEntries = entries.map(e => ({ ...e }))
  let _prevEntries = entries
  $: if (entries !== localEntries && entries !== _prevEntries) {
    _prevEntries = entries
    localEntries = entries.map(e => ({ ...e }))
  }

  const dispatch = createEventDispatcher<{
    save: ShotEntry[]
    back: void
    saveImage: { notePath: string; filename: string; data: string }
    saveShot: { notePath: string; entries: ShotEntry[]; image: { filename: string; data: string } | null }
    openExternal: { type: string; value: string }
    openShotImage: { notePath: string; filename: string }
    copyShotImage: { notePath: string; filename: string }
    deleteShotImage: { notePath: string; filename: string }
  }>()

  let filterText = initialFilterText || ''
  let sortDirection: SortDirection = null
  let selectedImage: ShotEntry | null = null
  let previewUrl = ''
  let editEntry: ShotEntry | null = null
  let editTitle = ''
  let editDescription = ''
  let editUrl = ''
  let editTags = ''
  let editNewImageData: string | null = null
  let editReplacing = false
  let deleteConfirm: ShotEntry | null = null

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
  const MIME_BY_EXTENSION: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }
  const EXTENSION_BY_MIME: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  }

  $: noteName = selectedNote?.name || 'Shot'

  let pasteVisible = false
  let pastePreviewUrl: string | null = null
  let pastePendingEntry: { filename: string; mimeType: string; data: string } | null = null
  let pasteTitle = ''
  let pasteDescription = ''
  let pasteUrl = ''
  let pasteTags = ''
  let pasteZone: HTMLDivElement
  let openMenuId: string | null = null
  let copiedIndex: string | null = null
  let imageDimensions: Record<string, string> = {}
  let shotContent: HTMLDivElement
  let scrollAnchor: HTMLSpanElement
  $: modKey = navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'

  let loadedImages: Record<string, boolean> = {}
  let refreshSeed = 0

  function scrollToBottom() {
    tick().then(() => {
      scrollAnchor?.scrollIntoView({ block: 'nearest' })
      if (!shotContent) return
      const ro = new ResizeObserver(() => {
        scrollAnchor?.scrollIntoView({ block: 'nearest' })
      })
      ro.observe(shotContent)
      setTimeout(() => ro.disconnect(), 2000)
    })
  }

  function getImageUrl(entry: ShotEntry): string {
    const base = shotImagesUri.replace(/\/+$/, '')
    return `${base}/${encodeURIComponent(entry.filename)}?t=${refreshSeed}`
  }

  function getThumbnailUrl(entry: ShotEntry): string {
    return getImageUrl(entry)
  }

  function toggleMenu(entry: ShotEntry) {
    openMenuId = openMenuId === entry.id ? null : entry.id
  }

  function closeMenu() {
    openMenuId = null
  }

  function formatMimeType(mimeType: string): string {
    if (!mimeType) return 'Image'
    return mimeType.replace(/^image\//, '').replace('svg+xml', 'svg').toUpperCase()
  }

  function formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function onImageLoaded(entry: ShotEntry, event: Event) {
    loadedImages[entry.id] = true
    loadedImages = loadedImages
    const img = event.currentTarget as HTMLImageElement
    if (!img.naturalWidth || !img.naturalHeight) return
    imageDimensions = {
      ...imageDimensions,
      [entry.id]: `${img.naturalWidth}x${img.naturalHeight}`,
    }
  }

  function onImageError(entry: ShotEntry) {
    loadedImages[entry.id] = true
    loadedImages = loadedImages
  }

  $: filteredEntries = (() => {
    let result = [...localEntries]
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase()
      result = result.filter((e) => {
        const titleMatch = e.title?.toLowerCase().includes(q)
        const descMatch = e.description?.toLowerCase().includes(q)
        const urlMatch = e.url?.toLowerCase().includes(q)
        const fileMatch = e.filename.toLowerCase().includes(q)
        const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(q))
        return titleMatch || descMatch || urlMatch || fileMatch || tagMatch
      })
    }
    if (sortDirection === 'asc') {
      result.sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename))
    } else if (sortDirection === 'desc') {
      result.sort((a, b) => (b.title || b.filename).localeCompare(a.title || a.filename))
    }
    return result
  })()

  function toggleSort() {
    sortDirection = nextSortDirection(sortDirection)
  }

  function openFilePicker() {
    document.getElementById('shot-file-input')?.click()
  }

  function resetPasteForm() {
    pasteVisible = false
    pastePreviewUrl = null
    pastePendingEntry = null
    pasteTitle = ''
    pasteDescription = ''
    pasteUrl = ''
    pasteTags = ''
  }

  function getExtensionFromName(name: string): string {
    const ext = '.' + (name.split('.').pop() || '').toLowerCase()
    return IMAGE_EXTENSIONS.includes(ext) ? ext : ''
  }

  function getMimeFromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;,]+)[;,]/)
    return match?.[1]?.startsWith('image/') ? match[1] : ''
  }

  function resolveImageType(options: { name?: string; mimeType?: string; dataUrl?: string }): { ext: string; mimeType: string } {
    const nameExt = options.name ? getExtensionFromName(options.name) : ''
    const mimeType = (options.mimeType || getMimeFromDataUrl(options.dataUrl || '') || MIME_BY_EXTENSION[nameExt] || 'image/png').toLowerCase()
    const ext = nameExt || EXTENSION_BY_MIME[mimeType] || '.png'
    return { ext, mimeType: MIME_BY_EXTENSION[ext] || mimeType }
  }

  function createImageFilename(ext: string, usedNames = new Set(localEntries.map((entry) => entry.filename))): string {
    let timestamp = Date.now()
    let filename = `${timestamp}${ext}`
    while (usedNames.has(filename)) {
      timestamp += 1
      filename = `${timestamp}${ext}`
    }
    usedNames.add(filename)
    return filename
  }


  async function readClipboardImage(): Promise<boolean> {
    try {
      if (!navigator.clipboard?.read) return false
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue
          const blob = await item.getType(type)
          const dataUrl = await blobToDataUrl(blob)
          pastePreviewUrl = dataUrl
          const { ext, mimeType } = resolveImageType({ mimeType: type || blob.type, dataUrl })
          const filename = createImageFilename(ext)
          pastePendingEntry = { filename, mimeType, data: dataUrl }
          return true
        }
      }
    } catch {
      return false
    }
    return false
  }

  async function openSmartAddImage() {
    resetPasteForm()
    const hasClipboardImage = await readClipboardImage()
    if (!hasClipboardImage) {
      openFilePicker()
      return
    }
    pasteVisible = true
    await tick()
    pasteZone?.focus()
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    const files = Array.from(input.files)
    const now = new Date().toISOString()
    const newEntries: ShotEntry[] = []
    const usedNames = new Set(localEntries.map((entry) => entry.filename))

    const promises: Promise<void>[] = []

    for (const file of files) {
      const { ext, mimeType } = resolveImageType({ name: file.name, mimeType: file.type })
      if (!IMAGE_EXTENSIONS.includes(ext)) continue

      const id = crypto.randomUUID()
      const uniqueName = createImageFilename(ext, usedNames)
      newEntries.push({
        id,
        filename: uniqueName,
        path: `images/${uniqueName}`,
        mimeType,
        createdAt: now,
        updatedAt: now,
      })

      promises.push(new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          dispatch('saveImage', {
            notePath: selectedNote.filePath,
            filename: uniqueName,
            data: reader.result as string,
          })
          resolve()
        }
        reader.readAsDataURL(file)
      }))
    }

    if (newEntries.length === 0) return

    Promise.all(promises).then(() => {
      localEntries = [...localEntries, ...newEntries]
      dispatch('save', localEntries)
      refreshSeed++
      scrollToBottom()
    }).catch((err) => {
      console.error('Failed to save images:', err)
    })
  }

  async function openPaste() {
    resetPasteForm()
    pasteVisible = true

    await tick()
    pasteZone?.focus()
    await readClipboardImage()
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  function handlePasteCapture(event: ClipboardEvent) {
    event.preventDefault()
    const items = event.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (!item.type.startsWith('image/')) continue

      const file = item.getAsFile()
      if (!file) continue

      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        pastePreviewUrl = dataUrl

        const { ext, mimeType } = resolveImageType({ name: file.name, mimeType: item.type || file.type, dataUrl })
        const filename = createImageFilename(ext)
        pastePendingEntry = { filename, mimeType, data: dataUrl }
      }
      reader.readAsDataURL(file)
      break
    }
  }

  function confirmPaste() {
    if (!pastePendingEntry) return

    const now = new Date().toISOString()
    const entry: ShotEntry = {
      id: crypto.randomUUID(),
      filename: pastePendingEntry.filename,
      path: `images/${pastePendingEntry.filename}`,
      mimeType: pastePendingEntry.mimeType,
      createdAt: now,
      updatedAt: now,
      title: pasteTitle.trim() || undefined,
      description: pasteDescription.trim() || undefined,
      url: pasteUrl.trim() || undefined,
      tags: pasteTags.split(',').map((t) => t.trim()).filter(Boolean),
    }

    localEntries = [...localEntries, entry]

    dispatch('saveShot', {
      notePath: selectedNote.filePath,
      entries: localEntries,
      image: {
        filename: pastePendingEntry.filename,
        data: pastePendingEntry.data,
      },
    })

    refreshSeed++
    closePaste()
    scrollToBottom()
  }

  function closePaste() {
    resetPasteForm()
  }

  function openPreview(entry: ShotEntry) {
    selectedImage = entry
    previewUrl = getImageUrl(entry)
  }

  function closePreview() {
    selectedImage = null
    previewUrl = ''
  }

  async function copyImage(entry: ShotEntry) {
    const url = getImageUrl(entry)
    try {
      const resp = await fetch(url)
      let blob = await resp.blob()
      const mime = blob.type || entry.mimeType || 'image/png'

      if (mime === 'image/jpeg' || mime === 'image/jpg') {
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bitmap, 0, 0)
        blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png'),
        )
        bitmap.close()
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ])
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({ [mime]: blob }),
        ])
      }
      copiedIndex = entry.id
      setTimeout(() => {
        if (copiedIndex === entry.id) copiedIndex = null
      }, COPY_FEEDBACK_MS)
    } catch {
      dispatch('copyShotImage', {
        notePath: selectedNote.filePath,
        filename: entry.filename,
      })
      copiedIndex = entry.id
      setTimeout(() => {
        if (copiedIndex === entry.id) copiedIndex = null
      }, COPY_FEEDBACK_MS)
    }
  }

  function deleteEntry(entry: ShotEntry) {
    deleteConfirm = entry
    closePreview()
  }

  function confirmDelete() {
    if (!deleteConfirm) return
    const deletedId = deleteConfirm.id
    const deletedFilename = deleteConfirm.filename
    localEntries = localEntries.filter((e) => e.id !== deletedId)

    dispatch('deleteShotImage', {
      notePath: selectedNote.filePath,
      filename: deletedFilename,
    })

    dispatch('save', localEntries)
    deleteConfirm = null
    if (selectedImage?.id === deletedId) {
      closePreview()
    }
  }

  function cancelDelete() {
    deleteConfirm = null
  }

  async function handleEditPasteClick() {
    try {
      if (!navigator.clipboard?.read) return
      const items = await navigator.clipboard.read()
      for (const item of items) {
        for (const type of item.types) {
          if (!type.startsWith('image/')) continue
          const blob = await item.getType(type)
          const dataUrl = await blobToDataUrl(blob)
          editNewImageData = dataUrl
          editReplacing = true
          return
        }
      }
    } catch {
      // clipboard not available
    }
  }

  function openEdit(entry: ShotEntry) {
    editEntry = entry
    editTitle = entry.title || ''
    editDescription = entry.description || ''
    editUrl = entry.url || ''
    editTags = entry.tags?.join(', ') || ''
    editNewImageData = null
    editReplacing = false
  }

  function handleEditFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      editNewImageData = reader.result as string
      editReplacing = true
    }
    reader.readAsDataURL(file)
  }

  function cancelEditReplace() {
    editNewImageData = null
    editReplacing = false
  }

  function saveEdit() {
    if (!editEntry) return

    if (editReplacing && editNewImageData) {
      const { ext, mimeType } = resolveImageType({ name: '', mimeType: '', dataUrl: editNewImageData })
      const usedNames = new Set(localEntries.map((e) => e.filename))
      const newFilename = createImageFilename(ext, usedNames)
      const oldFilename = editEntry.filename
      const editId = editEntry.id

      localEntries = localEntries.map((e) => {
        if (e.id !== editId) return e
        return {
          ...e,
          filename: newFilename,
          path: `images/${newFilename}`,
          mimeType,
          title: editTitle.trim() || undefined,
          description: editDescription.trim() || undefined,
          url: editUrl.trim() || undefined,
          tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        }
      })

      dispatch('saveShot', {
        notePath: selectedNote.filePath,
        entries: localEntries,
        image: { filename: newFilename, data: editNewImageData },
      })

      dispatch('deleteShotImage', {
        notePath: selectedNote.filePath,
        filename: oldFilename,
      })

      editEntry = null
      editNewImageData = null
      editReplacing = false
      refreshSeed++
      if (selectedImage?.id === editId) {
        selectedImage = localEntries.find((e) => e.id === editId) || null
        previewUrl = getImageUrl(selectedImage!)
      }
      return
    }

    localEntries = localEntries.map((e) => {
      if (e.id !== editEntry.id) return e
      return {
        ...e,
        title: editTitle.trim() || undefined,
        description: editDescription.trim() || undefined,
        url: editUrl.trim() || undefined,
        tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        updatedAt: new Date().toISOString(),
      }
    })
    const editId = editEntry.id
    dispatch('save', localEntries)
    editEntry = null
    refreshSeed++
    if (selectedImage?.id === editId) {
      selectedImage = localEntries.find((e) => e.id === editId) || null
      previewUrl = getImageUrl(selectedImage!)
    }
  }

  function cancelEdit() {
    editEntry = null
    editNewImageData = null
    editReplacing = false
  }

  function openUrl(entry: ShotEntry) {
    if (!entry.url) return
    dispatch('openExternal', { type: 'url', value: entry.url })
  }

  function openImageFile(entry: ShotEntry) {
    dispatch('openShotImage', {
      notePath: selectedNote.filePath,
      filename: entry.filename,
    })
  }

  function handleCopySelected() {
    if (selectedImage) copyImage(selectedImage)
  }

  function handleOpenUrlSelected() {
    if (selectedImage) openUrl(selectedImage)
  }

  function handleEditSelected() {
    const entry = selectedImage
    if (entry) {
      closePreview()
      openEdit(entry)
    }
  }

  function handleDeleteSelected() {
    if (selectedImage) deleteEntry(selectedImage)
  }

  function formatDate(iso: string): string {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return iso
    }
  }

</script>

<div class="shot-editor editor-shell">
  <EditorHeader
    {noteName}
    showFileMenu
    onRename={onRenameNote}
    onMove={onMoveNote}
    onImport={onImportNote}
    onExport={onExportNote}
    onDelete={onDeleteNote}
    on:back={() => dispatch('back')}
  >
    <button class="btn icon-btn" on:click={openFilePicker} title={$t('shotEditor.addImages')}>
      <span class="anemona icon-hard-drive-upload"></span>
    </button>
    <button class="btn icon-btn" on:click={openPaste} title={$t('shotEditor.pasteImageShort')}>
      <span class="anemona icon-paste"></span>
    </button>
  </EditorHeader>

  <input id="shot-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple on:change={handleFileSelect} style="display:none" />

  <div class="shot-content" bind:this={shotContent}>
    {#if localEntries.length > 0}
      <SearchToolbar
        value={filterText}
        placeholder={$t('shotEditor.search')}
        {sortDirection}
        showSort={true}
        sortTitleAsc={$t('shotEditor.sortNameAsc')}
        sortTitleDesc={$t('shotEditor.sortNameDesc')}
        on:input={(e) => { filterText = e.detail }}
        on:toggleSort={toggleSort}
      />
    {/if}
    {#if filteredEntries.length === 0 && localEntries.length > 0}
      <div class="ui-empty">{$t('shotEditor.noImages')}</div>
    {/if}
    {#each filteredEntries as entry}
      <div class="shot-entry entry-list__item">
        <div class="entry-list__row">
          <EntryTitleBar
            title={entry.title || entry.filename}
            menuOpen={openMenuId === entry.id}
            menuTitle={$t('shotEditor.entryOptions')}
            editLabel={$t('common.edit')}
            deleteLabel={$t('shotEditor.delete')}
            on:toggleMenu={() => toggleMenu(entry)}
            on:closeMenu={closeMenu}
            on:edit={() => openEdit(entry)}
            on:delete={() => deleteEntry(entry)}
          >
            <button class="icon-action" on:click|stopPropagation={() => copyImage(entry)} title={$t('shotEditor.copy')}>
              <span class="anemona {copiedIndex === entry.id ? 'icon-check' : 'icon-copy'}"></span>
            </button>
            <button class="icon-action" on:click|stopPropagation={() => openImageFile(entry)} title={$t('shotEditor.viewImage')}>
              <span class="anemona icon-external-link"></span>
            </button>
            {#if entry.url}
              <button class="icon-action" on:click|stopPropagation={() => openUrl(entry)} title={$t('shotEditor.openUrl')}>
                <span class="anemona icon-link"></span>
              </button>
            {/if}
          </EntryTitleBar>
          <button class="shot-entry__preview entry-list__info" on:click={() => openPreview(entry)}>
            <div class="shot-entry__image-wrapper" class:shot-entry__image-wrapper--loading={!loadedImages[entry.id]}>
              {#if !loadedImages[entry.id]}
                <div class="shot-entry__image-skeleton"></div>
              {/if}
              <img src={getThumbnailUrl(entry)} alt={entry.title || entry.filename} class="shot-entry__image" class:shot-entry__image--hidden={!loadedImages[entry.id]} loading="lazy" on:load={(event) => onImageLoaded(entry, event)} on:error={() => onImageError(entry)} />
            </div>
          </button>
        </div>
      </div>
    {/each}
    <button class="shot-editor__add-entry add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openSmartAddImage}><span class="anemona icon-plus"></span> {$t('shotEditor.addImage')}</button>
    <span bind:this={scrollAnchor}></span>
  </div>
</div>

{#if pasteVisible}
  <FormModal
    modalClass="add-modal shot-paste-modal"
    title={$t('shotEditor.pasteImageShort')}
    ariaLabel={$t('common.close')}
    on:close={closePaste}
  >
    <div
      class="paste-area"
      class:paste-area--ready={pastePreviewUrl}
      bind:this={pasteZone}
    >
      {#if pastePreviewUrl}
        <img src={pastePreviewUrl} class="paste-preview" alt="" />
        <div class="paste-meta">
          <input id="paste-title" class="modal-field" type="text" bind:value={pasteTitle} placeholder={$t('shotEditor.titleLabel')} />
          <input id="paste-url" class="modal-field" type="url" bind:value={pasteUrl} placeholder={$t('shotEditor.urlLabel')} />
          <textarea id="paste-description" class="modal-field form-textarea" bind:value={pasteDescription} rows="3" placeholder={$t('shotEditor.descriptionLabel')}></textarea>
          <input id="paste-tags" class="modal-field" type="text" bind:value={pasteTags} placeholder={$t('shotEditor.tagsPlaceholder')} />
        </div>
      {:else}
        <button class="paste-trigger" on:click={readClipboardImage} title={$t('shotEditor.pasteImageShort')}>
          <span class="anemona icon-paste"></span>
        </button>
      {/if}
    </div>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={closePaste}>{$t('common.cancel')}</button>
      <button class="btn primary" disabled={!pastePendingEntry} on:click={confirmPaste}>{$t('common.save')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

{#if deleteConfirm}
  <FormModal
    modalClass="delete-modal"
    title={$t('shotEditor.confirmDeleteTitle')}
    ariaLabel={$t('common.close')}
    on:close={cancelDelete}
  >
    <p>{$t('shotEditor.confirmDeleteBody', { filename: deleteConfirm.filename })}</p>
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelDelete}>{$t('common.cancel')}</button>
      <button class="btn danger" on:click={confirmDelete}>{$t('common.delete')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

{#if selectedImage}
  <FormModal
    modalClass="shot-preview-modal"
    ariaLabel={$t('common.close')}
    on:close={closePreview}
  >
    <div class="preview-panel">
      <div class="preview-toolbar">
        <button class="btn icon-btn" on:click={closePreview} title={$t('common.close')}>
          <span class="anemona icon-x"></span>
        </button>
        <div class="preview-actions">
            <button class="btn icon-btn" on:click={handleCopySelected} title={$t('shotEditor.copy')}>
              <span class="anemona {selectedImage && copiedIndex === selectedImage.id ? 'icon-check' : 'icon-copy'}"></span>
            </button>
          {#if selectedImage.url}
            <button class="btn icon-btn" on:click={handleOpenUrlSelected} title={$t('shotEditor.openUrl')}>
              <span class="anemona icon-link"></span>
            </button>
          {/if}
          <button class="btn icon-btn" on:click={handleEditSelected} title={$t('common.edit')}>
            <span class="anemona icon-edit-alt"></span>
          </button>
          <button class="btn icon-btn danger" on:click={handleDeleteSelected} title={$t('shotEditor.delete')}>
            <span class="anemona icon-trash-alt"></span>
          </button>
        </div>
      </div>
      <div class="preview-image-container">
        <button class="preview-image-btn" on:click={() => openImageFile(selectedImage)} title={$t('shotEditor.viewImage')}>
          <img src={previewUrl} alt={selectedImage.filename} class="preview-image"
            on:load={(event) => onImageLoaded(selectedImage, event)} />
        </button>
      </div>
      <div class="preview-meta">
        {#if selectedImage.title}
          <div class="preview-meta-row">
            <span class="preview-meta-label">{$t('shotEditor.titleLabel')}</span>
            <span class="preview-meta-value">{selectedImage.title}</span>
          </div>
        {/if}
        <div class="preview-meta-row">
          <span class="preview-meta-label">{$t('shotEditor.filenameLabel')}</span>
          <span class="preview-meta-value">{selectedImage.filename}</span>
        </div>
        {#if selectedImage.description}
          <div class="preview-meta-row preview-meta-description">
            <span class="preview-meta-label">{$t('shotEditor.descriptionLabel')}</span>
            <span class="preview-meta-value">{selectedImage.description}</span>
          </div>
        {/if}
        {#if selectedImage.url}
          <div class="preview-meta-row">
            <span class="preview-meta-label">{$t('shotEditor.urlLabel')}</span>
            <a class="preview-meta-value preview-meta-link" href={selectedImage.url} target="_blank" rel="noreferrer">{selectedImage.url}</a>
          </div>
        {/if}
        {#if selectedImage.fileSize}
          <div class="preview-meta-row">
            <span class="preview-meta-label">{$t('shotEditor.sizeLabel')}</span>
            <span class="preview-meta-value">{formatBytes(selectedImage.fileSize)}</span>
          </div>
        {/if}
        <div class="preview-meta-row">
          <span class="preview-meta-label">{$t('shotEditor.typeLabel')}</span>
          <span class="preview-meta-value">{formatMimeType(selectedImage.mimeType)}</span>
        </div>
        {#if imageDimensions[selectedImage.id]}
          <div class="preview-meta-row">
            <span class="preview-meta-label">{$t('shotEditor.dimensionsLabel')}</span>
            <span class="preview-meta-value">{imageDimensions[selectedImage.id]}</span>
          </div>
        {/if}
        <div class="preview-meta-row">
          <span class="preview-meta-label">{$t('shotEditor.createdAt')}</span>
          <span class="preview-meta-value">{formatDate(selectedImage.createdAt)}</span>
        </div>
        {#if selectedImage.tags?.length}
          <div class="preview-meta-row preview-meta-tags">
            <span class="preview-meta-label">{$t('shotEditor.tagsLabel')}</span>
            <span class="preview-meta-value preview-tags">
              {#each selectedImage.tags as tag}
                <span class="preview-tag">{tag}</span>
              {/each}
            </span>
          </div>
        {/if}
      </div>
    </div>
  </FormModal>
{/if}

{#if editEntry}
  <FormModal
    modalClass="add-modal"
    title={$t('common.edit')}
    on:close={cancelEdit}
  >
    <div class="shot-editor__edit-image">
      {#if editReplacing && editNewImageData}
        <img src={editNewImageData} alt="" class="shot-editor__edit-preview" />
        <button class="icon-btn" on:click={cancelEditReplace} title={$t('common.cancel')}>
          <span class="anemona icon-x"></span>
        </button>
      {:else}
        <img src={getThumbnailUrl(editEntry)} alt={editEntry.filename} class="shot-editor__edit-preview" />
        <button class="icon-btn" on:click={() => document.getElementById('shot-edit-file-input')?.click()} title={$t('shotEditor.addImages')}>
          <span class="anemona icon-hard-drive-upload"></span>
        </button>
        <button class="icon-btn" on:click={handleEditPasteClick} title={$t('shotEditor.pasteImageShort')}>
          <span class="anemona icon-paste"></span>
        </button>
      {/if}
    </div>
    <input id="shot-edit-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" on:change={handleEditFileSelect} style="display:none" />
    <input class="modal-field" type="text" placeholder={$t('shotEditor.titleLabel')} bind:value={editTitle} />
    <textarea class="modal-field form-textarea" placeholder={$t('shotEditor.descriptionLabel')} bind:value={editDescription} rows="4"></textarea>
    <input class="modal-field" type="url" placeholder={$t('shotEditor.urlLabel')} bind:value={editUrl} />
    <input class="modal-field" type="text" placeholder={$t('shotEditor.tagsLabel')} bind:value={editTags} />
    <svelte:fragment slot="actions">
      <button class="btn" on:click={cancelEdit}>{$t('common.cancel')}</button>
      <button class="btn primary" on:click={saveEdit}>{$t('common.save')}</button>
    </svelte:fragment>
  </FormModal>
{/if}

<style>
  .shot-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  :global(.shot-preview-modal) {
    position: fixed;
    top: 0.5rem;
    left: 0.5rem;
    right: 0.5rem;
    bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    background: var(--theme-editor-modal-bg);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--theme-editor-modal-border);
    border-radius: var(--ui-radius-lg);
    padding: 0.75rem;
    z-index: var(--ui-z-modal);
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
    overflow: hidden;
  }

  .paste-area {
    position: relative;
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    border: 1px dashed var(--ui-border);
    border-radius: var(--ui-radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-gap-2);
    flex-shrink: 0;
  }

  .paste-trigger {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--ui-muted);
    padding: 1rem;
    border-radius: var(--ui-radius-sm);
  }

  .paste-trigger .anemona {
    font-size: 1.8rem;
  }

  .paste-trigger:hover {
    color: var(--vscode-foreground);
    background: var(--ui-soft);
  }

  .paste-meta {
    display: flex;
    flex-direction: column;
    gap: var(--ui-gap-1);
    width: 100%;
    max-width: 320px;
  }

  .paste-area--ready {
    border-color: var(--theme-accent-border-strong);
    background: var(--ui-active);
  }

  .paste-preview {
    max-width: 200px;
    max-height: 150px;
    object-fit: contain;
    border-radius: var(--ui-radius-sm);
    border: 1px solid var(--ui-border);
  }

  .shot-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .shot-entry__preview {
    width: 100%;
    display: block;
    padding: 0.35rem var(--ui-card-pad-x) var(--ui-card-pad-y);
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .shot-entry__image-wrapper {
    position: relative;
    width: 100%;
    min-height: 60px;
    border-radius: var(--ui-radius-sm);
  }

  .shot-entry__image-wrapper--loading {
    background: linear-gradient(90deg, var(--ui-soft) 25%, var(--ui-border) 50%, var(--ui-soft) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border: 1px solid var(--ui-border);
  }

  .shot-entry__image-skeleton {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ui-muted);
  }

  .shot-entry__image-skeleton::after {
    content: '';
    width: 1.5rem;
    height: 1.5rem;
    border: 2px solid var(--ui-muted);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .shot-entry__image {
    width: 100%;
    max-height: 140px;
    object-fit: contain;
    border-radius: var(--ui-radius-sm);
    border: 1px solid var(--ui-border);
    background: var(--theme-editor-card-bg);
  }

  .shot-entry__image--hidden {
    opacity: 0;
  }

  .preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-gap-1);
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    border-bottom: 1px solid var(--ui-border);
    flex-shrink: 0;
  }

  .preview-actions {
    display: flex;
    gap: var(--ui-gap-1);
  }

  .preview-image-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    overflow: hidden;
    background: var(--theme-editor-preview-bg, var(--ui-soft));
  }

  .preview-image-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-meta {
    padding: 0.25rem var(--ui-card-pad-x) 0.35rem;
    border-top: 1px solid var(--ui-border);
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    flex-shrink: 0;
  }

  .preview-meta-row {
    display: flex;
    flex-direction: column;
    gap: 0;
    font-size: var(--ui-font-xs);
    background: var(--theme-accent-surface);
    border-radius: var(--ui-radius-sm);
    padding: 0.1rem 0.35rem;
    min-width: 0;
  }

  .preview-meta-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.6em;
    line-height: 1.1;
  }

  .preview-meta-value {
    min-width: 0;
    font-size: var(--ui-font-xs);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .preview-meta-description .preview-meta-value {
    white-space: nowrap;
  }

  .preview-meta-link {
    color: var(--theme-accent-text);
    text-decoration: none;
    display: block;
  }

  .preview-meta-link:hover {
    text-decoration: underline;
  }

  .preview-tags {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.2rem;
    overflow: hidden;
    white-space: nowrap;
  }

  .preview-tag {
    font-size: var(--ui-font-xs);
    padding: 0.08rem 0.3rem;
    background: var(--ui-soft);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
  }

  .shot-editor__edit-image {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .shot-editor__edit-preview {
    width: 3rem;
    height: 3rem;
    object-fit: cover;
    border-radius: var(--ui-radius-sm);
    border: 1px solid var(--ui-border);
  }

</style>
