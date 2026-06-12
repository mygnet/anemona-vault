<script lang="ts">
  import { createEventDispatcher, tick } from "svelte";
  import { smartPopover } from "../utils/smartPopover";

  type TodoEntry = {
    title: string;
    progress: number;
    status: "open" | "done" | "cancelled";
    priority: "low" | "medium" | "high";
    dueAt?: string;
  };

  export let entries: TodoEntry[] = [];
  export let selectedNote: { name: string; filePath: string };
  export let initialFilterText = "";

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
  let editingTaskDueAt = "";
  let taskTitleInput: HTMLTextAreaElement;
  let taskModalError = "";
  let entriesContainerElem: HTMLDivElement;
  let deleteTaskPrompt: { index: number; title: string; code: string } | null =
    null;
  let deleteTaskCodeInput = "";
  let lastAppliedInitialFilter = "";

  $: if (entries !== localEntries) {
    localEntries = entries.map((entry) => ({ ...entry }));
  }

  $: if (initialFilterText !== lastAppliedInitialFilter) {
    filterText = initialFilterText;
    lastAppliedInitialFilter = initialFilterText;
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

      return [entry.title, getPriorityLabel(entry), getStatusLabel(entry)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedFilterText);
    });

  $: filterCounts = {
    all: localEntries.length,
    open: localEntries.filter((entry) => entry.status === "open").length,
    done: localEntries.filter((entry) => entry.status === "done").length,
    cancelled: localEntries.filter((entry) => entry.status === "cancelled")
      .length,
  };

  $: priorityFilterLabel =
    activePriorityFilter === "high"
      ? "H"
      : activePriorityFilter === "medium"
        ? "M"
        : activePriorityFilter === "low"
          ? "L"
          : "P";

  $: priorityFilterTitle =
    activePriorityFilter === "high"
      ? "Priority filter: High"
      : activePriorityFilter === "medium"
        ? "Priority filter: Medium"
        : activePriorityFilter === "low"
          ? "Priority filter: Low"
          : "Priority filter: All";

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
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
      ? trimmed
      : undefined;
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
        .filter((entry) => entry.title),
    );
  }

  async function openAddTaskModal() {
    taskModalMode = "add";
    editingTaskIndex = null;
    editingTaskTitle = "";
    editingTaskDueAt = "";
    taskModalError = "";
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
    editingTaskTitle = localEntries[index].title;
    editingTaskDueAt = localEntries[index].dueAt || "";
    taskModalError = "";
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

  function removeEntry(index: number) {
    activeMenuIndex = null;
    localEntries = localEntries.filter((_, itemIndex) => itemIndex !== index);
    emitSave();
  }

  function generateDeleteCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 4; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    return code;
  }

  function requestDeleteEntry(index: number) {
    activeMenuIndex = null;
    deleteTaskPrompt = {
      index,
      title: localEntries[index].title,
      code: generateDeleteCode(),
    };
    deleteTaskCodeInput = "";
  }

  function cancelDeleteTaskPrompt() {
    deleteTaskPrompt = null;
    deleteTaskCodeInput = "";
  }

  function confirmDeleteTask() {
    if (!deleteTaskPrompt) return;
    if (deleteTaskCodeInput.trim().toUpperCase() !== deleteTaskPrompt.code)
      return;

    const index = deleteTaskPrompt.index;
    cancelDeleteTaskPrompt();
    removeEntry(index);
  }

  function cancelTaskEdit() {
    taskModalMode = null;
    editingTaskIndex = null;
    editingTaskTitle = "";
    editingTaskDueAt = "";
    taskModalError = "";
  }

  function saveTaskEdit() {
    const title = editingTaskTitle.trim();
    if (!title) {
      taskModalError = "Task description is required";
      return;
    }

    taskModalError = "";

    if (taskModalMode === "add") {
      localEntries = [
        ...localEntries,
        {
          title,
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

<div class="todo-editor">
  <div class="editor-header">
    <button class="icon-btn" on:click={() => dispatch("back")} title="Back"
      ><span class="anemona icon-arrow-back"></span></button
    >
    <span class="note-title">{selectedNote.name}</span>
    <button
      class="icon-btn primary-btn"
      on:click={openAddTaskModal}
      title="Add task"><span class="anemona icon-plus"></span></button
    >
  </div>

  {#if localEntries.length === 0}
    <button class="add-entry-btn" on:click={openAddTaskModal}
      ><span class="anemona icon-plus"></span> Add task</button
    >
  {:else}
    <div class="todo-summary">
      <div class="summary-copy">
        <span class="summary-label">Progress</span>
        <strong class="summary-value">{totalProgress}%</strong>
      </div>
      <div class="summary-bar">
        <span class="summary-bar-fill" style={`width:${totalProgress}%`}></span>
      </div>
    </div>

    <div class="editor-toolbar">
      <div class="search-field">
        <span class="search-icon anemona icon-search-alt"></span>
        <input
          class="field toolbar-search"
          type="text"
          placeholder="Search tasks..."
          bind:value={filterText}
        />
      </div>

      <button
        class={`toolbar-priority-btn ${activePriorityFilter}`}
        on:click={cyclePriorityFilter}
        title={priorityFilterTitle}
        aria-label={priorityFilterTitle}
      >
        {priorityFilterLabel}
      </button>
    </div>

    <div class="filter-row">
      <button
        class="filter-chip"
        class:active={activeFilter === "all"}
        on:click={() => (activeFilter = "all")}>All {filterCounts.all}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "open"}
        on:click={() => (activeFilter = "open")}>Open {filterCounts.open}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "done"}
        on:click={() => (activeFilter = "done")}>Done {filterCounts.done}</button
      >
      <button
        class="filter-chip"
        class:active={activeFilter === "cancelled"}
        on:click={() => (activeFilter = "cancelled")}
        >Cancelled {filterCounts.cancelled}</button
      >
    </div>

    {#if movingTaskIndex !== null}
      <div class="move-hint">
        <span>Click another task to move it there</span>
        <button class="text-btn" on:click={cancelMovingTask}>Cancel</button>
      </div>
    {/if}

    <div class="todo-list" bind:this={entriesContainerElem}>
      {#if visibleEntries.length === 0}
        <div class="empty-state">No tasks match the current filters</div>
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
            <div class="todo-main-row">
              <button
                class="check-toggle"
                on:click={() => toggleDone(index)}
                title={entry.status === "done" ? "Mark as open" : "Mark as done"}
              >
                <span
                  class={`anemona ${entry.status === "done" ? "icon-checked" : "icon-checkbox"}`}
                ></span>
              </button>

              <div class="todo-copy">
                <div class="todo-title-text">{entry.title}</div>
                <div class="todo-meta">
                  <span class="todo-progress">{entry.progress}%</span>
                  <span class="todo-status">{getStatusLabel(entry)}</span>
                  <button
                    class={`priority-chip ${entry.priority}`}
                    on:click={() => cyclePriority(index)}
                    title="Change priority">{getPriorityLabel(entry)}</button
                  >
                  {#if entry.dueAt}
                    <span class={`todo-deadline ${getDueTone(entry)}`}
                      >{getRelativeDueLabel(entry)}</span
                    >
                  {/if}
                </div>
              </div>

              <div class="todo-actions">
                <div class="menu-wrap">
                  <button
                    class="icon-btn state-btn"
                    on:click|stopPropagation={() => toggleTaskMenu(index)}
                    title="Task options"
                  >
                    <span class="anemona icon-dots-vertical"></span>
                  </button>
                  {#if activeMenuIndex === index}
                    <div
                      class="menu-popover task-menu"
                      use:smartPopover={{
                        open: activeMenuIndex === index,
                        onClose: closeTaskMenu,
                      }}
                    >
                      <button
                        class="menu-item"
                        on:click|stopPropagation={() => editEntry(index)}
                      >
                        <span class="anemona icon-edit-alt"></span>
                        <span>Edit</span>
                      </button>
                      <button
                        class="menu-item"
                        on:click|stopPropagation={() => startMovingTask(index)}
                      >
                        <span class="anemona icon-arrow-back"></span>
                        <span>Move</span>
                      </button>
                      <button
                        class="menu-item"
                        on:click|stopPropagation={() => cyclePriority(index)}
                      >
                        <span class="anemona icon-slider-alt"></span>
                        <span>Priority: {getPriorityLabel(entry)}</span>
                      </button>
                      <button
                        class="menu-item"
                        class:danger={entry.status !== "cancelled"}
                        on:click|stopPropagation={() => toggleCancelled(index)}
                      >
                        <span class="anemona icon-x"></span>
                        <span
                          >{entry.status === "cancelled"
                            ? "Restore"
                            : "Cancel"}</span
                        >
                      </button>
                      <button
                        class="menu-item danger"
                        on:click|stopPropagation={() => requestDeleteEntry(index)}
                      >
                        <span class="anemona icon-trash-alt"></span>
                        <span>Delete</span>
                      </button>
                    </div>
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
    </div>

    <button class="add-entry-btn" on:click={openAddTaskModal}
      ><span class="anemona icon-plus"></span> Add task</button
    >
  {/if}

  {#if taskModalMode}
    <button
      class="task-modal-backdrop"
      on:click={cancelTaskEdit}
      aria-label="Close task edit"
    ></button>
    <div class="task-modal">
      <h3>{taskModalMode === "add" ? "Add task" : "Edit task"}</h3>
      <textarea
        class="task-modal-input"
        bind:this={taskTitleInput}
        bind:value={editingTaskTitle}
        rows="5"
        placeholder="Task description"
      ></textarea>
      {#if taskModalError}
        <p class="task-modal-error">{taskModalError}</p>
      {/if}
      <input
        class="task-date-input"
        type="datetime-local"
        bind:value={editingTaskDueAt}
      />
      <div class="task-modal-actions">
        <button class="task-btn" on:click={cancelTaskEdit}>Cancel</button>
        <button class="task-btn primary" on:click={saveTaskEdit}
          >{taskModalMode === "add" ? "Add" : "Save"}</button
        >
      </div>
    </div>
  {/if}

  {#if deleteTaskPrompt}
    <button
      class="task-modal-backdrop"
      on:click={cancelDeleteTaskPrompt}
      aria-label="Close task delete confirmation"
    ></button>
    <div class="task-modal">
      <h3>Delete task</h3>
      <p>
        Confirm deletion of <strong>{deleteTaskPrompt.title}</strong> by typing
        <strong>{deleteTaskPrompt.code}</strong>
      </p>
      <input
        class="task-code-input"
        type="text"
        bind:value={deleteTaskCodeInput}
        maxlength="4"
        placeholder="Code"
        on:keydown={(event) => event.key === "Enter" && confirmDeleteTask()}
      />
      <div class="task-modal-actions">
        <button class="task-btn" on:click={cancelDeleteTaskPrompt}
          >Cancel</button
        >
        <button class="task-btn danger" on:click={confirmDeleteTask}
          >Delete</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .todo-editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    padding: 0.26rem;
    box-sizing: border-box;
  }

  .editor-header {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.32rem 0.4rem;
    flex-shrink: 0;
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 14%, var(--ui-border));
    border-radius: var(--ui-radius-md);
    background: transparent;
  }

  .note-title {
    flex: 1;
    font-size: var(--ui-font-title);
    font-weight: 400;
    color: var(--vscode-sideBarTitle-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

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

  .editor-toolbar {
    display: flex;
    align-items: stretch;
    gap: 0.2rem;
    margin-top: 0.22rem;
    margin-bottom: 0;
    flex-shrink: 0;
  }

  .search-field {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    display: flex;
    align-items: stretch;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: var(--ui-search-icon-left);
    transform: translateY(-50%);
    font-size: 0.78em;
    color: var(--vscode-descriptionForeground);
    pointer-events: none;
    z-index: 1;
  }

  .toolbar-search {
    width: 100%;
    min-width: 0;
    height: var(--ui-control-height-sm);
    box-sizing: border-box;
    color: var(--vscode-sideBarTitle-foreground);
    padding-left: var(--ui-search-input-pad-left);
    padding-right: 0.46rem;
    border-radius: 6px;
    font-size: var(--ui-font-control);
    line-height: 1;
    border: 1px solid var(--ui-border-strong);
    background: var(--vscode-input-background);
    box-shadow: none;
  }

  .toolbar-search:focus {
    border-color: var(--ui-border-strong);
    outline: none;
    box-shadow: none;
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

  .filter-chip {
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 10%, var(--ui-border));
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--accent-color) 3%,
      var(--vscode-editor-background)
    );
    color: var(--ui-muted);
    padding: 0.06rem 0.24rem;
    font-size: var(--ui-font-xs);
    font-weight: 400;
    letter-spacing: 0.01em;
    cursor: pointer;
  }

  .filter-chip.active {
    color: var(--vscode-sideBarTitle-foreground);
    border-color: color-mix(in srgb, var(--accent-color) 18%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
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

  .add-entry-btn {
    width: 100%;
    background: color-mix(in srgb, var(--accent-color) 5%, var(--vscode-editor-background));
    border: 1px dashed var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    min-height: var(--ui-control-height);
    padding: 0.26rem 0.38rem;
    font-size: var(--ui-font-control);
    font-weight: 400;
    margin-top: 0.18rem;
    opacity: 0.84;
  }

  .add-entry-btn:hover {
    opacity: 1;
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
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
  .todo-card.done .todo-title-text,
  .todo-card.cancelled .todo-progress,
  .todo-card.cancelled .todo-status,
  .todo-card.cancelled .todo-title-text {
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

  .todo-main-row {
    display: flex;
    align-items: flex-start;
    gap: 0.22rem;
  }

  .check-toggle {
    width: 1.08rem;
    height: 1.08rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: flex-start;
    border: none;
    background: transparent;
    color: color-mix(
      in srgb,
      var(--todo-priority-color) 76%,
      var(--vscode-sideBarTitle-foreground)
    );
    cursor: pointer;
    padding: 0;
    border-radius: 4px;
    flex-shrink: 0;
    transition:
      transform 0.12s ease,
      color 0.12s ease,
      background 0.12s ease;
  }

  .check-toggle:hover {
    color: color-mix(in srgb, var(--todo-priority-color) 90%, white 10%);
    background: color-mix(in srgb, var(--todo-priority-color) 10%, transparent);
  }

  .check-toggle span {
    font-size: 0.76rem;
    line-height: 1;
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
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.08rem;
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

  .todo-title-text {
    width: 100%;
    color: var(--vscode-sideBarTitle-foreground);
    font-size: 0.62rem;
    font-weight: 400;
    line-height: 1.18;
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .todo-card.done .todo-title-text {
    text-decoration: line-through;
    opacity: 0.82;
  }

  .todo-card.cancelled .todo-title-text {
    text-decoration: line-through;
    opacity: 0.58;
  }

  .task-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 30;
  }

  .task-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
  }

  .task-modal h3 {
    margin: 0 0 0.55rem;
    font-size: 0.84rem;
    font-weight: 500;
  }

  .task-modal p {
    margin: 0 0 0.75rem;
    font-size: var(--ui-font-sm);
    line-height: 1.4;
    color: var(--ui-muted);
  }

  .task-modal-error {
    margin: 0.55rem 0 0;
    font-size: var(--ui-font-xs);
    color: #ff8d8d;
  }

  .task-modal-input,
  .task-code-input,
  .task-date-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    font-size: var(--ui-font-control);
    font-family: inherit;
  }

  .task-modal-input {
    resize: vertical;
    min-height: 6.2rem;
    line-height: 1.45;
  }

  .task-date-input {
    margin-top: 0.55rem;
    margin-bottom: 0.8rem;
  }

  .task-code-input {
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
  }

  .task-modal-input:focus,
  .task-code-input:focus,
  .task-date-input:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .task-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .task-btn {
    min-height: var(--ui-control-height-sm);
    padding: 0.22rem 0.46rem;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-sm);
    cursor: pointer;
    font-size: var(--ui-font-control);
    font-weight: 400;
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }

  .task-btn.primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  .task-btn.danger {
    background: #c0392b;
    color: #fff;
  }

  .todo-actions {
    display: flex;
    gap: 0.2rem;
  }

  .menu-wrap {
    position: relative;
  }

  .menu-popover {
    position: absolute;
    top: calc(100% + 0.16rem);
    bottom: auto;
    left: auto;
    right: 0;
    min-width: 7.2rem;
    max-width: min(var(--popover-max-width, 20rem), calc(100vw - 1rem));
    max-height: var(--popover-max-height, 24rem);
    overflow-y: auto;
    background: color-mix(
      in srgb,
      var(--accent-color) 7%,
      var(--vscode-editor-background)
    );
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-md);
    box-shadow: var(--ui-shadow);
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

  .menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.34rem;
    border: none;
    background: transparent;
    color: var(--vscode-foreground);
    border-radius: 5px;
    padding: var(--ui-menu-pad-y) var(--ui-menu-pad-x);
    cursor: pointer;
    font-size: var(--ui-menu-font);
    text-align: left;
  }

  .menu-item:hover {
    background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  }

  .menu-item.danger {
    color: #e87070;
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

  .icon-btn {
    background: color-mix(
      in srgb,
      var(--vscode-sideBar-background) 95%,
      white 5%
    );
    border: 1px solid
      color-mix(in srgb, var(--accent-color) 10%, var(--ui-border));
    color: var(--vscode-sideBarTitle-foreground);
    cursor: pointer;
    font-size: 0.72em;
    width: var(--ui-icon-btn-size);
    height: var(--ui-icon-btn-size);
    border-radius: 5px;
    padding: 0;
    line-height: 1;
    opacity: 0.92;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    opacity: 1;
    color: var(--vscode-textLink-foreground);
    background: color-mix(in srgb, var(--accent-color) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent-color) 16%, transparent);
  }

  .primary-btn {
    color: #f4fbff;
    border-color: color-mix(in srgb, var(--accent-color) 22%, transparent);
    background: color-mix(
      in srgb,
      var(--accent-color) 14%,
      var(--vscode-sideBar-background)
    );
    box-shadow: none;
    text-shadow: none;
  }

  .primary-btn:hover {
    color: white;
    background: color-mix(
      in srgb,
      var(--accent-color) 20%,
      var(--vscode-sideBar-background)
    );
    border-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
  }

  .primary-btn span {
    font-size: 0.88rem;
    font-weight: 500;
  }

  .state-btn.active {
    color: #e17076;
    border-color: color-mix(in srgb, #e17076 24%, transparent);
    background: color-mix(in srgb, #e17076 10%, transparent);
  }
</style>
