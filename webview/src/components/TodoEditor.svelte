<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { t } from '../i18n'
  import EditorHeader from '../lib/EditorHeader.svelte'
  import EntryTitleBar from '../lib/EntryTitleBar.svelte'
  import SearchToolbar from '../lib/SearchToolbar.svelte'
  import DeleteConfirmModal from '../lib/DeleteConfirmModal.svelte'

  type TodoEntry = {
    title: string;
    text?: string;
    progress: number;
    status: "open" | "done" | "cancelled";
    priority: "low" | "medium" | "high";
    dueAt?: string;
  };

  export let entries: TodoEntry[] = [];
  export let selectedNote: { name: string; filePath: string };
  export let initialFilterText = "";
  export let selectionSuggestion: { title?: string; type?: string; text?: string; requestId?: number } | null = null;
  export let onRequestSelectionCheck: () => number;

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
  let taskTitleInput: HTMLInputElement;
  let taskTitleError = false;
  let taskTextError = false;
  let entriesContainerElem: HTMLDivElement;
  let deleteTaskPrompt: { index: number; title: string } | null = null;
  let lastAppliedInitialFilter = "";
  let filledFromSuggestion = false;
  let activeSelectionRequestId = 0;

  let _prevEntries = entries
  $: if (entries !== localEntries && entries !== _prevEntries) {
    _prevEntries = entries
    localEntries = entries.map((entry) => ({ ...entry }));
  }

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText;
    lastAppliedInitialFilter = initialFilterText;
  }

  $: if (selectionSuggestion?.text && selectionSuggestion.requestId === activeSelectionRequestId && taskModalMode === 'add' && !filledFromSuggestion) {
    filledFromSuggestion = true;
    const trimmed = selectionSuggestion.text.trim();
    let jsonHandled = false;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const obj = Array.isArray(parsed) ? parsed[0] : parsed;
        if (obj && typeof obj === 'object') {
          editingTaskTitle = obj.title || '';
          editingTaskText = obj.task || obj.text || obj.title || '';
          if (obj.priority && ['high','medium','low'].includes(String(obj.priority).toLowerCase())) {
            editingTaskPriority = String(obj.priority).toLowerCase() as 'high' | 'medium' | 'low';
          }
          if (obj.due || obj.dueAt) editingTaskDueAt = String(obj.due || obj.dueAt || '');
          jsonHandled = true;
        }
      } catch { /* fall through */ }
    }
    if (!jsonHandled) {
      const cleaned = trimmed.replace(/^[\{\[]\s*/, '').replace(/\s*[\}\]]$/, '').trim();
      const lines = cleaned.split('\n').filter(l => l.trim());
      const parsed: Record<string, string> = {};
      for (const line of lines) {
        const t = line.trim().replace(/,$/, '');
        const m = t.match(/^\s*[-*]\s+(\[.?\])\s+(.+)/);
        if (m) { if (!parsed.title) parsed.title = m[2].trim(); continue; }
        const m2 = t.match(/^\s*[-*]\s+(.+)/);
        if (m2) { if (!parsed.title) parsed.title = m2[1].trim(); continue; }
        const idx = t.indexOf(':');
        if (idx > 0) {
          const key = t.slice(0, idx).trim().toLowerCase().replace(/^["']|["']$/g, '');
          const value = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (key === 'title' && !parsed.title) parsed.title = value;
          if ((key === 'task' || key === 'text') && !parsed.text) parsed.text = value;
          if (key === 'priority' && ['high','medium','low'].includes(value.toLowerCase())) parsed.priority = value.toLowerCase();
          if ((key === 'due' || key === 'dueAt') && !parsed.due) parsed.due = value;
        }
      }
      if (!parsed.text) parsed.text = lines[0]?.trim() || '';
      if (parsed.title) editingTaskTitle = parsed.title;
      if (parsed.text) editingTaskText = parsed.text;
      if (parsed.due) editingTaskDueAt = parsed.due;
    }
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

      return [getTodoTitle(entry), getTodoText(entry), getPriorityLabel(entry), getStatusLabel(entry)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilterText);
    });

  function deriveTitle(text: string): string {
    return text.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(' ') || 'Untitled'
  }

  function getTodoText(entry: TodoEntry): string {
    return (entry.text || entry.title || '').trim()
  }

  function getTodoTitle(entry: TodoEntry): string {
    return entry.text && entry.title ? entry.title.trim() : deriveTitle(getTodoText(entry))
  }

  $: filterCounts = {
    all: localEntries.length,
    open: localEntries.filter((entry) => entry.status === "open").length,
    done: localEntries.filter((entry) => entry.status === "done").length,
    cancelled: localEntries.filter((entry) => entry.status === "cancelled")
      .length,
  };

  $: priorityFilterLabel =
    activePriorityFilter === "high"
      ? $t('todoEditor.priorityShortH')
      : activePriorityFilter === "medium"
        ? $t('todoEditor.priorityShortM')
        : activePriorityFilter === "low"
          ? $t('todoEditor.priorityShortL')
          : $t('todoEditor.priorityShortP');

  $: priorityFilterTitle =
    activePriorityFilter === "high"
      ? $t('todoEditor.filterHigh')
      : activePriorityFilter === "medium"
        ? $t('todoEditor.filterMedium')
        : activePriorityFilter === "low"
          ? $t('todoEditor.filterLow')
          : $t('todoEditor.filterAll');

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
    if (!entry.dueAt) return "";

    const dueTime = new Date(entry.dueAt).getTime();
    if (Number.isNaN(dueTime)) return "";

    const diff = dueTime - Date.now();
    const overdue = diff < 0;
    const absoluteMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));
    const units = [
      { label: "month", minutes: 60 * 24 * 30 },
      { label: "week", minutes: 60 * 24 * 7 },
      { label: "day", minutes: 60 * 24 },
      { label: "hour", minutes: 60 },
      { label: "minute", minutes: 1 },
    ];
    const unit =
      units.find((item) => absoluteMinutes >= item.minutes) ||
      units[units.length - 1];
    const value = Math.max(1, Math.round(absoluteMinutes / unit.minutes));
    const suffix = value === 1 ? unit.label : `${unit.label}s`;

    return overdue
      ? `Overdue by ${value} ${suffix}`
      : `Due in ${value} ${suffix}`;
  }

  function getDueTone(entry: TodoEntry): "late" | "soon" | "future" {
    if (!entry.dueAt) return "future";

    const diff = new Date(entry.dueAt).getTime() - Date.now();
    if (Number.isNaN(diff)) return "future";
    if (diff < 0) return "late";
    if (diff <= 1000 * 60 * 60 * 24 * 3) return "soon";
    return "future";
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
          title: entry.title.trim(),
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
    taskTitleError = false;
    taskTextError = false;
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

    const nextEntries = [...localEntries];
    const [entry] = nextEntries.splice(fromIndex, 1);
    if (!entry) return;
    const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextEntries.splice(insertIndex, 0, entry);
    localEntries = nextEntries;
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
    editingTaskTitle = getTodoTitle(localEntries[index]);
    editingTaskText = getTodoText(localEntries[index]);
    editingTaskDueAt = localEntries[index].dueAt || "";
    taskTitleError = false;
    taskTextError = false;
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
    localEntries = localEntries.filter((_, itemIndex) => itemIndex !== index);
    deleteTaskPrompt = null;
    emitSave();
  }

  function cancelTaskEdit() {
    taskModalMode = null;
    editingTaskIndex = null;
    editingTaskTitle = "";
    editingTaskText = "";
    editingTaskDueAt = "";
    taskTitleError = false;
    taskTextError = false;
    activeSelectionRequestId = 0;
    filledFromSuggestion = false;
  }

  function saveTaskEdit() {
    const title = editingTaskTitle.trim();
    const text = editingTaskText.trim();
    taskTitleError = !title;
    taskTextError = !text;
    if (!title || !text) {
      return;
    }

    taskTitleError = false;
    taskTextError = false;

    if (taskModalMode === "add") {
      localEntries = [
        ...localEntries,
        {
          title,
          text,
          progress: 0,
          status: "open",
          priority: "medium",
          dueAt: normalizeDueAt(editingTaskDueAt),
        },
      ];
      tick().then(() => {
        if (entriesContainerElem) entriesContainerElem.scrollTop = entriesContainerElem.scrollHeight
      })
    } else {
      if (editingTaskIndex === null) return;
      localEntries[editingTaskIndex] = {
        ...localEntries[editingTaskIndex],
        title,
        text,
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
    if (entry.status === "done") return "Done";
    if (entry.status === "cancelled") return "Cancelled";
    return "Open";
  }

  function getPriorityLabel(entry: TodoEntry): string {
    if (entry.priority === "high") return "High";
    if (entry.priority === "low") return "Low";
    return "Medium";
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
</script>

<div class="todo-editor editor-shell">
  <EditorHeader noteName={selectedNote.name} on:back={() => dispatch('back')}>
    <div class="header-actions">
      <button class="icon-btn primary-btn" on:click={openAddTaskModal} title={$t('todoEditor.addTask')}><span class="anemona icon-plus"></span></button>
    </div>
  </EditorHeader>

    <div class="todo-summary">
      <div class="summary-copy">
        <span class="summary-label">{$t('todoEditor.progress')}</span>
        <strong class="summary-value">{totalProgress}%</strong>
      </div>
      <div class="summary-bar">
        <span class="summary-bar-fill" style={`width:${totalProgress}%`}></span>
      </div>
    </div>

    <SearchToolbar
      value={filterText}
      placeholder={$t('todoEditor.searchPlaceholder')}
      showSort={false}
      on:input={(e) => { filterText = e.detail }}
    >
      <button
        slot="actions"
        class="icon-btn toolbar-priority-btn {activePriorityFilter}"
        on:click={cyclePriorityFilter}
        title={priorityFilterTitle}
      >
        <span class="anemona">{priorityFilterLabel}</span>
      </button>
    </SearchToolbar>

    <div class="filter-row">
      <button
        class="filter-chip"
        class:active={activeFilter === "all"}
        on:click={() => (activeFilter = "all")}>{$t('todoEditor.allCount', { count: filterCounts.all })}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "open"}
        on:click={() => (activeFilter = "open")}>{$t('todoEditor.openCount', { count: filterCounts.open })}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "done"}
        on:click={() => (activeFilter = "done")}>{$t('todoEditor.doneCount', { count: filterCounts.done })}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "cancelled"}
        on:click={() => (activeFilter = "cancelled")}
        >{$t('todoEditor.cancelledCount', { count: filterCounts.cancelled })}</button
      >
    </div>

    {#if movingTaskIndex !== null}
      <div class="move-hint">
        <span>{$t('todoEditor.moveHint')}</span>
        <button class="text-btn" on:click={cancelMovingTask}>{$t('todoEditor.cancel')}</button>
      </div>
    {/if}

    <div class="todo-list" bind:this={entriesContainerElem}>
      {#if visibleEntries.length === 0}
        {#if localEntries.length > 0}
          <div class="empty-state">{$t('todoEditor.emptyFilters')}</div>
        {/if}
      {:else}
        {#each visibleEntries as item (item.entry)}
          {@const entry = item.entry}
          {@const index = item.index}
          <div
            class="todo-card"
            style={`--todo-progress-accent:${getProgressAccent(entry.progress, entry.status)};`}
            class:done={entry.status === "done"}
            class:cancelled={entry.status === "cancelled"}
            class:priority-high={entry.priority === "high"}
            class:priority-medium={entry.priority === "medium"}
            class:priority-low={entry.priority === "low"}
            class:menu-open={activeMenuIndex === index}
            class:moving={movingTaskIndex === index}
            class:move-target={movingTaskIndex !== null &&
              movingTaskIndex !== index}
            on:click={() => handleTaskCardClick(index)}
            on:keydown={(event) => handleTaskCardKeydown(index, event)}
            role="button"
            tabindex="0"
          >
            <div class="todo-copy">
              <EntryTitleBar
                title={getTodoTitle(entry)}
                menuOpen={activeMenuIndex === index}
                menuTitle={$t('todoEditor.entryOptions')}
                editLabel={$t('todoEditor.edit')}
                deleteLabel={$t('todoEditor.delete')}
                on:toggleMenu={() => toggleTaskMenu(index)}
                on:closeMenu={closeTaskMenu}
              >
                <button
                  slot="leading"
                  class="check-toggle"
                  on:click={() => toggleDone(index)}
                  title={entry.status === "done" ? $t('todoEditor.markOpen') : $t('todoEditor.markDone')}
                >
                  <span
                    class={`anemona ${entry.status === "done" ? "icon-checked" : "icon-checkbox"}`}
                  ></span>
                </button>
                <svelte:fragment slot="menu">
                  <button class="menu-item" on:click|stopPropagation={() => editEntry(index)}>
                    <span class="anemona icon-edit-alt"></span>
                    <span>{$t('todoEditor.edit')}</span>
                  </button>
                  <button class="menu-item" on:click|stopPropagation={() => startMovingTask(index)}>
                    <span class="anemona icon-arrow-back"></span>
                    <span>{$t('todoEditor.move')}</span>
                  </button>
                  <button class="menu-item" on:click|stopPropagation={() => cyclePriority(index)}>
                    <span class="anemona icon-slider-alt"></span>
                    <span>{$t('todoEditor.priorityLabel', { label: getPriorityLabel(entry) })}</span>
                  </button>
                  <button
                    class="menu-item"
                    class:danger={entry.status !== "cancelled"}
                    on:click|stopPropagation={() => toggleCancelled(index)}
                  >
                    <span class="anemona icon-x"></span>
                    <span>{entry.status === "cancelled" ? $t('todoEditor.restore') : $t('todoEditor.cancel')}</span>
                  </button>
                  <button class="menu-item danger" on:click|stopPropagation={() => requestDeleteEntry(index)}>
                    <span class="anemona icon-trash-alt"></span>
                    <span>{$t('todoEditor.delete')}</span>
                  </button>
                </svelte:fragment>
              </EntryTitleBar>
              <div class="item-body">
                <div class="item-text">{getTodoText(entry)}</div>
                <div class="todo-meta">
                  <span class="todo-progress">{entry.progress}%</span>
                  <span class="todo-status">{getStatusLabel(entry)}</span>
                  <button
                    class={`priority-chip ${entry.priority}`}
                    on:click={() => cyclePriority(index)}
                    title={$t('todoEditor.changePriority')}>{getPriorityLabel(entry)}</button
                  >
                  {#if entry.dueAt}
                    <span class={`todo-deadline ${getDueTone(entry)}`}
                      >{getRelativeDueLabel(entry)}</span
                    >
                  {/if}
                </div>
              </div>
            </div>

            <div class="todo-progress-row">
              <input
                class="progress-slider"
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

      <button class="add-entry-btn" class:no-entries={localEntries.length === 0} on:click={openAddTaskModal}
        ><span class="anemona icon-plus"></span> {$t('todoEditor.addEntry')}</button
      >
    </div>

  {#if taskModalMode}
    <button
      class="modal-backdrop"
      on:click={cancelTaskEdit}
      aria-label="Close task edit"
    ></button>
    <div class="form-modal">
      <h3>{taskModalMode === "add" ? $t('todoEditor.addTaskTitle') : $t('todoEditor.editTaskTitle')}</h3>
      <input
        class="form-input task-title-input"
        class:field-error={taskTitleError}
        type="text"
        bind:this={taskTitleInput}
        bind:value={editingTaskTitle}
        placeholder={$t('common.title')}
      />
      <textarea
        class="form-input form-textarea tall"
        class:field-error={taskTextError}
        bind:value={editingTaskText}
        rows="5"
        placeholder={$t('todoEditor.taskPlaceholder')}
      ></textarea>
      <input
        class="form-input task-date-input"
        type="datetime-local"
        bind:value={editingTaskDueAt}
      />
      <div class="form-actions">
        <button class="btn" on:click={cancelTaskEdit}>{$t('todoEditor.cancel')}</button>
        <button class="btn primary" on:click={saveTaskEdit}
          >{taskModalMode === "add" ? $t('todoEditor.add') : $t('todoEditor.save')}</button
        >
      </div>
    </div>
  {/if}

  <DeleteConfirmModal
    show={deleteTaskPrompt !== null}
    title={$t('todoEditor.deleteTaskTitle')}
    itemName={deleteTaskPrompt ? deleteTaskPrompt.title : ''}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />
</div>

<style>
  .todo-summary {
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    padding-top: 0.22rem;
    flex-shrink: 0;
  }

  .summary-copy {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.35rem;
  }

  .summary-label {
    font-size: var(--ui-font-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-muted);
  }

  .summary-value {
    font-size: var(--ui-font-md);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
  }

  .summary-bar {
    width: 100%;
    height: 0.22rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--vscode-sideBar-background) 86%,
      transparent
    );
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 10%, var(--ui-border));
  }

  .summary-bar-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in srgb, var(--accent-color) 78%, white 22%);
  }

  .filter-row {
    display: flex;
    gap: 0.14rem;
    padding-top: 0.22rem;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  .toolbar-priority-btn {
    width: 1.9rem;
    height: var(--ui-control-height-sm);
    box-sizing: border-box;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid var(--ui-border-strong);
    border-radius: 6px;
    background: var(--vscode-input-background);
    color: var(--vscode-sideBarTitle-foreground);
    font-size: var(--ui-font-xs);
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      border-color 0.12s ease,
      background 0.12s ease,
      color 0.12s ease;
  }

  .toolbar-priority-btn:hover {
    border-color: color-mix(in srgb, var(--accent-color) 26%, transparent);
  }

  .toolbar-priority-btn.all {
    color: var(--ui-muted);
  }

  .toolbar-priority-btn.high {
    color: color-mix(in srgb, #e17076 80%, white 20%);
    border-color: color-mix(in srgb, #e17076 30%, var(--ui-border));
    background: color-mix(in srgb, #e17076 10%, transparent);
  }

  .toolbar-priority-btn.medium {
    color: color-mix(in srgb, #f5a623 84%, white 16%);
    border-color: color-mix(in srgb, #f5a623 30%, var(--ui-border));
    background: color-mix(in srgb, #f5a623 10%, transparent);
  }

  .toolbar-priority-btn.low {
    color: color-mix(in srgb, #68c3a0 84%, white 16%);
    border-color: color-mix(in srgb, #68c3a0 28%, var(--ui-border));
    background: color-mix(in srgb, #68c3a0 10%, transparent);
  }

  @media (max-width: 520px) {
    .toolbar-priority-btn {
      width: 1.82rem;
    }
  }

  .move-hint {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0.24rem 0.38rem;
    margin-top: 0.22rem;
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-sm);
    background: color-mix(in srgb, var(--accent-color) 6%, transparent);
    color: var(--vscode-sideBarTitle-foreground);
    font-size: var(--ui-font-xs);
  }

  .text-btn {
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: inherit;
    padding: 0;
  }

  .todo-list {
    flex: 1;
    overflow-y: auto;
    padding-top: 0.24rem;
  }

  .empty-state {
    padding: 0.72rem 0.58rem;
    border: 1px dashed
      color-mix(in srgb, var(--accent-color) 12%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    color: var(--ui-muted);
    text-align: center;
    font-size: var(--ui-font-sm);
    background: color-mix(in srgb, var(--accent-color) 4%, transparent);
  }

  .todo-card {
    --todo-priority-color: var(--accent-color);
    --check-toggle-color: color-mix(
      in srgb,
      var(--todo-priority-color) 76%,
      var(--vscode-sideBarTitle-foreground)
    );
    --check-toggle-hover-color: color-mix(in srgb, var(--todo-priority-color) 90%, white 10%);
    --check-toggle-hover-bg: color-mix(in srgb, var(--todo-priority-color) 10%, transparent);
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    gap: 0.14rem;
    margin-bottom: 0.18rem;
    padding: var(--ui-card-pad-y) var(--ui-card-pad-x);
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 9%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: color-mix(
      in srgb,
      var(--accent-color) 4%,
      var(--vscode-editor-background)
    );
  }

  .todo-card.priority-high {
    --todo-priority-color: #e17076;
    border-color: color-mix(in srgb, #e17076 18%, var(--ui-border));
    background: transparent;
  }

  .todo-card.priority-medium {
    --todo-priority-color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 16%, var(--ui-border));
    background: transparent;
  }

  .todo-card.priority-low {
    --todo-priority-color: #68c3a0;
    border-color: color-mix(in srgb, #68c3a0 16%, var(--ui-border));
    background: transparent;
  }

  .todo-card.move-target {
    cursor: pointer;
  }

  .todo-card.menu-open {
    z-index: 20;
  }

  .todo-card.moving {
    border-style: dashed;
    border-color: color-mix(in srgb, var(--accent-color) 42%, var(--ui-border));
  }

  .todo-card.done {
    opacity: 0.92;
  }

  .todo-card.cancelled {
    opacity: 0.7;
  }

  .todo-card.done .todo-progress,
  .todo-card.done .todo-status,
  .todo-card.done .item-text,
  .todo-card.cancelled .todo-progress,
  .todo-card.cancelled .todo-status,
  .todo-card.cancelled .item-text,
  :global(.todo-card.done .entry-title),
  :global(.todo-card.cancelled .entry-title) {
    color: var(--vscode-sideBarTitle-foreground);
  }

  .todo-card.done .priority-chip,
  .todo-card.cancelled .priority-chip {
    color: var(--vscode-sideBarTitle-foreground);
    border-color: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 10%,
      transparent
    );
  }

  .todo-card.done .check-toggle {
    color: #b8f0d8;
  }

  .todo-card.cancelled .check-toggle {
    color: color-mix(
      in srgb,
      var(--vscode-sideBarTitle-foreground) 64%,
      transparent
    );
  }

  .todo-copy {
    min-width: 0;
  }



  .todo-meta {
    display: flex;
    align-items: center;
    gap: 0.14rem;
    flex-wrap: wrap;
    font-size: 0.54rem;
    line-height: 1.1;
  }

  .priority-chip {
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

  .priority-chip.high {
    background: color-mix(in srgb, #e17076 8%, transparent);
    border-color: color-mix(in srgb, #e17076 26%, transparent);
    color: color-mix(in srgb, #e17076 72%, white 28%);
  }

  .priority-chip.medium {
    background: color-mix(in srgb, #f5a623 8%, transparent);
    border-color: color-mix(in srgb, #f5a623 24%, transparent);
    color: color-mix(in srgb, #f5a623 74%, white 26%);
  }

  .priority-chip.low {
    background: color-mix(in srgb, #68c3a0 8%, transparent);
    border-color: color-mix(in srgb, #68c3a0 24%, transparent);
    color: color-mix(in srgb, #68c3a0 72%, white 28%);
  }

  .todo-progress {
    font-weight: 400;
    color: var(--todo-progress-accent);
  }

  .todo-status {
    color: color-mix(in srgb, var(--todo-progress-accent) 58%, var(--ui-muted));
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .todo-deadline {
    font-size: 0.52rem;
    letter-spacing: 0.01em;
    color: var(--ui-muted);
  }

  .todo-deadline.future {
    color: color-mix(in srgb, var(--todo-progress-accent) 46%, var(--ui-muted));
  }

  .todo-deadline.soon {
    color: #ffd792;
  }

  .todo-deadline.late {
    color: #ffb0b3;
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

  :global(.todo-card.done .entry-title) {
    text-decoration: line-through;
    opacity: 0.82;
  }

  :global(.todo-card.cancelled .entry-title) {
    text-decoration: line-through;
    opacity: 0.58;
  }

  .todo-card.done .item-text {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .todo-card.cancelled .item-text {
    text-decoration: line-through;
    opacity: 0.58;
  }

  .task-modal-error {
    margin: 0.55rem 0 0;
    font-size: var(--ui-font-xs);
    color: #ff8d8d;
  }

  .task-date-input {
    margin-top: 0.55rem;
    margin-bottom: 0.8rem;
  }

  .task-title-input {
    margin-bottom: 0.45rem;
  }

  .todo-progress-row {
    padding-left: 1.3rem;
    padding-top: 0;
  }

  .progress-slider {
    width: 100%;
    accent-color: var(--todo-progress-accent);
    height: 0.54rem;
    background: transparent;
    appearance: none;
  }

  .progress-slider::-webkit-slider-runnable-track {
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

  .progress-slider::-webkit-slider-thumb {
    appearance: none;
    width: 0.7rem;
    height: 0.7rem;
    margin-top: -0.27rem;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 24%, transparent);
    background: var(--todo-progress-accent);
  }

  .progress-slider::-moz-range-track {
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

  .progress-slider::-moz-range-thumb {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--todo-progress-accent) 24%, transparent);
    background: var(--todo-progress-accent);
  }

  .progress-slider:disabled {
    accent-color: color-mix(in srgb, #68c3a0 84%, white 16%);
    opacity: 0.85;
  }

</style>
