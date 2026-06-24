<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { t } from "../../i18n";
  import EditorHeader from "../layout/EditorHeader.svelte";
  import EntryTitleBar from "../layout/EntryTitleBar.svelte";
  import SearchToolbar from "../ui/SearchToolbar.svelte";
  import DeleteConfirmModal from "../ui/DeleteConfirmModal.svelte";
  import FilterChips from "../ui/FilterChips.svelte";
  import {
    formatDate,
    floorToMinute,
    computeNextDue,
    generateId,
  } from "../../utils/utils";
  import { removeEntry as removeEntryAt } from "../../utils/editorState";
  import {
    getDueTone as computeDueTone,
    getRelativeDue,
  } from "../../utils/timeUtils";
  import { deriveTitle } from "../../utils/titleUtils";

  type ReminderAction = {
    type: "none" | "file" | "url" | "command" | "task";
    target: string;
  };

  type ReminderEntry = {
    id: string;
    title?: string;
    text: string;
    dueAt: string;
    status: "pending" | "completed";
    action: ReminderAction;
    interval?: { unit: string; value: number };
    createdAt: string;
    updatedAt: string;
  };

  type DuePreset =
    | "none"
    | "1h"
    | "3h"
    | "tomorrow"
    | "3d"
    | "week"
    | "month"
    | "custom";
  type RepeatPreset =
    | "none"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year"
    | "custom";

  export let entries: ReminderEntry[] = [];
  export let selectedNote: { name: string; filePath: string };
  export let initialFilterText = "";
  export let onRenameNote: (() => void) | null = null;
  export let onMoveNote: (() => void) | null = null;
  export let onImportNote: (() => void) | null = null;
  export let onExportNote: (() => void) | null = null;
  export let onDeleteNote: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    save: ReminderEntry[];
    back: void;
    openAction: { type: string; target: string };
  }>();

  let localEntries = entries.map((e) => ({ ...e, action: { ...e.action } }));
  let filterStatus: "all" | "pending" | "completed" = "all";
  let filterText = "";
  let activeMenuIndex: number | null = null;
  let modalMode: "add" | "edit" | null = null;
  let editingIndex: number | null = null;
  let editingTitle = "";
  let editingText = "";
  let editingDueMode:
    | "none"
    | "minutes"
    | "hours"
    | "days"
    | "weeks"
    | "months"
    | "specific" = "none";
  let editingDueValue = 1;
  let editingDueDate = "";
  let duePreset: DuePreset = "none";
  let editingActionType: "none" | "file" | "url" = "none";
  let editingActionTarget = "";
  let editingIntervalMode:
    | "none"
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month"
    | "year" = "none";
  let editingIntervalValue = 1;
  let repeatPreset: RepeatPreset = "none";
  let titleError = false;
  let titleInput: HTMLInputElement;
  let textInput: HTMLTextAreaElement;
  let deletePrompt: { index: number; title: string } | null = null;
  let stopRepeatPrompt: { index: number; title: string } | null = null;
  let successMessage = "";
  let successTimer: ReturnType<typeof setTimeout> | null = null;
  let lastAppliedInitialFilter = "";
  let lastPickedRequestId = 0;

  export let pickedFile: { requestId: number; path: string } | null = null;
  export let onRequestPickFile: () => number = () => 0;

  $: if (
    pickedFile &&
    pickedFile.requestId === lastPickedRequestId &&
    pickedFile.requestId !== 0
  ) {
    editingActionTarget = pickedFile.path;
  }

  let _prevEntries = entries;
  $: if (entries !== localEntries && entries !== _prevEntries) {
    _prevEntries = entries;
    localEntries = entries.map((e) => ({ ...e, action: { ...e.action } }));
  }

  $: pendingEntries = localEntries.filter((e) => e.status === "pending");
  $: completedEntries = localEntries.filter((e) => e.status === "completed");
  $: statusFilterOptions = [
    {
      value: "all",
      label: $t("reminderEditor.allCount", { count: localEntries.length }),
      // icon: "icon-list",
    },
    {
      value: "pending",
      //label: $t("reminderEditor.pendingCount", { count: pendingEntries.length,}),
      label: pendingEntries.length,
      icon: "icon-circle",
    },
    {
      value: "completed",
      // label: $t("reminderEditor.completedCount", { count: completedEntries.length,}),
      label: completedEntries.length,
      icon: "icon-circle-check",
    },
  ];

  $: normalizedFilterText = filterText.trim().toLowerCase();

  $: visibleEntries = localEntries
    .filter((entry) => {
      if (filterStatus !== "all" && entry.status !== filterStatus) return false;
      if (
        normalizedFilterText &&
        ![getReminderTitle(entry), entry.text]
          .join(" ")
          .toLowerCase()
          .includes(normalizedFilterText)
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return 0;
    });

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText;
    lastAppliedInitialFilter = initialFilterText;
  }

  function getReminderTitle(entry: ReminderEntry): string {
    return entry.title?.trim() || deriveTitle(entry.text);
  }

  function computeDueIso(): string {
    const now = floorToMinute(new Date());
    switch (editingDueMode) {
      case "none":
        return "";
      case "minutes":
        return new Date(
          now.getTime() + editingDueValue * 60 * 1000,
        ).toISOString();
      case "hours":
        return new Date(
          now.getTime() + editingDueValue * 60 * 60 * 1000,
        ).toISOString();
      case "days":
        return new Date(
          now.getTime() + editingDueValue * 24 * 60 * 60 * 1000,
        ).toISOString();
      case "weeks":
        return new Date(
          now.getTime() + editingDueValue * 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
      case "months":
        return new Date(
          now.getFullYear(),
          now.getMonth() + editingDueValue,
          now.getDate(),
        ).toISOString();
      case "specific":
        return editingDueDate
          ? floorToMinute(new Date(editingDueDate)).toISOString()
          : "";
      default:
        return "";
    }
  }

  function selectDuePreset(preset: DuePreset) {
    duePreset = preset;
    if (preset === "custom") {
      if (editingDueMode === "none") {
        editingDueMode = "hours";
        editingDueValue = 1;
      }
      return;
    }
    editingDueDate = "";
    const presetMap: Record<
      Exclude<DuePreset, "custom">,
      { mode: typeof editingDueMode; value: number }
    > = {
      none: { mode: "none", value: 1 },
      "1h": { mode: "hours", value: 1 },
      "3h": { mode: "hours", value: 3 },
      tomorrow: { mode: "days", value: 1 },
      "3d": { mode: "days", value: 3 },
      week: { mode: "weeks", value: 1 },
      month: { mode: "months", value: 1 },
    };
    const selected = presetMap[preset];
    editingDueMode = selected.mode;
    editingDueValue = selected.value;
  }

  function selectRepeatPreset(preset: RepeatPreset) {
    repeatPreset = preset;
    if (preset === "custom") {
      if (editingIntervalMode === "none") {
        editingIntervalMode = "day";
        editingIntervalValue = 1;
      }
      return;
    }
    const presetMap: Record<
      Exclude<RepeatPreset, "custom">,
      { mode: typeof editingIntervalMode; value: number }
    > = {
      none: { mode: "none", value: 1 },
      hour: { mode: "hour", value: 1 },
      day: { mode: "day", value: 1 },
      week: { mode: "week", value: 1 },
      month: { mode: "month", value: 1 },
      year: { mode: "year", value: 1 },
    };
    const selected = presetMap[preset];
    editingIntervalMode = selected.mode;
    editingIntervalValue = selected.value;
  }

  function getRelativeDueLabel(dueAt: string): string {
    const result = getRelativeDue(dueAt);
    if (!result) return "";
    const suffix = result.value === 1 ? result.unit : `${result.unit}s`;
    return result.overdue
      ? $t("reminderEditor.overdue", { value: result.value, unit: suffix })
      : $t("reminderEditor.dueIn", { value: result.value, unit: suffix });
  }

  function getDueTone(dueAt: string): "late" | "soon" | "future" {
    return computeDueTone(dueAt);
  }

  function emitSave() {
    dispatch(
      "save",
      localEntries
        .map((e) => ({
          ...e,
          title: (e.title || getReminderTitle(e)).trim(),
          text: e.text.trim(),
          dueAt: e.dueAt,
          status: e.status,
          action: { ...e.action },
          interval: e.interval
            ? { unit: e.interval.unit, value: e.interval.value }
            : undefined,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        }))
        .filter((e) => e.title),
    );
  }

  async function openAddModal() {
    modalMode = "add";
    editingIndex = null;
    editingTitle = "";
    editingText = "";
    editingDueMode = "none";
    editingDueValue = 1;
    editingDueDate = "";
    duePreset = "none";
    editingActionType = "none";
    editingActionTarget = "";
    editingIntervalMode = "none";
    editingIntervalValue = 1;
    repeatPreset = "none";
    titleError = false;
    lastPickedRequestId = 0;
    await tick();
    titleInput?.focus();
  }

  function openEditModal(index: number) {
    activeMenuIndex = null;
    const entry = localEntries[index];
    modalMode = "edit";
    editingIndex = index;
    editingTitle = getReminderTitle(entry);
    editingText = entry.text;
    editingDueDate = entry.dueAt
      ? (() => {
          const d = new Date(entry.dueAt);
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        })()
      : "";
    editingDueMode = entry.dueAt ? "specific" : "none";
    editingDueValue = 1;
    duePreset = entry.dueAt ? "custom" : "none";
    editingActionType =
      entry.action?.type === "file" || entry.action?.type === "url"
        ? entry.action.type
        : "none";
    editingActionTarget = entry.action?.target || "";
    editingIntervalMode =
      (entry.interval?.unit as ReminderEntry["interval"]["unit"]) || "none";
    editingIntervalValue = entry.interval?.value || 1;
    repeatPreset =
      editingIntervalMode === "none"
        ? "none"
        : editingIntervalValue === 1 &&
            ["hour", "day", "week", "month", "year"].includes(
              editingIntervalMode,
            )
          ? (editingIntervalMode as RepeatPreset)
          : "custom";
    titleError = false;
    lastPickedRequestId = 0;
  }

  function cancelModal() {
    modalMode = null;
    editingIndex = null;
    editingTitle = "";
    editingText = "";
    editingDueMode = "none";
    editingDueValue = 1;
    editingDueDate = "";
    duePreset = "none";
    editingActionType = "none";
    editingActionTarget = "";
    editingIntervalMode = "none";
    editingIntervalValue = 1;
    repeatPreset = "none";
    titleError = false;
    lastPickedRequestId = 0;
  }

  function saveModal() {
    const title = editingTitle.trim();
    const text = editingText.trim();
    titleError = !title;
    if (!title) {
      return;
    }
    titleError = false;

    const now = new Date().toISOString();
    const dueAt = computeDueIso();
    const actionTarget = editingActionTarget.trim();
    const action: ReminderAction = {
      type:
        editingActionType !== "none" && actionTarget
          ? editingActionType
          : "none",
      target: editingActionType !== "none" ? actionTarget : "",
    };
    const interval =
      editingIntervalMode !== "none"
        ? {
            unit: editingIntervalMode,
            value: Math.max(1, editingIntervalValue),
          }
        : undefined;

    if (modalMode === "add") {
      localEntries = [
        ...localEntries,
        {
          id: generateId(),
          title,
          text,
          dueAt,
          status: "pending",
          action,
          interval,
          createdAt: now,
          updatedAt: now,
        },
      ];
      tick().then(() => {
        const el = document.querySelector(".reminder-editor__list");
        if (el) el.scrollTop = el.scrollHeight;
      });
    } else if (editingIndex !== null) {
      localEntries[editingIndex] = {
        ...localEntries[editingIndex],
        title,
        text,
        dueAt,
        action,
        interval,
        updatedAt: now,
      };
      localEntries = localEntries;
    }

    cancelModal();
    emitSave();
  }

  function toggleComplete(index: number) {
    const current = localEntries[index];
    if (current.interval) {
      const nextDue = computeNextDue(
        current.dueAt,
        current.interval.unit,
        current.interval.value,
      );
      if (nextDue) {
        localEntries[index] = {
          ...current,
          dueAt: nextDue,
          updatedAt: new Date().toISOString(),
        };
        localEntries = localEntries;
        emitSave();
        if (successTimer) clearTimeout(successTimer);
        successMessage = $t("reminderEditor.periodicAdvanced", {
          date: formatDate(nextDue),
        });
        successTimer = setTimeout(() => {
          successMessage = "";
        }, 3000);
      }
      return;
    }
    const status = current.status === "completed" ? "pending" : "completed";
    localEntries[index] = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };
    localEntries = localEntries;
    emitSave();
  }

  function requestDeleteEntry(index: number) {
    activeMenuIndex = null;
    deletePrompt = { index, title: getReminderTitle(localEntries[index]) };
  }

  function requestStopRepeat(index: number) {
    activeMenuIndex = null;
    const entry = localEntries[index];
    stopRepeatPrompt = { index, title: getReminderTitle(entry) };
  }

  function cancelStopRepeat() {
    stopRepeatPrompt = null;
  }

  function confirmStopRepeat() {
    if (!stopRepeatPrompt) return;
    localEntries[stopRepeatPrompt.index] = {
      ...localEntries[stopRepeatPrompt.index],
      interval: undefined,
      status: "completed",
      updatedAt: new Date().toISOString(),
    };
    localEntries = localEntries;
    stopRepeatPrompt = null;
    emitSave();
  }

  function toggleEntryMenu(index: number) {
    activeMenuIndex = activeMenuIndex === index ? null : index;
  }

  function closeEntryMenu() {
    activeMenuIndex = null;
  }

  function cancelDeletePrompt() {
    deletePrompt = null;
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return;
    localEntries = removeEntryAt(localEntries, deletePrompt.index);
    deletePrompt = null;
    emitSave();
  }

  function getActionLabel(action: ReminderAction): string {
    if (action.type === "none") return "";
    if (action.type === "file") return `📄 ${action.target}`;
    if (action.type === "url") return `🔗 ${action.target}`;
    if (action.type === "command") return `⚡ ${action.target}`;
    if (action.type === "task") return `📋 ${action.target}`;
    return "";
  }

  function handlePickFile() {
    lastPickedRequestId = onRequestPickFile();
  }

  function handleStatusFilterChange(event: CustomEvent<string>) {
    filterStatus = event.detail as typeof filterStatus;
  }
</script>

<div class="reminder-editor editor-shell">
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
    <div class="reminder-editor__header-actions">
      <button
        class="icon-btn primary-btn"
        on:click={openAddModal}
        title={$t("reminderEditor.addReminder")}
        ><span class="anemona icon-plus"></span></button
      >
    </div>
  </EditorHeader>

  <SearchToolbar
    value={filterText}
    placeholder={$t("reminderEditor.searchPlaceholder")}
    showSort={false}
    on:input={(e) => {
      filterText = e.detail;
    }}
  />

  <FilterChips
    options={statusFilterOptions}
    value={filterStatus}
    on:change={handleStatusFilterChange}
  />

  <div class="reminder-editor__list">
    {#if visibleEntries.length === 0}
      {#if localEntries.length > 0}
        <div class="ui-empty">{$t("reminderEditor.emptyFilters")}</div>
      {/if}
    {:else}
      {#each visibleEntries as item, idx}
        {@const entry = item}
        {@const realIndex = localEntries.indexOf(entry)}
        <div
          class="reminder-card ui-card"
          class:reminder-card--completed={entry.status === "completed"}
          class:reminder-card--menu-open={activeMenuIndex === realIndex}
          style={entry.status === "pending" && entry.dueAt
            ? `--due-tone: ${getDueTone(entry.dueAt)};`
            : ""}
        >
          <div class="reminder-card__copy">
            <EntryTitleBar
              title={getReminderTitle(entry)}
              menuOpen={activeMenuIndex === realIndex}
              menuTitle={$t("reminderEditor.entryOptions")}
              editLabel={$t("common.edit")}
              deleteLabel={$t("reminderEditor.delete")}
              on:toggleMenu={() => toggleEntryMenu(realIndex)}
              on:closeMenu={closeEntryMenu}
              on:edit={() => openEditModal(realIndex)}
              on:delete={() => requestDeleteEntry(realIndex)}
            >
              <button
                slot="leading"
                class="check-toggle"
                on:click={() => toggleComplete(realIndex)}
                title={entry.status === "completed"
                  ? $t("reminderEditor.markPending")
                  : $t("reminderEditor.markCompleted")}
              >
                <span
                  class={`anemona ${entry.status === "completed" ? "icon-checked" : "icon-checkbox"}`}
                ></span>
              </button>
              <div slot="menu">
                {#if entry.interval}
                  <button
                    class="menu-item"
                    on:click|stopPropagation={() =>
                      requestStopRepeat(realIndex)}
                  >
                    <span class="anemona icon-refresh"></span>
                    <span>{$t("reminderEditor.stopRepeatMenu")}</span>
                  </button>
                {/if}
                <button
                  class="menu-item"
                  on:click|stopPropagation={() => openEditModal(realIndex)}
                >
                  <span class="anemona icon-edit-alt"></span>
                  <span>{$t("common.edit")}</span>
                </button>
                <button
                  class="menu-item danger"
                  on:click|stopPropagation={() => requestDeleteEntry(realIndex)}
                >
                  <span class="anemona icon-trash-alt"></span>
                  <span>{$t("reminderEditor.delete")}</span>
                </button>
              </div>
            </EntryTitleBar>
            <div class="reminder-card__body">
              {#if entry.text}
                <div class="reminder-card__text">{entry.text}</div>
              {/if}
              <div class="reminder-card__meta">
                {#if entry.dueAt}
                  <span class={`reminder-card__due ${getDueTone(entry.dueAt)}`}>
                    {getRelativeDueLabel(entry.dueAt)} — {formatDate(
                      entry.dueAt,
                    )}
                  </span>
                {:else}
                  <span class="reminder-card__due none"
                    >{$t("reminderEditor.noDueDate")}</span
                  >
                {/if}
                <span
                  class={`ui-badge compact uppercase ${entry.status === "completed" ? "success" : "warning"}`}
                >
                  {$t("reminderEditor." + entry.status)}
                </span>
                {#if entry.interval}
                  <span class="ui-badge compact uppercase periodic">
                    {$t("reminderEditor.periodic")}
                  </span>
                {/if}
                {#if entry.action.type === "url"}
                  <button
                    class="reminder-card__action-link"
                    on:click|stopPropagation={() =>
                      dispatch("openAction", {
                        type: entry.action.type,
                        target: entry.action.target,
                      })}
                    title={entry.action.target}
                  >
                    <span class="anemona icon-globe"></span>
                  </button>
                {:else if entry.action.type === "file"}
                  <button
                    class="reminder-card__action-link"
                    on:click|stopPropagation={() =>
                      dispatch("openAction", {
                        type: entry.action.type,
                        target: entry.action.target,
                      })}
                    title={entry.action.target}
                  >
                    <span class="anemona icon-file-text"></span>
                  </button>
                {:else if entry.action.type !== "none"}
                  <button
                    class="reminder-card__action-link"
                    on:click|stopPropagation={() =>
                      dispatch("openAction", {
                        type: entry.action.type,
                        target: entry.action.target,
                      })}
                    title={entry.action.target}
                  >
                    <span class="reminder-card__action-label"
                      >{getActionLabel(entry.action)}</span
                    >
                  </button>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    {/if}
    <button
      class="reminder-editor__add-entry add-entry-btn"
      class:no-entries={localEntries.length === 0}
      on:click={openAddModal}
    >
      <span class="anemona icon-plus"></span>
      {$t("reminderEditor.addReminder")}
    </button>
  </div>

  {#if modalMode}
    <button class="modal-backdrop" on:click={cancelModal} aria-label="Close"
    ></button>
    <div class="form-modal">
      <h3>
        {modalMode === "add"
          ? $t("reminderEditor.addReminderTitle")
          : $t("reminderEditor.editReminderTitle")}
      </h3>

      <input
        id="reminder-title-input"
        class="form-input reminder-editor__title-input"
        class:field-error={titleError}
        type="text"
        bind:this={titleInput}
        bind:value={editingTitle}
        placeholder={$t("common.title")}
      />

      <textarea
        class="form-input form-textarea reminder-editor__text-input"
        bind:this={textInput}
        bind:value={editingText}
        rows="3"
        placeholder={`${$t("reminderEditor.textPlaceholder")} (${$t("common.optional")})`}
      ></textarea>

      <label class="field-label" for="due-select"
        >{$t("reminderEditor.remindLabel")}</label
      >
      <select
        id="due-select"
        class="form-input ui-select"
        value={duePreset}
        on:change={(e) => selectDuePreset(e.target.value)}
      >
        <option value="none">{$t("reminderEditor.noDate")}</option>
        <option value="1h">{$t("reminderEditor.preset1Hour")}</option>
        <option value="3h">{$t("reminderEditor.preset3Hours")}</option>
        <option value="tomorrow">{$t("reminderEditor.presetTomorrow")}</option>
        <option value="3d">{$t("reminderEditor.preset3Days")}</option>
        <option value="week">{$t("reminderEditor.presetNextWeek")}</option>
        <option value="month">{$t("reminderEditor.presetNextMonth")}</option>
        <option value="custom">{$t("reminderEditor.presetCustom")}</option>
      </select>

      {#if duePreset === "custom"}
        <div class="reminder-editor__custom-options">
          <div class="reminder-editor__option-row compact">
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "minutes"}
              on:click={() => (editingDueMode = "minutes")}
            >
              {$t("reminderEditor.inMinutesShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "hours"}
              on:click={() => (editingDueMode = "hours")}
            >
              {$t("reminderEditor.inHoursShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "days"}
              on:click={() => (editingDueMode = "days")}
            >
              {$t("reminderEditor.inDaysShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "weeks"}
              on:click={() => (editingDueMode = "weeks")}
            >
              {$t("reminderEditor.inWeeksShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "months"}
              on:click={() => (editingDueMode = "months")}
            >
              {$t("reminderEditor.inMonthsShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingDueMode === "specific"}
              on:click={() => (editingDueMode = "specific")}
            >
              {$t("reminderEditor.specificDateShort")}
            </button>
          </div>
          {#if editingDueMode !== "none" && editingDueMode !== "specific"}
            <div class="reminder-editor__value-row">
              <input
                class="form-input reminder-editor__value-input"
                type="number"
                min="1"
                bind:value={editingDueValue}
              />
              <span class="reminder-editor__unit-label"
                >{$t("reminderEditor." + editingDueMode)}</span
              >
            </div>
          {/if}
          {#if editingDueMode === "specific"}
            <input
              class="form-input"
              type="datetime-local"
              bind:value={editingDueDate}
            />
          {/if}
        </div>
      {/if}

      <label class="field-label" for="repeat-select"
        >{$t("reminderEditor.sectionRepeat")}</label
      >
      <select
        id="repeat-select"
        class="form-input ui-select"
        value={repeatPreset}
        on:change={(e) => selectRepeatPreset(e.target.value)}
      >
        <option value="none">{$t("reminderEditor.repeatPresetNone")}</option>
        <option value="hour">{$t("reminderEditor.repeatPresetHour")}</option>
        <option value="day">{$t("reminderEditor.repeatPresetDay")}</option>
        <option value="week">{$t("reminderEditor.repeatPresetWeek")}</option>
        <option value="month">{$t("reminderEditor.repeatPresetMonth")}</option>
        <option value="year">{$t("reminderEditor.repeatPresetYear")}</option>
        <option value="custom">{$t("reminderEditor.presetCustom")}</option>
      </select>

      {#if repeatPreset === "custom"}
        <div class="reminder-editor__custom-options">
          <div class="reminder-editor__option-row compact">
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "minute"}
              on:click={() => (editingIntervalMode = "minute")}
            >
              {$t("reminderEditor.intervalMinuteShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "hour"}
              on:click={() => (editingIntervalMode = "hour")}
            >
              {$t("reminderEditor.intervalHourShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "day"}
              on:click={() => (editingIntervalMode = "day")}
            >
              {$t("reminderEditor.intervalDayShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "week"}
              on:click={() => (editingIntervalMode = "week")}
            >
              {$t("reminderEditor.intervalWeekShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "month"}
              on:click={() => (editingIntervalMode = "month")}
            >
              {$t("reminderEditor.intervalMonthShort")}
            </button>
            <button
              class="reminder-editor__option"
              class:active={editingIntervalMode === "year"}
              on:click={() => (editingIntervalMode = "year")}
            >
              {$t("reminderEditor.intervalYearShort")}
            </button>
          </div>
          <div class="reminder-editor__value-row">
            <input
              class="form-input reminder-editor__value-input"
              type="number"
              min="1"
              bind:value={editingIntervalValue}
            />
            <span class="reminder-editor__unit-label"
              >{$t(
                "reminderEditor." +
                  editingIntervalMode +
                  (editingIntervalValue === 1 ? "" : "s"),
              )}</span
            >
          </div>
        </div>
      {/if}

      <label class="field-label" for="action-select"
        >{$t("reminderEditor.sectionAdditional")}</label
      >
      <select
        id="action-select"
        class="form-input ui-select"
        bind:value={editingActionType}
      >
        <option value="none">{$t("reminderEditor.actionTypeNone")}</option>
        <option value="file">{$t("reminderEditor.actionTypeFile")}</option>
        <option value="url">{$t("reminderEditor.actionTypeUrl")}</option>
      </select>

      {#if editingActionType === "url"}
        <div class="reminder-editor__action-input">
          <input
            class="form-input"
            type="url"
            bind:value={editingActionTarget}
            placeholder={$t("reminderEditor.urlPlaceholder")}
          />
        </div>
      {:else if editingActionType === "file"}
        <div class="reminder-editor__action-input">
          <div class="reminder-editor__file-input-row">
            <input
              class="form-input"
              type="text"
              bind:value={editingActionTarget}
              placeholder={$t("reminderEditor.actionFilePlaceholder")}
            />
            <button
              type="button"
              class="btn small reminder-editor__browse-button"
              on:click={handlePickFile}
            >
              {$t("reminderEditor.browseFile")}
            </button>
          </div>
        </div>
      {/if}

      <div class="form-actions">
        <button class="btn" on:click={cancelModal}
          >{$t("reminderEditor.cancel")}</button
        >
        <button class="btn primary" on:click={saveModal}>
          {modalMode === "add"
            ? $t("reminderEditor.add")
            : $t("reminderEditor.save")}
        </button>
      </div>
    </div>
  {/if}

  <DeleteConfirmModal
    show={deletePrompt !== null}
    title={$t("reminderEditor.deleteReminderTitle")}
    itemName={deletePrompt ? deletePrompt.title : ""}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />

  {#if stopRepeatPrompt}
    <button
      class="modal-backdrop"
      on:click={cancelStopRepeat}
      aria-label="Close"
    ></button>
    <div class="delete-modal">
      <h3>{$t("reminderEditor.stopRepeatTitle")}</h3>
      <p>
        {$t("reminderEditor.stopRepeatBody", { title: stopRepeatPrompt.title })}
      </p>
      <div class="form-actions">
        <button class="btn" on:click={cancelStopRepeat}
          >{$t("reminderEditor.cancel")}</button
        >
        <button class="btn primary" on:click={confirmStopRepeat}
          >{$t("reminderEditor.stopRepeatConfirm")}</button
        >
      </div>
    </div>
  {/if}
</div>

{#if successMessage}
  <div class="ui-toast success">{successMessage}</div>
{/if}

<style>
  .reminder-editor__list {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.24rem;
  }

  .reminder-card {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    margin-bottom: 0.18rem;
  }

  .reminder-card.reminder-card--menu-open {
    z-index: var(--ui-z-popover);
  }

  .reminder-card.reminder-card--completed {
    opacity: 0.7;
  }

  :global(.reminder-card.reminder-card--completed .entry-title) {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .reminder-card.reminder-card--completed .reminder-card__text {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .reminder-card__copy {
    min-width: 0;
  }

  :global(.reminder-card .entry-title) {
    width: 100%;
    color: var(--vscode-sideBarTitle-foreground);
    font-size: 0.62rem;
    font-weight: 400;
    line-height: 1.18;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .reminder-card__meta {
    display: flex;
    align-items: center;
    gap: 0.14rem;
    flex-wrap: wrap;
    font-size: 0.52rem;
    line-height: 1.1;
  }

  .reminder-card__due {
    font-size: 0.52rem;
    letter-spacing: 0.01em;
    color: var(--ui-muted);
  }

  .reminder-card__due.late {
    color: var(--ui-danger-text);
  }

  .reminder-card__due.soon {
    color: var(--ui-warning-text);
  }

  .reminder-card__due.none {
    color: var(--ui-muted);
  }

  .reminder-card__action-label {
    font-size: 0.5rem;
    color: var(--theme-accent-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 8rem;
  }

  .reminder-card__action-link {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    border: none;
    background: var(--theme-accent-hover);
    color: var(--theme-accent-text);
    cursor: pointer;
    font-size: 0.6rem;
    padding: 0.06rem 0.2rem;
    border-radius: var(--ui-radius-sm);
    line-height: 1;
  }

  .reminder-card__action-link:hover {
    background: var(--theme-accent-active);
    color: var(--theme-accent-text);
  }

  .reminder-editor__option-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    margin-top: 0.2rem;
  }

  .reminder-editor__option {
    padding: 0.16rem 0.3rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--vscode-foreground);
    font-size: var(--ui-font-xs);
    cursor: pointer;
  }

  .reminder-editor__option.active {
    border-color: var(--theme-accent-border-hover);
    background: var(--theme-accent-hover);
  }

  .reminder-editor__custom-options {
    margin-top: 0.26rem;
    margin-left: 0.2rem;
    padding: 0.42rem 0.46rem;
    border-left: 1px solid var(--theme-accent-border-strong);
    border-radius: 0 var(--ui-radius-sm) var(--ui-radius-sm) 0;
    background: var(--theme-accent-soft);
  }

  .reminder-editor__text-input {
    margin-top: 0.42rem;
  }

  .reminder-editor__option-row.compact {
    margin-top: 0;
  }

  .reminder-editor__value-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    margin-top: 0.3rem;
  }

  .reminder-editor__value-input {
    width: 5rem;
  }

  .reminder-editor__unit-label {
    font-size: var(--ui-font-sm);
    color: var(--ui-muted);
  }

  .reminder-editor__title-input {
    margin-top: 0.35rem;
  }

  .reminder-editor__file-input-row {
    display: flex;
    align-items: stretch;
    gap: 0.3rem;
  }

  .reminder-editor__action-input {
    margin-top: 0.3rem;
  }

  .reminder-editor__file-input-row .form-input {
    flex: 1;
    min-width: 0;
  }

  .reminder-editor__browse-button {
    flex-shrink: 0;
  }

  .reminder-card__action-label {
    font-size: 0.5rem;
    color: var(--theme-accent-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 8rem;
  }
</style>
