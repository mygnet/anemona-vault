<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { t } from "../../i18n";
  import EditorHeader from "../layout/EditorHeader.svelte";
  import EntryTitleBar from "../layout/EntryTitleBar.svelte";
  import SearchToolbar from "../ui/SearchToolbar.svelte";
  import DeleteConfirmModal from "../ui/DeleteConfirmModal.svelte";
  import FilterChips from "../ui/FilterChips.svelte";
  import { moveEntry, removeEntry } from "../../utils/editorState";
  import { parseTodoSuggestion } from "../../utils/selectionParser";
  import {
    getDueTone as computeDueTone,
    getRelativeDue,
  } from "../../utils/timeUtils";

  type TodoEntry = {
    title?: string;
    text?: string;
    progress: number;
    status: "open" | "done" | "cancelled";
    priority: "low" | "medium" | "high";
    dueAt?: string;
  };

  export let entries: TodoEntry[] = [];
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
    save: TodoEntry[];
    back: void;
  }>();

  let localEntries = entries.map((entry) => ({ ...entry }));
  let activeFilter: "all" | "open" | "done" | "cancelled" = "all";
  let activePriorityFilter: "all" | "high" | "medium" | "low" = "all";
  let filterText = "";
  let activeMenuIndex: number | null = null;
  let movingTaskIndex: number | null = null;
  let taskModalMode: "add" | "edit" | null = null;
  let editingTaskIndex: number | null = null;
  let editingTaskTitle = "";
  let editingTaskText = "";
  let editingTaskDueAt = "";
  let editingTaskPriority: TodoEntry["priority"] = "medium";
  let taskTitleInput: HTMLInputElement;
  let taskTitleError = false;
  let entriesContainerElem: HTMLDivElement;
  let deleteTaskPrompt: { index: number; title: string } | null = null;
  let lastAppliedInitialFilter = "";
  let filledFromSuggestion = false;
  let activeSelectionRequestId = 0;

  let _prevEntries = entries;
  $: if (entries !== localEntries && entries !== _prevEntries) {
    _prevEntries = entries;
    localEntries = entries.map((entry) => ({ ...entry }));
  }

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText;
    lastAppliedInitialFilter = initialFilterText;
  }

  $: if (
    selectionSuggestion?.text &&
    selectionSuggestion.requestId === activeSelectionRequestId &&
    taskModalMode === "add" &&
    !filledFromSuggestion
  ) {
    filledFromSuggestion = true;
    const parsed = parseTodoSuggestion(selectionSuggestion.text);
    if (parsed.title) editingTaskTitle = parsed.title;
    if (parsed.text) editingTaskText = parsed.text;
    if (parsed.priority) editingTaskPriority = parsed.priority;
    if (parsed.due) editingTaskDueAt = parsed.due;
  }

  $: normalizedFilterText = filterText.trim().toLowerCase();

  $: visibleEntries = localEntries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) => activeFilter === "all" || entry.status === activeFilter,
    )
    .filter(
      ({ entry }) =>
        activePriorityFilter === "all" ||
        entry.priority === activePriorityFilter,
    )
    .filter(({ entry }) => {
      if (!normalizedFilterText) return true;

      return [
        getTodoTitle(entry),
        getTodoText(entry),
        getPriorityLabel(entry),
        getStatusLabel(entry),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilterText);
    });

  function getTodoText(entry: TodoEntry): string {
    return (entry.text || "").trim();
  }

  function getTodoTitle(entry: TodoEntry): string {
    return (entry.title || "").trim() || getTodoText(entry);
  }

  function getTodoBodyText(entry: TodoEntry): string {
    return (entry.title || "").trim() && entry.text ? entry.text.trim() : "";
  }

  $: filterCounts = {
    all: localEntries.length,
    open: localEntries.filter((entry) => entry.status === "open").length,
    done: localEntries.filter((entry) => entry.status === "done").length,
    cancelled: localEntries.filter((entry) => entry.status === "cancelled")
      .length,
  };

  $: statusFilterOptions = [
    {
      value: "all",
      label: $t("todoEditor.allCount", { count: filterCounts.all }),
    },
    { value: "open", label: String(filterCounts.open), icon: "icon-circle" },
    {
      value: "done",
      label: String(filterCounts.done),
      icon: "icon-circle-check",
    },
    {
      value: "cancelled",
      label: String(filterCounts.cancelled),
      icon: "icon-circle-cancel",
    },
  ];

  $: priorityFilterLabel =
    activePriorityFilter === "high"
      ? "icon-smiley-sad"
      : activePriorityFilter === "medium"
        ? "icon-smiley-meh"
        : activePriorityFilter === "low"
          ? "icon-smiley"
          : "icon-circle-solid";

  $: priorityFilterTitle =
    activePriorityFilter === "high"
      ? $t("todoEditor.filterHigh")
      : activePriorityFilter === "medium"
        ? $t("todoEditor.filterMedium")
        : activePriorityFilter === "low"
          ? $t("todoEditor.filterLow")
          : $t("todoEditor.filterAll");

  $: activeEntries = localEntries.filter(
    (entry) => entry.status !== "cancelled",
  );
  $: totalProgress =
    activeEntries.length === 0
      ? 0
      : Math.round(
          activeEntries.reduce(
            (sum, entry) =>
              sum + Math.max(0, Math.min(100, Number(entry.progress) || 0)),
            0,
          ) / activeEntries.length,
        );

  function normalizeDueAt(value: string): string | undefined {
    const trimmed = value.trim();
    const m = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : undefined;
  }

  function getRelativeDueLabel(entry: TodoEntry): string {
    const result = getRelativeDue(entry.dueAt);
    if (!result) return "";
    const suffix = result.value === 1 ? result.unit : `${result.unit}s`;
    return result.overdue
      ? `Overdue by ${result.value} ${suffix}`
      : `Due in ${result.value} ${suffix}`;
  }

  function getDueTone(entry: TodoEntry): "late" | "soon" | "future" {
    return computeDueTone(entry.dueAt || "");
  }

  function getProgressAccent(
    progress: number,
    status: TodoEntry["status"],
  ): string {
    if (status === "cancelled") {
      return "color-mix(in srgb, var(--ui-muted) 70%, transparent)";
    }

    if (status === "done") {
      return "color-mix(in srgb, #68c3a0 84%, white 16%)";
    }

    const normalized = Math.max(0, Math.min(100, Number(progress) || 0));
    const hue = 10 + normalized * 1.3;
    const saturation = 78;
    const lightness = 62 - normalized * 0.08;
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  }

  function emitSave() {
    dispatch(
      "save",
      localEntries
        .map((entry) => ({
          id: entry.id,
          title: (entry.title || "").trim(),
          ...(entry.text ? { text: entry.text.trim() } : {}),
          progress: Math.max(0, Math.min(100, Number(entry.progress) || 0)),
          status:
            entry.status === "done" || entry.status === "cancelled"
              ? entry.status
              : "open",
          priority:
            entry.priority === "low" || entry.priority === "high"
              ? entry.priority
              : "medium",
          dueAt: normalizeDueAt(entry.dueAt || ""),
        }))
        .filter((entry) => entry.title || entry.text),
    );
  }

  async function openAddTaskModal() {
    activeSelectionRequestId = 0;
    taskModalMode = "add";
    activeSelectionRequestId = onRequestSelectionCheck();
    filledFromSuggestion = false;
    editingTaskTitle = "";
    editingTaskText = "";
    editingTaskDueAt = "";
    editingTaskPriority = "medium";
    taskTitleError = false;
    await tick();
    taskTitleInput?.focus();
  }

  function toggleTaskMenu(index: number) {
    activeMenuIndex = activeMenuIndex === index ? null : index;
  }

  function moveEntryToIndex(fromIndex: number, targetIndex: number) {
    if (
      fromIndex === targetIndex ||
      fromIndex < 0 ||
      targetIndex < 0 ||
      fromIndex >= localEntries.length ||
      targetIndex >= localEntries.length
    ) {
      movingTaskIndex = null;
      return;
    }

    localEntries = moveEntry(localEntries, fromIndex, targetIndex);
    movingTaskIndex = null;
    emitSave();
  }

  function startMovingTask(index: number) {
    activeMenuIndex = null;
    movingTaskIndex = index;
  }

  function handleTaskCardClick(index: number) {
    if (movingTaskIndex === null) return;
    moveEntryToIndex(movingTaskIndex, index);
  }

  function handleTaskCardKeydown(index: number, event: KeyboardEvent) {
    if (movingTaskIndex === null) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTaskCardClick(index);
    }
  }

  function editEntry(index: number) {
    activeMenuIndex = null;
    taskModalMode = "edit";
    editingTaskIndex = index;
    editingTaskTitle = (localEntries[index].title || "").trim();
    editingTaskText = (localEntries[index].text || "").trim();
    editingTaskDueAt = localEntries[index].dueAt || "";
    editingTaskPriority = localEntries[index].priority || "medium";
    taskTitleError = false;
  }

  function setProgress(index: number, progress: number) {
    localEntries[index] = { ...localEntries[index], progress };
    localEntries = localEntries;
    emitSave();
  }

  function handleProgressInput(index: number, event: Event) {
    setProgress(index, Number((event.currentTarget as HTMLInputElement).value));
  }

  function toggleDone(index: number) {
    const current = localEntries[index];
    const status = current.status === "done" ? "open" : "done";
    const progress =
      status === "done" ? 100 : Math.min(current.progress || 0, 90);
    localEntries[index] = { ...current, status, progress };
    localEntries = localEntries;
    emitSave();
  }

  function toggleCancelled(index: number) {
    const current = localEntries[index];
    const status = current.status === "cancelled" ? "open" : "cancelled";
    localEntries[index] = { ...current, status };
    localEntries = localEntries;
    activeMenuIndex = null;
    emitSave();
  }

  function requestDeleteEntry(index: number) {
    activeMenuIndex = null;
    deleteTaskPrompt = {
      index,
      title: getTodoTitle(localEntries[index]),
    };
  }

  function cancelDeletePrompt() {
    deleteTaskPrompt = null;
  }

  function confirmDeletePrompt() {
    if (!deleteTaskPrompt) return;
    const index = deleteTaskPrompt.index;
    localEntries = removeEntry(localEntries, index);
    deleteTaskPrompt = null;
    emitSave();
  }

  function cancelTaskEdit() {
    taskModalMode = null;
    editingTaskIndex = null;
    editingTaskTitle = "";
    editingTaskText = "";
    editingTaskDueAt = "";
    editingTaskPriority = "medium";
    taskTitleError = false;
    activeSelectionRequestId = 0;
    filledFromSuggestion = false;
  }

  function saveTaskEdit() {
    const title = editingTaskTitle.trim();
    const text = editingTaskText.trim();
    taskTitleError = !title && !text;
    if (!title && !text) {
      return;
    }

    taskTitleError = false;

    if (taskModalMode === "add") {
      localEntries = [
        ...localEntries,
        {
          title,
          ...(text ? { text } : {}),
          progress: 0,
          status: "open",
          priority: editingTaskPriority,
          dueAt: normalizeDueAt(editingTaskDueAt),
        },
      ];
      tick().then(() => {
        if (entriesContainerElem)
          entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight;
      });
    } else {
      if (editingTaskIndex === null) return;
      localEntries[editingTaskIndex] = {
        ...localEntries[editingTaskIndex],
        title,
        text: text || undefined,
        dueAt: normalizeDueAt(editingTaskDueAt),
      };
      localEntries = localEntries;
    }

    cancelTaskEdit();
    emitSave();
  }

  function cyclePriority(index: number) {
    const current = localEntries[index];
    const priority =
      current.priority === "low"
        ? "medium"
        : current.priority === "medium"
          ? "high"
          : "low";

    localEntries[index] = { ...current, priority };
    localEntries = localEntries;
    activeMenuIndex = null;
    emitSave();
  }

  function getStatusLabel(entry: TodoEntry): string {
    if (entry.status === "done") return $t("todoEditor.statusDone");
    if (entry.status === "cancelled") return $t("todoEditor.statusCancelled");
    return $t("todoEditor.statusOpen");
  }

  function getPriorityLabel(entry: TodoEntry): string {
    if (entry.priority === "high") return $t("todoEditor.priorityHigh");
    if (entry.priority === "low") return $t("todoEditor.priorityLow");
    return $t("todoEditor.priorityMedium");
  }

  function cyclePriorityFilter() {
    activePriorityFilter =
      activePriorityFilter === "all"
        ? "high"
        : activePriorityFilter === "high"
          ? "medium"
          : activePriorityFilter === "medium"
            ? "low"
            : "all";
  }

  function cancelMovingTask() {
    movingTaskIndex = null;
  }

  function closeTaskMenu() {
    activeMenuIndex = null;
  }

  function handleStatusFilterChange(event: CustomEvent<string>) {
    activeFilter = event.detail as typeof activeFilter;
  }
</script>

<div class="todo-editor editor-shell">
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
    <div class="todo-editor__header-actions">
      <button
        class="icon-btn primary-btn"
        on:click={openAddTaskModal}
        title={$t("todoEditor.addTask")}
        ><span class="anemona icon-plus"></span></button
      >
    </div>
  </EditorHeader>

  <div class="todo-editor__summary">
    <div class="todo-editor__summary-copy">
      <span class="todo-editor__summary-label">{$t("todoEditor.progress")}</span
      >
      <strong class="todo-editor__summary-value">{totalProgress}%</strong>
    </div>
    <div class="todo-editor__summary-bar">
      <span class="todo-editor__summary-fill" style={`width:${totalProgress}%`}
      ></span>
    </div>
  </div>

  <SearchToolbar
    value={filterText}
    placeholder={$t("todoEditor.searchPlaceholder")}
    showSort={false}
    on:input={(e) => {
      filterText = e.detail;
    }}
  >
    <span
      slot="actions"
      class="todo-editor__priority-filter anemona {priorityFilterLabel}"
      on:click={cyclePriorityFilter}
      title={priorityFilterTitle}
      role="button"
      tabindex="0"
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cyclePriorityFilter(); } }}
    ></span>
  </SearchToolbar>

  <FilterChips
    options={statusFilterOptions}
    value={activeFilter}
    on:change={handleStatusFilterChange}
  />

  {#if movingTaskIndex !== null}
    <div class="todo-editor__move-hint">
      <span>{$t("todoEditor.moveHint")}</span>
      <button class="todo-editor__text-button" on:click={cancelMovingTask}
        >{$t("todoEditor.cancel")}</button
      >
    </div>
  {/if}

  <div class="todo-editor__list" bind:this={entriesContainerElem}>
    {#if visibleEntries.length === 0}
      {#if localEntries.length > 0}
        <div class="ui-empty">{$t("todoEditor.emptyFilters")}</div>
      {/if}
    {:else}
      {#each visibleEntries as item (item.entry)}
        {@const entry = item.entry}
        {@const index = item.index}
        <div
          class="todo-card ui-card"
          style={`--todo-progress-accent:${getProgressAccent(entry.progress, entry.status)};`}
          class:todo-card--done={entry.status === "done"}
          class:todo-card--cancelled={entry.status === "cancelled"}
          class:todo-card--priority-high={entry.priority === "high"}
          class:todo-card--priority-medium={entry.priority === "medium"}
          class:todo-card--priority-low={entry.priority === "low"}
          class:todo-card--single-content={!getTodoBodyText(entry)}
          class:todo-card--menu-open={activeMenuIndex === index}
          class:todo-card--moving={movingTaskIndex === index}
          class:todo-card--move-target={movingTaskIndex !== null &&
            movingTaskIndex !== index}
          on:click={() => handleTaskCardClick(index)}
          on:keydown={(event) => handleTaskCardKeydown(index, event)}
          role="button"
          tabindex="0"
        >
          <div class="todo-card__copy">
            <EntryTitleBar
              title={getTodoTitle(entry)}
              menuOpen={activeMenuIndex === index}
              menuTitle={$t("todoEditor.entryOptions")}
              editLabel={$t("todoEditor.edit")}
              deleteLabel={$t("todoEditor.delete")}
              on:toggleMenu={() => toggleTaskMenu(index)}
              on:closeMenu={closeTaskMenu}
            >
              <button
                slot="leading"
                class="check-toggle"
                on:click={() => toggleDone(index)}
                title={entry.status === "done"
                  ? $t("todoEditor.markOpen")
                  : $t("todoEditor.markDone")}
              >
                <span
                  class={`anemona ${entry.status === "done" ? "icon-checked" : "icon-checkbox"}`}
                ></span>
              </button>
              <svelte:fragment slot="menu">
                <button
                  class="menu-item"
                  on:click|stopPropagation={() => editEntry(index)}
                >
                  <span class="anemona icon-edit-alt"></span>
                  <span>{$t("todoEditor.edit")}</span>
                </button>
                <button
                  class="menu-item"
                  on:click|stopPropagation={() => startMovingTask(index)}
                >
                  <span class="anemona icon-arrow-back"></span>
                  <span>{$t("todoEditor.move")}</span>
                </button>
                <button
                  class="menu-item"
                  on:click|stopPropagation={() => cyclePriority(index)}
                >
                  <span class="anemona icon-slider-alt"></span>
                  <span
                    >{$t("todoEditor.priorityLabel", {
                      label: getPriorityLabel(entry),
                    })}</span
                  >
                </button>
                <button
                  class="menu-item"
                  class:danger={entry.status !== "cancelled"}
                  on:click|stopPropagation={() => toggleCancelled(index)}
                >
                  <span class="anemona icon-x"></span>
                  <span
                    >{entry.status === "cancelled"
                      ? $t("todoEditor.restore")
                      : $t("todoEditor.cancel")}</span
                  >
                </button>
                <button
                  class="menu-item danger"
                  on:click|stopPropagation={() => requestDeleteEntry(index)}
                >
                  <span class="anemona icon-trash-alt"></span>
                  <span>{$t("todoEditor.delete")}</span>
                </button>
              </svelte:fragment>
            </EntryTitleBar>
            <div class="todo-card__body">
              {#if getTodoBodyText(entry)}
                <div class="todo-card__text">{getTodoBodyText(entry)}</div>
              {/if}
              <div class="todo-card__meta">
                <span class="todo-card__progress">{entry.progress}%</span>
                <span class="todo-card__status">{getStatusLabel(entry)}</span>
                <button
                  class={`todo-card__priority ${entry.priority}`}
                  on:click={() => cyclePriority(index)}
                  title={$t("todoEditor.changePriority")}
                  >{getPriorityLabel(entry)}</button
                >
                {#if entry.dueAt}
                  <span class={`todo-card__deadline ${getDueTone(entry)}`}
                    >{getRelativeDueLabel(entry)}</span
                  >
                {/if}
              </div>
            </div>
          </div>

          <div class="todo-card__progress-row">
            <input
              class="todo-card__progress-slider"
              type="range"
              min="0"
              max="100"
              step="5"
              value={entry.progress}
              disabled={entry.status === "done"}
              on:input={(event) => handleProgressInput(index, event)}
            />
          </div>
        </div>
      {/each}
    {/if}

    <button
      class="todo-editor__add-entry add-entry-btn"
      class:no-entries={localEntries.length === 0}
      on:click={openAddTaskModal}
      ><span class="anemona icon-plus"></span>
      {$t("todoEditor.addEntry")}</button
    >
  </div>

  {#if taskModalMode}
    <button
      class="modal-backdrop"
      on:click={cancelTaskEdit}
      aria-label="Close task edit"
    ></button>
    <div class="form-modal">
      <h3>
        {taskModalMode === "add"
          ? $t("todoEditor.addTaskTitle")
          : $t("todoEditor.editTaskTitle")}
      </h3>
      <input
        class="form-input todo-editor__task-title-input"
        class:field-error={taskTitleError}
        type="text"
        bind:this={taskTitleInput}
        bind:value={editingTaskTitle}
        placeholder={$t("common.title")}
      />
      <textarea
        class="form-input form-textarea tall"
        bind:value={editingTaskText}
        rows="5"
        placeholder={$t("todoEditor.taskPlaceholder")}
      ></textarea>
      <input
        class="form-input todo-editor__task-date-input"
        type="datetime-local"
        bind:value={editingTaskDueAt}
      />
      <div class="form-actions">
        <button class="btn" on:click={cancelTaskEdit}
          >{$t("todoEditor.cancel")}</button
        >
        <button class="btn primary" on:click={saveTaskEdit}
          >{taskModalMode === "add"
            ? $t("todoEditor.add")
            : $t("todoEditor.save")}</button
        >
      </div>
    </div>
  {/if}

  <DeleteConfirmModal
    show={deleteTaskPrompt !== null}
    title={$t("todoEditor.deleteTaskTitle")}
    itemName={deleteTaskPrompt ? deleteTaskPrompt.title : ""}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />
</div>

<style>
  .todo-editor__summary {
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    padding-top: 0.22rem;
    flex-shrink: 0;
  }

  .todo-editor__summary-copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.35rem;
  }

  .todo-editor__summary-label {
    font-size: var(--ui-font-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-muted);
  }

  .todo-editor__summary-value {
    font-size: var(--ui-font-md);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .todo-editor__summary-bar {
    width: 100%;
    height: 0.22rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--vscode-sideBar-background) 86%,
      transparent
    );
    overflow: hidden;
    border: 1px solid var(--theme-accent-border);
  }

  .todo-editor__summary-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--theme-accent-readable);
  }

  .todo-editor__priority-filter {
    font-size: 1.2rem;
    flex-shrink: 0;
    cursor: pointer;
    transition: color 0.12s ease;
    color: var(--ui-muted);
  }

  .todo-editor__priority-filter:hover {
    opacity: 0.8;
  }

  .todo-editor__priority-filter.high {
    color: var(--ui-danger);
  }

  .todo-editor__priority-filter.medium {
    color: var(--ui-warning);
  }

  .todo-editor__priority-filter.low {
    color: var(--ui-success);
  }

  .todo-editor__move-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0.24rem 0.38rem;
    margin-top: 0.22rem;
    border: 1px solid var(--theme-accent-border);
    border-radius: var(--ui-radius-sm);
    background: var(--theme-accent-soft);
    color: var(--vscode-sideBarTitle-foreground);
    font-size: var(--ui-font-xs);
  }

  .todo-editor__text-button {
    border: none;
    background: transparent;
    color: var(--theme-accent-text);
    cursor: pointer;
    font-size: inherit;
    padding: 0;
  }

  .todo-editor__list {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.24rem;
  }

  .todo-card {
    --todo-priority-color: var(--theme-accent);
    --check-toggle-color: color-mix(
      in srgb,
      var(--todo-priority-color) 76%,
      var(--vscode-sideBarTitle-foreground)
    );
    --check-toggle-hover-color: color-mix(
      in srgb,
      var(--todo-priority-color) 90%,
      white 10%
    );
    --check-toggle-hover-bg: color-mix(
      in srgb,
      var(--todo-priority-color) 10%,
      transparent
    );
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    margin-bottom: 0.18rem;
  }

  .todo-card.todo-card--priority-high {
    --todo-priority-color: var(--ui-danger);
    border-color: color-mix(in srgb, var(--ui-danger) 18%, var(--ui-border));
    background: transparent;
  }

  .todo-card.todo-card--priority-medium {
    --todo-priority-color: var(--ui-warning);
    border-color: color-mix(in srgb, var(--ui-warning) 16%, var(--ui-border));
    background: transparent;
  }

  .todo-card.todo-card--priority-low {
    --todo-priority-color: var(--ui-success);
    border-color: color-mix(in srgb, var(--ui-success) 16%, var(--ui-border));
    background: transparent;
  }

  .todo-card.todo-card--move-target {
    cursor: pointer;
  }

  .todo-card.todo-card--menu-open {
    z-index: var(--ui-z-popover);
  }

  .todo-card.todo-card--moving {
    border-style: dashed;
    border-color: var(--theme-accent-border-strong);
  }

  .todo-card.todo-card--done {
    opacity: 0.92;
  }

  .todo-card.todo-card--cancelled {
    opacity: 0.7;
  }

  .todo-card.todo-card--done .todo-card__progress,
  .todo-card.todo-card--done .todo-card__status,
  .todo-card.todo-card--done .todo-card__text,
  .todo-card.todo-card--cancelled .todo-card__progress,
  .todo-card.todo-card--cancelled .todo-card__status,
  .todo-card.todo-card--cancelled .todo-card__text,
  :global(.todo-card.todo-card--done .entry-title),
  :global(.todo-card.todo-card--cancelled .entry-title) {
    color: var(--vscode-sideBarTitle-foreground);
  }

  .todo-card.todo-card--done .todo-card__priority,
  .todo-card.todo-card--cancelled .todo-card__priority {
    color: var(--vscode-sideBarTitle-foreground);
    border-color: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 10%,
      transparent
    );
  }

  .todo-card.todo-card--done .check-toggle {
    color: color-mix(in srgb, var(--ui-success) 60%, transparent);
  }

  .todo-card.todo-card--cancelled .check-toggle {
    color: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 64%,
      transparent
    );
  }

  .todo-card__copy {
    min-width: 0;
  }

  .todo-card__meta {
    display: flex;
    align-items: center;
    gap: 0.14rem;
    flex-wrap: wrap;
    font-size: 0.54rem;
    line-height: 1.1;
  }

  .todo-card__priority {
    border: 1px solid transparent;
    border-radius: 999px;
    background: color-mix(in srgb, var(--todo-priority-color) 8%, transparent);
    color: color-mix(
      in srgb,
      var(--todo-priority-color) 64%,
      var(--vscode-sideBarTitle-foreground)
    );
    padding: 0.03rem 0.18rem;
    font-size: var(--ui-font-xs);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    font-weight: 400;
    cursor: pointer;
  }

  .todo-card__priority.high {
    background: var(--ui-danger-bg);
    border-color: color-mix(in srgb, var(--ui-danger) 24%, transparent);
    color: color-mix(in srgb, var(--ui-danger) 72%, white 28%);
  }

  .todo-card__priority.medium {
    background: var(--ui-warning-bg);
    border-color: color-mix(in srgb, var(--ui-warning) 24%, transparent);
    color: color-mix(in srgb, var(--ui-warning) 72%, white 28%);
  }

  .todo-card__priority.low {
    background: var(--ui-success-bg);
    border-color: color-mix(in srgb, var(--ui-success) 24%, transparent);
    color: color-mix(in srgb, var(--ui-success) 72%, white 28%);
  }

  .todo-card__progress {
    font-weight: 400;
    color: var(--todo-progress-accent);
  }

  .todo-card__status {
    color: color-mix(in srgb, var(--todo-progress-accent) 58%, var(--ui-muted));
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .todo-card__deadline {
    font-size: 0.52rem;
    letter-spacing: 0.01em;
    color: var(--ui-muted);
  }

  .todo-card__deadline.future {
    color: color-mix(in srgb, var(--todo-progress-accent) 46%, var(--ui-muted));
  }

  .todo-card__deadline.soon {
    color: var(--ui-warning-text);
  }

  .todo-card__deadline.late {
    color: var(--ui-danger-text);
  }

  :global(.todo-card .entry-title) {
    width: 100%;
    color: var(--vscode-sideBarTitle-foreground);
    font-size: 0.62rem;
    font-weight: 400;
    line-height: 1.18;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.todo-card.todo-card--single-content .entry-title-bar__title-group),
  :global(.todo-card.todo-card--single-content .entry-title) {
    overflow: visible;
  }

  :global(.todo-card.todo-card--single-content .entry-title) {
    text-overflow: clip;
    white-space: pre-wrap;
  }

  :global(.todo-card.todo-card--done .entry-title) {
    text-decoration: line-through;
    opacity: 0.82;
  }

  :global(.todo-card.todo-card--cancelled .entry-title) {
    text-decoration: line-through;
    opacity: 0.58;
  }

  .todo-card.todo-card--done .todo-card__text {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .todo-card.todo-card--cancelled .todo-card__text {
    text-decoration: line-through;
    opacity: 0.58;
  }

  .todo-editor__task-date-input {
    margin-top: 0.55rem;
    margin-bottom: 0.8rem;
  }

  .todo-editor__task-title-input {
    margin-bottom: 0.45rem;
  }

  .todo-card__progress-row {
    padding-left: 1.3rem;
    padding-top: 0;
  }

  .todo-card__progress-slider {
    width: 100%;
    accent-color: var(--todo-progress-accent);
    height: 0.54rem;
    background: transparent;
    appearance: none;
  }

  .todo-card__progress-slider::-webkit-slider-runnable-track {
    height: 0.18rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 22%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 14%, transparent);
  }

  .todo-card__progress-slider::-webkit-slider-thumb {
    appearance: none;
    width: 0.7rem;
    height: 0.7rem;
    margin-top: -0.27rem;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 24%, transparent);
    background: var(--todo-progress-accent);
  }

  .todo-card__progress-slider::-moz-range-track {
    height: 0.18rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 22%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 14%, transparent);
  }

  .todo-card__progress-slider::-moz-range-thumb {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 24%, transparent);
    background: var(--todo-progress-accent);
  }

  .todo-card__progress-slider:disabled {
    accent-color: var(--ui-success);
    opacity: 0.85;
  }
</style>
