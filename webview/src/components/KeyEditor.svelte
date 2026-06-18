<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { t } from "../i18n";
  import { getDisplayName, getFileIconClass } from "../lib/fileUtils";
  import type { SortDirection } from "../lib/sortUtils";
  import EditorHeader from "../lib/EditorHeader.svelte";
  import EntryTitleBar from "../lib/EntryTitleBar.svelte";
  import KeyPasswordRow from "../lib/KeyPasswordRow.svelte";
  import SearchToolbar from "../lib/SearchToolbar.svelte";
  import DeleteConfirmModal from "../lib/DeleteConfirmModal.svelte";

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
  let _isSorting = false;
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
    const parsed = parseKeyText(selectionSuggestion.text);
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
    } else {
      sortDirection = "asc";
    }
  }

  $: if (!_isSorting && sortDirection !== null) {
    _isSorting = true;
    localEntries = [...localEntries].sort((a, b) => {
      const cmp = a.title.localeCompare(b.title);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    saveEntries();
    _isSorting = false;
  }

  $: if (sortDirection === null && entries !== _prevEntries) {
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

  function parseKeyText(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    const knownFields: Record<string, string> = {
      username: "username",
      user: "username",
      nick: "username",
      login: "username",
      password: "password",
      pass: "password",
      pw: "password",
      passwd: "password",
      email: "email",
      mail: "email",
      e: "email",
      url: "url",
      uri: "url",
      website: "url",
      site: "url",
      link: "url",
      host: "host",
      server: "host",
      hostname: "host",
      port: "port",
      token: "token",
      api_key: "token",
      apikey: "token",
      api: "token",
      key: "token",
      note: "note",
      notes: "note",
      description: "note",
      desc: "note",
      comment: "note",
      title: "title",
      name: "title",
      label: "title",
      service: "title",
      account: "title",
    };

    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (obj && typeof obj === "object") {
          const unknown: string[] = [];
          for (const [k, v] of Object.entries(obj)) {
            const key = k.toLowerCase();
            const value = String(v ?? "");
            const mapped = knownFields[key];
            if (mapped) {
              if (!result[mapped]) result[mapped] = value;
            } else {
              unknown.push(`${k}: ${value}`);
            }
          }
          if (unknown.length > 0) result.note = unknown.join("\n");
          return result;
        }
      } catch {
        /* fall through to lenient parsing */
      }
    }

    // Lenient JSON-like: strip braces, trailing commas, and surrounding quotes
    const cleaned = trimmed
      .replace(/^[\{\[]\s*/, "")
      .replace(/\s*[\}\]]$/, "")
      .trim();

    for (const line of cleaned.split("\n")) {
      const raw = line.trim().replace(/,$/, "");
      if (!raw || raw === "---") continue;
      const idx = raw.indexOf(":");
      if (idx > 0) {
        let key = raw
          .slice(0, idx)
          .trim()
          .toLowerCase()
          .replace(/^["']|["']$/g, "");
        let value = raw
          .slice(idx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        const mapped = knownFields[key];
        if (mapped && !result[mapped]) result[mapped] = value;
      }
    }
    return result;
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
    localEntries = localEntries.filter((_, i) => i !== deletePrompt.index);
    saveEntries();
    deletePrompt = null;
  }

  function saveEntries() {
    dispatch("save", { entries: localEntries, locked });
  }

  function doCopy(index: number, field: string, value: string) {
    navigator.clipboard.writeText(value);
    const key = `${index}:${field}`;
    copiedKey = key;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copiedKey = "";
    }, 1200);
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
  <EditorHeader noteName={selectedNote.name} on:back={() => dispatch("back")}>
    <div class="header-actions">
      {#if !locked}
        <button
          class="icon-btn primary-btn"
          on:click={openAddModal}
          title={$t("keyEditor.addEntry")}
          ><span class="anemona icon-plus"></span></button
        >
      {/if}
      {#if locked}
        <span class="lock-icon anemona icon-book-lock" title="Locked"></span>
      {:else}
        <button
          class="icon-btn lock-btn"
          on:click={openLockForm}
          title={$t("keyEditor.lockFile")}
          ><span class="anemona icon-lock-alt"></span></button
        >
      {/if}
    </div>
  </EditorHeader>

  {#if showLockForm}
    <div class="set-password-area">
      <p class="warning-text">
        <span class="anemona icon-slider-alt warning-icon"></span>
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
    <div class="unlock-area">
      <p class="unlock-hint">{$t("keyEditor.fileLocked")}</p>
      <div class="unlock-row">
        <input
          class="unlock-input"
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
    <div class="entries" bind:this={entriesContainerElem}>
      {#each filteredEntries as entry, i}
        {@const realIndex = localEntries.indexOf(entry)}
        {@const canExpand = hasExtraFields(entry)}
        <div class="entry">
          <div class="entry-row">
            <EntryTitleBar
              title={entry.title}
              menuOpen={openMenuIndex === i}
              menuTitle={$t("keyEditor.entryOptions")}
              editLabel={$t("keyEditor.edit")}
              deleteLabel={$t("keyEditor.delete")}
              on:toggleMenu={() => toggleEntryMenu(i)}
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
            <div class="entry-details">
              {#each extraFields as def}
                {@const val = getField(entry, def.key)}
                {#if val}
                  <div class="detail-row">
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
                        class={`action-icon anemona ${getPropertyIcon(def.key)}`}
                      ></span>
                    {/if}
                    <div class="detail-copy-content">
                      <span class="detail-label">{$t(def.labelKey)}</span>
                      <span class="detail-value">{val}</span>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>
      {/each}
      <button
        class="add-entry-btn"
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
  .lock-icon {
    font-size: 1.15em;
    opacity: 0.85;
  }

  .lock-btn {
    font-size: 1em;
  }

  .set-password-area {
    margin-top: 0.26rem;
    padding: 0.56rem;
    display: flex;
    flex-direction: column;
    gap: 0.24rem;
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-lg);
    background: color-mix(
      in srgb,
      var(--accent-color) 4%,
      var(--vscode-editor-background)
    );
  }

  .warning-text {
    font-size: var(--ui-font-sm);
    color: #e67e22;
    background: color-mix(in srgb, #e67e22 10%, transparent);
    padding: 0.34rem 0.44rem;
    border-radius: var(--ui-radius-sm);
    line-height: 1.4;
  }

  .warning-icon {
    margin-right: 0.25rem;
    font-size: 1.05em;
    vertical-align: middle;
  }

  .unlock-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    padding: 0.62rem;
    margin-top: 0.26rem;
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-lg);
    background: color-mix(
      in srgb,
      var(--accent-color) 4%,
      var(--vscode-editor-background)
    );
  }

  .unlock-hint {
    font-size: var(--ui-font-sm);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .unlock-row {
    display: flex;
    gap: 0.34rem;
    align-items: center;
    width: min(100%, 26rem);
  }

  .unlock-input {
    flex: 1;
    background: color-mix(
      in srgb,
      var(--accent-color) 4%,
      var(--vscode-input-background)
    );
    color: var(--vscode-input-foreground);
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 16%, var(--ui-border-strong));
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    box-sizing: border-box;
    padding: var(--ui-control-pad-y) var(--ui-control-pad-x);
    font-size: var(--ui-font-control);
    outline: none;
  }

  .unlock-input:focus {
    border-color: color-mix(
      in srgb,
      var(--accent-color) 38%,
      var(--vscode-focusBorder)
    );
  }

  .sort-toolbar {
    display: flex;
    gap: 0.18rem;
    margin-bottom: 0.18rem;
    padding: 0.12rem 0;
  }

  .entry-row {
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
  }

  .entry-details {
    padding: 0 var(--ui-card-pad-x) var(--ui-card-pad-y) var(--ui-card-pad-x);
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--ui-font-xs);
    background: color-mix(
      in srgb,
      var(--accent-color) 5%,
      var(--vscode-sideBar-background)
    );
    border-radius: var(--ui-radius-sm);
    padding: 0.12rem 0.22rem;
  }

  .detail-row .icon-action,
  .detail-row .action-icon {
    width: 1.1rem;
    height: 1.1rem;
    font-size: 1.3em;
  }

  .action-icon {
    width: 1rem;
    height: 1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 1.2em;
    background: none;
    border: none;
    cursor: default;
    color: color-mix(in srgb, var(--accent-color) 72%, white 28%);
  }

  .action-icon:is(button) {
    cursor: pointer;
    border-radius: 3px;
    background: transparent;
  }

  .action-icon:is(button):hover {
    background: color-mix(in srgb, var(--accent-color) 18%, transparent);
  }

  .detail-copy-content {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 0.04rem;
  }

  .detail-label {
    color: var(--vscode-descriptionForeground);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.68em;
    line-height: 1;
  }

  .detail-value {
    flex: 1;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
    font-size: var(--ui-font-xs);
    line-height: 1.15;
  }

  .copy-btn {
    font-size: 0.78em;
    width: 1.3rem;
    height: 1.3rem;
  }

  .form-actions {
    display: flex;
    gap: 0.28rem;
    flex-wrap: wrap;
  }
</style>
