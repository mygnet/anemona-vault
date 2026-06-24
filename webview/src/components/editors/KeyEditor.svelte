<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { t } from "../../i18n";
  import type { SortDirection } from "../../utils/sortUtils";
  import EditorHeader from "../layout/EditorHeader.svelte";
  import EntryTitleBar from "../layout/EntryTitleBar.svelte";
  import KeyPasswordRow from "../ui/KeyPasswordRow.svelte";
  import SearchToolbar from "../ui/SearchToolbar.svelte";
  import DeleteConfirmModal from "../ui/DeleteConfirmModal.svelte";
  import { COPY_FEEDBACK_MS, copyText } from "../../utils/clipboard";
  import { parseKeySuggestion } from "../../utils/selectionParser";

  type Entry = {
    title: string;
    password: string;
    note?: string;
    url?: string;
    email?: string;
    username?: string;
    host?: string;
    port?: string;
    token?: string;
  };

  export let entries: Entry[] = [];
  export let locked = false;
  export let selectedNote: { name: string; filePath: string };
  export let initialFilterText = "";
  export let selectionSuggestion: {
    title?: string;
    type?: string;
    text?: string;
    requestId?: number;
  } | null = null;
  export let onRequestSelectionCheck: () => number;
  export let onRenameNote: (() => void) | null = null;
  export let onMoveNote: (() => void) | null = null;
  export let onImportNote: (() => void) | null = null;
  export let onExportNote: (() => void) | null = null;
  export let onDeleteNote: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    save: { entries: Entry[]; locked: boolean };
    back: void;
    unlock: string;
    lock: string;
    openExternal: { type: string; value: string };
  }>();

  const extraFields = [
    { key: "url", labelKey: "keyEditor.urlLabel" },
    { key: "email", labelKey: "keyEditor.emailLabel" },
    { key: "username", labelKey: "keyEditor.userLabel" },
    { key: "host", labelKey: "keyEditor.hostLabel" },
    { key: "port", labelKey: "keyEditor.portLabel" },
    { key: "note", labelKey: "keyEditor.noteLabel" },
    { key: "token", labelKey: "keyEditor.tokenLabel" },
  ] as const;

  let localEntries = entries.map((e) => ({ ...e }));
  let expanded: Set<number> = new Set();
  let openMenuIndex: number | null = null;
  let visiblePasswords: Set<number> = new Set();
  let unlockPassword = "";
  let unlockError = false;
  let copiedKey = "";
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  let keyModalMode: "add" | "edit" | null = null;
  let modalTitle = "";
  let modalPassword = "";
  let modalUrl = "";
  let modalEmail = "";
  let modalUsername = "";
  let modalHost = "";
  let modalPort = "";
  let modalToken = "";
  let modalNote = "";
  let keyTitleError = false;
  let keyPassError = false;
  let modalTitleInput: HTMLInputElement;
  let editingKeyIndex: number | null = null;

  let showLockForm = false;
  let lockPassInput = "";
  let lockPassConfirm = "";
  let lockPassError = "";
  let lockInputError = false;
  let lockConfirmError = false;
  let deletePrompt: { index: number; title: string } | null = null;
  let sortDirection: SortDirection = null;
  let _prevEntries = entries;
  let filterText = "";
  let lastAppliedInitialFilter = "";
  let entriesContainerElem: HTMLDivElement;

  let filledFromSuggestion = false;
  let activeSelectionRequestId = 0;

  $: if (
    selectionSuggestion?.text &&
    selectionSuggestion.requestId === activeSelectionRequestId &&
    keyModalMode === "add" &&
    !filledFromSuggestion
  ) {
    filledFromSuggestion = true;
    const parsed = parseKeySuggestion(selectionSuggestion.text);
    if (parsed.title) modalTitle = parsed.title;
    if (parsed.password) modalPassword = parsed.password;
    if (parsed.username) modalUsername = parsed.username;
    if (parsed.email) modalEmail = parsed.email;
    if (parsed.url) modalUrl = parsed.url;
    if (parsed.host) modalHost = parsed.host;
    if (parsed.port) modalPort = parsed.port;
    if (parsed.token) modalToken = parsed.token;
    if (parsed.note) modalNote = parsed.note;
  }

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText;
    lastAppliedInitialFilter = initialFilterText;
  }

  $: normalizedFilterText = filterText.trim().toLowerCase();

  $: filteredEntries =
    sortDirection !== null
      ? [...localEntries]
          .sort((a, b) => {
            const cmp = a.title.localeCompare(b.title);
            return sortDirection === "asc" ? cmp : -cmp;
          })
          .filter(
            (e) =>
              !normalizedFilterText ||
              [
                e.title,
                e.password,
                e.note,
                e.url,
                e.email,
                e.username,
                e.host,
                e.port,
                e.token,
              ].some((value) =>
                String(value || "")
                  .toLowerCase()
                  .includes(normalizedFilterText),
              ),
          )
      : localEntries.filter(
          (e) =>
            !normalizedFilterText ||
            [
              e.title,
              e.password,
              e.note,
              e.url,
              e.email,
              e.username,
              e.host,
              e.port,
              e.token,
            ].some((value) =>
              String(value || "")
                .toLowerCase()
                .includes(normalizedFilterText),
            ),
        );

  function toggleSort() {
    if (sortDirection === "asc") {
      sortDirection = "desc";
    } else if (sortDirection === "desc") {
      sortDirection = null;
    } else {
      sortDirection = "asc";
    }
  }

  $: if (entries !== _prevEntries) {
    _prevEntries = entries;
    if (entries !== localEntries) {
      localEntries = entries.map((e) => ({ ...e }));
    }
  }

  function toggleExpand(index: number) {
    if (expanded.has(index)) {
      expanded.delete(index);
    } else {
      expanded.add(index);
    }
    expanded = expanded;
  }

  function hasExtraFields(entry: Entry): boolean {
    return extraFields.some((def) => !!getField(entry, def.key));
  }

  function toggleEntryMenu(index: number) {
    openMenuIndex = openMenuIndex === index ? null : index;
  }

  function closeEntryMenu() {
    openMenuIndex = null;
  }

  function getField(entry: Entry, key: string): string {
    return (entry as Record<string, string | undefined>)[key] || "";
  }

  function togglePasswordVisibility(index: number, event?: Event) {
    event?.stopPropagation();
    if (visiblePasswords.has(index)) {
      visiblePasswords.delete(index);
    } else {
      visiblePasswords.add(index);
    }
    visiblePasswords = visiblePasswords;
  }

  function getMaskedPassword(password: string): string {
    return "\u2022".repeat(Math.min(password.length, 20));
  }

  function getPropertyIcon(key: string): string {
    switch (key) {
      case "url":
        return "icon-globe";
      case "email":
        return "icon-envelope";
      case "username":
        return "icon-user";
      case "host":
        return "icon-folder";
      case "port":
        return "icon-terminal";
      case "token":
        return "icon-token-security";
      case "note":
        return "icon-file-text";
      default:
        return "icon-file-text";
    }
  }

  async function openAddModal() {
    activeSelectionRequestId = 0;
    keyModalMode = "add";
    activeSelectionRequestId = onRequestSelectionCheck();
    filledFromSuggestion = false;
    modalTitle = "";
    modalPassword = "";
    modalUrl = "";
    modalEmail = "";
    modalUsername = "";
    modalHost = "";
    modalPort = "";
    modalToken = "";
    modalNote = "";
    await tick();
    modalTitleInput?.focus();
  }

  function openEditModal(index: number) {
    openMenuIndex = null;
    keyModalMode = "edit";
    editingKeyIndex = index;
    const e = localEntries[index];
    modalTitle = e.title;
    modalPassword = e.password;
    modalUrl = e.url || "";
    modalEmail = e.email || "";
    modalUsername = e.username || "";
    modalHost = e.host || "";
    modalPort = e.port || "";
    modalToken = e.token || "";
    modalNote = e.note || "";
  }

  function collectModalEntry(): {
    title: string;
    password: string;
    note?: string;
    url?: string;
    email?: string;
    username?: string;
    host?: string;
    port?: string;
    token?: string;
  } {
    const e: any = { title: modalTitle.trim(), password: modalPassword.trim() };
    if (modalUrl.trim()) e.url = modalUrl.trim();
    if (modalEmail.trim()) e.email = modalEmail.trim();
    if (modalUsername.trim()) e.username = modalUsername.trim();
    if (modalHost.trim()) e.host = modalHost.trim();
    if (modalPort.trim()) e.port = modalPort.trim();
    if (modalToken.trim()) e.token = modalToken.trim();
    if (modalNote.trim()) e.note = modalNote.trim();
    return e;
  }

  function saveModal() {
    const titleOk = modalTitle.trim();
    const passOk = modalPassword.trim();
    keyTitleError = !titleOk;
    keyPassError = !passOk;
    if (!titleOk || !passOk) return;
    if (keyModalMode === "add") {
      localEntries = [...localEntries, collectModalEntry()];
      tick().then(() => {
        if (entriesContainerElem)
          entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight;
      });
    } else if (editingKeyIndex !== null) {
      localEntries[editingKeyIndex] = collectModalEntry();
      localEntries = localEntries;
    }
    cancelModal();
    saveEntries();
  }

  function cancelModal() {
    keyModalMode = null;
    editingKeyIndex = null;
    modalTitle = "";
    modalPassword = "";
    modalUrl = "";
    modalEmail = "";
    modalUsername = "";
    modalHost = "";
    modalPort = "";
    keyTitleError = false;
    keyPassError = false;
    modalToken = "";
    modalNote = "";
    activeSelectionRequestId = 0;
    filledFromSuggestion = false;
  }

  function deleteEntry(index: number) {
    localEntries = localEntries.filter((_, i) => i !== index);
    if (editingKeyIndex === index) cancelModal();
    saveEntries();
  }

  function requestDeleteEntry(index: number) {
    openMenuIndex = null;
    deletePrompt = {
      index,
      title: localEntries[index].title,
    };
  }

  function cancelDeletePrompt() {
    deletePrompt = null;
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return;
    localEntries = localEntries.filter((_, i) => i !== deletePrompt?.index);
    saveEntries();
    deletePrompt = null;
  }

  function saveEntries() {
    dispatch("save", { entries: localEntries, locked });
  }

  async function doCopy(index: number, field: string, value: string) {
    if (!(await copyText(value))) return;
    const key = `${index}:${field}`;
    copiedKey = key;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedKey = "";
    }, COPY_FEEDBACK_MS);
  }

  function doOpen(type: string, value: string) {
    dispatch("openExternal", { type, value });
  }

  function handleUnlock() {
    if (unlockPassword.trim()) {
      unlockError = false;
      dispatch("unlock", unlockPassword.trim());
      unlockPassword = "";
    } else {
      unlockError = true;
    }
  }

  function openLockForm() {
    showLockForm = true;
    lockPassInput = "";
    lockPassConfirm = "";
    lockPassError = "";
    lockInputError = false;
    lockConfirmError = false;
  }

  function cancelLockForm() {
    showLockForm = false;
    lockPassInput = "";
    lockPassConfirm = "";
    lockPassError = "";
    lockInputError = false;
    lockConfirmError = false;
  }

  function submitLockForm() {
    const passOk = lockPassInput.length >= 4;
    const confirmOk = lockPassInput === lockPassConfirm;
    lockInputError = !lockPassInput || lockPassInput.length < 4;
    lockConfirmError = !lockPassConfirm || !confirmOk;
    if (!lockPassInput) {
      lockPassError = "Password is required";
      return;
    }
    if (lockPassInput.length < 4) {
      lockPassError = "Password must be at least 4 characters";
      return;
    }
    if (lockPassInput !== lockPassConfirm) {
      lockPassError = "Passwords do not match";
      return;
    }
    lockInputError = false;
    lockConfirmError = false;
    lockPassError = "";
    showLockForm = false;
    dispatch("lock", lockPassInput);
  }
</script>

<div class="key-editor editor-shell compact">
  <EditorHeader
    noteName={selectedNote.name}
    showFileMenu={true}
    onRename={onRenameNote}
    onMove={onMoveNote}
    onImport={onImportNote}
    onExport={onExportNote}
    onDelete={onDeleteNote}
    on:back={() => dispatch("back")}
  >
    <div class="key-editor__header-actions">
      {#if !locked}
        <button
          class="icon-btn primary-btn"
          on:click={openAddModal}
          title={$t("keyEditor.addEntry")}
          ><span class="anemona icon-plus"></span></button
        >
      {/if}
      {#if locked}
        <span class="key-editor__lock-icon anemona icon-book-lock" title="Locked"></span>
      {:else}
        <button
          class="icon-btn key-editor__lock-button"
          on:click={openLockForm}
          title={$t("keyEditor.lockFile")}
          ><span class="anemona icon-lock-alt"></span></button
        >
      {/if}
    </div>
  </EditorHeader>

  {#if showLockForm}
    <div class="key-editor__set-password">
      <p class="key-editor__warning">
        <span class="anemona icon-slider-alt key-editor__warning-icon"></span>
        {$t("keyEditor.lockWarning")}
      </p>
      <input
        class="field"
        class:field-error={lockInputError}
        type="password"
        placeholder={$t("keyEditor.lockPasswordPlaceholder")}
        bind:value={lockPassInput}
      />
      <input
        class="field"
        class:field-error={lockConfirmError}
        type="password"
        placeholder={$t("keyEditor.lockConfirmPlaceholder")}
        bind:value={lockPassConfirm}
        on:keydown={(e) => e.key === "Enter" && submitLockForm()}
      />
      {#if lockPassError}
        <p class="field-error">{lockPassError}</p>
      {/if}
      <div class="form-actions">
        <button class="btn small primary" on:click={submitLockForm}
          >{$t("keyEditor.lockFileButton")}</button
        >
        <button class="btn small" on:click={cancelLockForm}
          >{$t("keyEditor.cancel")}</button
        >
      </div>
    </div>
  {:else if locked}
    <div class="key-editor__unlock">
      <p class="key-editor__unlock-hint">{$t("keyEditor.fileLocked")}</p>
      <div class="form-row">
        <input
          class="field"
          class:field-error={unlockError}
          type="password"
          placeholder={$t("keyEditor.passwordPlaceholder")}
          bind:value={unlockPassword}
          on:keydown={(e) => e.key === "Enter" && handleUnlock()}
        />
        <button class="btn primary" on:click={handleUnlock}
          >{$t("keyEditor.unlock")}</button
        >
      </div>
    </div>
  {:else}
    <SearchToolbar
      value={filterText}
      placeholder={$t("keyEditor.filterPlaceholder")}
      {sortDirection}
      showSort={true}
      sortTitleAsc={$t("keyEditor.sortAscending")}
      sortTitleDesc={$t("keyEditor.sortDescending")}
      on:input={(e) => {
        filterText = e.detail;
      }}
      on:toggleSort={toggleSort}
    />
    <div class="key-editor__entries entry-list" bind:this={entriesContainerElem}>
      {#each filteredEntries as entry, i}
        {@const realIndex = localEntries.indexOf(entry)}
        {@const canExpand = hasExtraFields(entry)}
        <div class="key-editor__entry entry-list__item">
          <div class="entry-list__row">
            <EntryTitleBar
              title={entry.title}
              menuOpen={openMenuIndex === realIndex}
              menuTitle={$t("keyEditor.entryOptions")}
              editLabel={$t("keyEditor.edit")}
              deleteLabel={$t("keyEditor.delete")}
              on:toggleMenu={() => toggleEntryMenu(realIndex)}
              on:closeMenu={closeEntryMenu}
              on:edit={() => openEditModal(realIndex)}
              on:delete={() => requestDeleteEntry(realIndex)}
            ></EntryTitleBar>
            <KeyPasswordRow
              password={entry.password}
              maskedPassword={getMaskedPassword(entry.password || "")}
              copied={copiedKey === `${realIndex}:password`}
              visible={visiblePasswords.has(realIndex)}
              {canExpand}
              expanded={expanded.has(realIndex)}
              copyTitle={$t("keyEditor.copyPassword")}
              showTitle={$t("keyEditor.showPassword")}
              hideTitle={$t("keyEditor.hidePassword")}
              expandTitle={$t("keyEditor.expand")}
              collapseTitle={$t("keyEditor.collapse")}
              on:copy={() => doCopy(realIndex, "password", entry.password)}
              on:toggleVisibility={() => togglePasswordVisibility(realIndex)}
              on:toggleExpand={() => toggleExpand(realIndex)}
            />
          </div>
          {#if canExpand && expanded.has(realIndex)}
            <div class="key-editor__details">
              {#each extraFields as def}
                {@const val = getField(entry, def.key)}
                {#if val}
                  <div class="key-editor__detail-row">
                    <span
                      class="icon-action"
                      role="button"
                      tabindex="0"
                      on:click|stopPropagation={() =>
                        doCopy(realIndex, def.key, val)}
                      on:keydown={(e) =>
                        e.key === "Enter" && doCopy(realIndex, def.key, val)}
                      title={$t("keyEditor.copyLabel", {
                        label: $t(def.labelKey),
                      })}
                      ><span
                        class={`anemona ${copiedKey === `${realIndex}:${def.key}` ? "icon-check" : "icon-copy"}`}
                      ></span></span
                    >
                    {#if ["url", "host", "email"].includes(def.key)}
                      <span
                        class="icon-action"
                        role="button"
                        tabindex="0"
                        on:click|stopPropagation={() => doOpen(def.key, val)}
                        on:keydown={(e) =>
                          e.key === "Enter" && doOpen(def.key, val)}
                        title={$t("keyEditor.openLabel", {
                          label: $t(def.labelKey),
                        })}
                        ><span class={`anemona ${getPropertyIcon(def.key)}`}
                        ></span></span
                      >
                    {:else}
                      <span
                        class={`ui-action-icon anemona ${getPropertyIcon(def.key)}`}
                      ></span>
                    {/if}
                    <div class="key-editor__detail-content">
                      <span class="key-editor__detail-label">{$t(def.labelKey)}</span>
                      <span class="key-editor__detail-value">{val}</span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      <button
        class="key-editor__add-entry add-entry-btn"
        class:no-entries={localEntries.length === 0}
        on:click={openAddModal}
        ><span class="anemona icon-plus"></span>
        {$t("keyEditor.addEntry")}</button
      >
    </div>
  {/if}
</div>

<DeleteConfirmModal
  show={deletePrompt !== null}
  title={$t("keyEditor.deleteEntryTitle")}
  itemName={deletePrompt ? deletePrompt.title : ""}
  on:confirm={confirmDeletePrompt}
  on:cancel={cancelDeletePrompt}
/>

{#if keyModalMode}
  <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"
  ></button>
  <div class="add-modal">
    <h3>
      {keyModalMode === "add"
        ? $t("keyEditor.addEntryTitle")
        : $t("keyEditor.editEntryTitle")}
    </h3>
    <input
      class="modal-field"
      class:field-error={keyTitleError}
      type="text"
      placeholder={$t("keyEditor.titlePlaceholder")}
      bind:this={modalTitleInput}
      bind:value={modalTitle}
    />
    <input
      class="modal-field"
      class:field-error={keyPassError}
      type="text"
      placeholder={$t("keyEditor.passwordFieldPlaceholder")}
      bind:value={modalPassword}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.urlPlaceholder")}
      bind:value={modalUrl}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.emailPlaceholder")}
      bind:value={modalEmail}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.userPlaceholder")}
      bind:value={modalUsername}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.hostPlaceholder")}
      bind:value={modalHost}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.portPlaceholder")}
      bind:value={modalPort}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.tokenPlaceholder")}
      bind:value={modalToken}
    />
    <input
      class="modal-field"
      type="text"
      placeholder={$t("keyEditor.notePlaceholder")}
      bind:value={modalNote}
    />
    <div class="modal-actions">
      <button class="btn" on:click={cancelModal}
        >{$t("keyEditor.cancel")}</button
      >
      <button class="btn primary" on:click={saveModal}
        >{keyModalMode === "add"
          ? $t("keyEditor.add")
          : $t("keyEditor.save")}</button
      >
    </div>
  </div>
{/if}

<style>
  .key-editor__lock-icon {
    font-size: 1.15em;
    opacity: 0.85;
  }

  .key-editor__lock-button {
    font-size: 1em;
  }

  .key-editor__set-password {
    margin-top: 0.26rem;
    padding: 0.56rem;
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    border: 1px solid
      var(--theme-accent-border);
    border-radius: var(--ui-radius-lg);
    background: var(--theme-accent-surface);
  }

  .key-editor__warning {
    font-size: var(--ui-font-sm);
    color: var(--ui-warning);
    background: var(--ui-warning-bg);
    padding: 0.34rem 0.44rem;
    border-radius: var(--ui-radius-sm);
    line-height: 1.4;
  }

  .key-editor__warning-icon {
    margin-right: 0.25rem;
    font-size: 1.05em;
    vertical-align: middle;
  }

  .key-editor__unlock {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    padding: 0.62rem;
    margin-top: 0.26rem;
    border: 1px solid
      var(--theme-accent-border);
    border-radius: var(--ui-radius-lg);
    background: var(--theme-accent-surface);
  }

  .key-editor__unlock-hint {
    font-size: var(--ui-font-sm);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .key-editor__details {
    padding: 0 var(--ui-card-pad-x) var(--ui-card-pad-y) var(--ui-card-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
  }

  .key-editor__detail-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--ui-font-xs);
    background: var(--theme-accent-surface);
    border-radius: var(--ui-radius-sm);
    padding: 0.12rem 0.22rem;
  }

  .key-editor__detail-row .icon-action,
  .key-editor__detail-row .ui-action-icon {
    width: 1.1rem;
    height: 1.1rem;
    font-size: 1.3em;
  }

  .key-editor__detail-content {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.04rem;
  }

  .key-editor__detail-label {
    color: var(--vscode-descriptionForeground);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68em;
    line-height: 1;
  }

  .key-editor__detail-value {
    flex: 1;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: var(--ui-font-xs);
    line-height: 1.15;
  }
</style>
