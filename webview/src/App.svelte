<script lang="ts">
  import { onDestroy } from "svelte";
  import { t, currentLocale, initLocale } from "./i18n";
  import "./lib/editor.css";
  import CategoryTabs from "./components/CategoryTabs.svelte";
  import NotesList from "./components/NotesList.svelte";
  import NoteEditor from "./components/NoteEditor.svelte";
  import KeyEditor from "./components/KeyEditor.svelte";
  import CommandEditor from "./components/CommandEditor.svelte";
  import TodoEditor from "./components/TodoEditor.svelte";
  import SnippetEditor from "./components/SnippetEditor.svelte";
  import ReminderEditor from "./components/ReminderEditor.svelte";
  import SearchPanel from "./components/SearchPanel.svelte";
  import NotificationPanel from "./components/NotificationPanel.svelte";
  import DeleteConfirmModal from "./lib/DeleteConfirmModal.svelte";

  declare function acquireVsCodeApi(): {
    postMessage(message: Record<string, unknown>): void;
    getState(): Record<string, unknown> | undefined;
    setState(state: Record<string, unknown>): void;
  };

  const vscode = acquireVsCodeApi();
  const savedState = vscode.getState() || {};
  currentLocale.set(savedState.locale || "en");

  let categories: {
    name: string;
    path: string;
    config?: { color?: string; icon?: string };
    canDelete?: boolean;
  }[] = [];
  let selectedCategory = "";
  let notes: {
    name: string;
    filePath: string;
    fileType?: string;
    displayName?: string;
    icon?: string;
    progress?: number;
  }[] = [];
  let folders: {
    name: string;
    path: string;
    color?: string;
    isEmpty?: boolean;
  }[] = [];
  let currentFolderPath = "";
  let parentFolderPath: string | null = null;
  let folderBreadcrumb: string[] = [];
  let selectedNote: {
    name: string;
    filePath: string;
    fileType?: string;
  } | null = null;
  let noteContent = "";
  let needsStoragePath = false;
  let recentFolders: {
    path: string;
    name: string;
    icon?: string;
    lastOpened: string;
  }[] = [];
  let reloading = true;
  let reloadTimer: ReturnType<typeof setTimeout> | null = null;
  let tabsCollapsed = Boolean(savedState.tabsCollapsed);
  let activeSection: "notes" | "search" | "notifications" =
    savedState.activeSection === "search"
      ? "search"
      : savedState.activeSection === "notifications"
        ? "notifications"
        : "notes";

  let notificationList: any[] = [];
  let notificationHistory: any[] = [];
  let historyIndex: {
    version: number;
    pageSize: number;
    currentPage: number;
    totalPages: number;
    totalNotifications: number;
  } | null = null;
  let historyLoadedPages = new Set<number>();
  let historyLoading = false;
  let notificationTab: "inbox" | "history" =
    savedState.notificationTab === "history" ? "history" : "inbox";

  let keyEntries: {
    title: string;
    password: string;
    note?: string;
    url?: string;
    email?: string;
    username?: string;
    host?: string;
    port?: string;
  }[] = [];
  let keyLocked = false;
  let commandEntries: { title: string; command: string }[] = [];
  let todoEntries: {
    title: string;
    progress: number;
    status: "open" | "done" | "cancelled";
    priority: "low" | "medium" | "high";
    dueAt?: string;
  }[] = [];
  let snippetEntries: { title: string; language: string; code: string }[] = [];
  let reminderEntries: {
    id: string;
    text: string;
    dueAt: string;
    status: "pending" | "completed";
    action: {
      type: "none" | "file" | "url" | "command" | "task";
      target: string;
    };
    createdAt: string;
    updatedAt: string;
  }[] = [];
  let globalSearchQuery = "";
  let globalSearchLoading = false;
  let globalSearchResults: {
    category: string;
    noteName: string;
    filePath: string;
    fileType: "md" | "key" | "command" | "todo" | "snippet";
    displayName: string;
    matchLabel: string;
    snippet: string;
  }[] = [];
  let pendingGlobalFilter: {
    filePath: string;
    query: string;
    fileType: string;
  } | null = null;
  let pendingNotificationFilter = '';
  let currentFileType: string = "md";
  let effectiveConfig: {
    color?: string;
    icon?: string;
    file?: Record<string, { progress?: number }>;
  } = {};
  let errorMessage = "";
  let errorTimer: ReturnType<typeof setTimeout> | null = null;
  let successMessage = "";
  let successTimer: ReturnType<typeof setTimeout> | null = null;
  let deletePrompt:
    | {
        type: "note";
        label: string;
        note: { name: string; filePath: string };
      }
    | { type: "category"; label: string; category: string }
    | {
        type: "folder";
        label: string;
        folder: { name: string; path: string };
      }
    | null = null;
  let renamePrompt:
    | {
        type: "note";
        label: string;
        value: string;
        note: { name: string; filePath: string };
      }
    | { type: "category"; label: string; value: string; category: string }
    | null = null;
  let renameInput = "";
  let movePrompt: {
    item: { name: string; path: string };
    isFolder: boolean;
  } | null = null;
  let selectedMoveCategory = "";
  let moveFolderTree: {
    name: string;
    path: string;
    children: { name: string; path: string; children: any[] }[];
  }[] = [];
  let selectedMoveFolder = "";
  let exportPrompt: {
    note: { name: string; filePath: string; fileType?: string };
    formats: { label: string; value: string }[];
  } | null = null;
  let selectedExportFormat = "";
  let selectionSuggestion: {
    title?: string;
    type?: string;
    text?: string;
    languageId?: string;
    requestId?: number;
  } | null = null;
  let selectionCheckSeed = 0;
  let pendingNoteRestore: {
    name: string;
    path: string;
    fileType?: string;
  } | null = null;

  const NOTIF_POLL_MS = 5000;
  const notifPollTimer = setInterval(() => {
    vscode.postMessage({ command: "getNotifications" });
  }, NOTIF_POLL_MS);

  onDestroy(() => {
    clearInterval(notifPollTimer);
  });

  function focus(node: HTMLInputElement) {
    node.focus();
    return {};
  }

  function resolveAccentColor(color?: string): string {
    switch (color) {
      case "vscode-default":
        return "var(--vscode-sideBarTitle-foreground)";
      case "vscode-muted":
        return "color-mix(in srgb, var(--vscode-sideBarTitle-foreground) 76%, transparent)";
      case "vscode-soft":
        return "var(--vscode-editor-background)";
      default:
        return color || "var(--vscode-textLink-foreground)";
    }
  }

  function handleMessage(event: MessageEvent) {
    const message = event.data;

    switch (message.command) {
      case "setLocale":
        currentLocale.set(String(message.locale || "en"));
        persistUiState();
        break;

      case "activateSearch":
        handleOpenSearch();
        break;

      case "activateNotifications":
        handleOpenNotifications();
        break;

      case "activateNotes":
        activeSection = "notes";
        selectedCategory = String(message.category || selectedCategory || "");
        selectedNote = null;
        noteContent = "";
        keyEntries = [];
        commandEntries = [];
        todoEntries = [];
        snippetEntries = [];
        reminderEntries = [];
        currentFolderPath = String(message.folderPath || "");
        parentFolderPath = currentFolderPath
          ? currentFolderPath.split("/").slice(0, -1).join("/") || null
          : null;
        folderBreadcrumb = currentFolderPath
          ? currentFolderPath.split("/")
          : [];
        break;

      case "beginReload":
        reloading = true;
        break;

      case "storagePathRequired":
        needsStoragePath = true;
        recentFolders = message.recentFolders || [];
        reloading = false;
        break;

      case "recentFolders":
        recentFolders = message.recentFolders || [];
        break;

      case "categoriesLoaded":
        categories = message.categories;
        needsStoragePath = false;
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloading = false;
        }, 300);
        {
          const saved = vscode.getState();
          const savedCategory = saved?.selectedCategory;
          const savedFolder = saved?.currentFolderPath || "";

          if (
            savedCategory &&
            categories.some((c) => c.name === savedCategory)
          ) {
            selectedCategory = savedCategory;
            currentFolderPath = savedFolder;
            parentFolderPath = savedFolder
              ? savedFolder.split("/").slice(0, -1).join("/") || null
              : null;
            folderBreadcrumb = savedFolder ? savedFolder.split("/") : [];
            vscode.postMessage({
              command: "selectCategory",
              category: savedCategory,
              folderPath: savedFolder,
            });

            if (
              saved?.activeSection !== "notifications" &&
              saved?.activeSection !== "search" &&
              saved?.selectedNotePath &&
              saved?.selectedNoteName
            ) {
              pendingNoteRestore = {
                name: saved.selectedNoteName,
                path: saved.selectedNotePath,
                fileType: saved.selectedNoteFileType || undefined,
              };
            }
          } else {
            if (
              selectedCategory &&
              !categories.some((c) => c.name === selectedCategory)
            ) {
              selectedCategory = "";
              selectedNote = null;
              noteContent = "";
              keyEntries = [];
              commandEntries = [];
              todoEntries = [];
              notes = [];
            }
            if (categories.length > 0 && !selectedCategory) {
              selectedCategory = categories[0].name;
              vscode.postMessage({
                command: "selectCategory",
                category: selectedCategory,
              });
            }
          }
        }

        if (activeSection === "notifications") {
          vscode.postMessage({ command: "getNotifications" });
        }
        break;

      case "notesLoaded":
        notes = message.notes;
        folders = message.folders || [];
        currentFolderPath = String(message.currentFolder || "");
        parentFolderPath = message.parentFolder || null;
        folderBreadcrumb = currentFolderPath
          ? currentFolderPath.split("/")
          : [];
        effectiveConfig = message.effectiveConfig || {};
        persistUiState();
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          reloading = false;
        }, 300);
        if (pendingNoteRestore) {
          const match = notes.find(
            (n) =>
              n.filePath === pendingNoteRestore.path ||
              n.name === pendingNoteRestore.name,
          );
          if (match && !selectedNote && activeSection === "notes") {
            handleSelectNote(match);
          }
          pendingNoteRestore = null;
        }
        break;

      case "noteContent":
        selectedNote = {
          name: message.note.name,
          filePath: message.note.filePath,
          fileType: message.fileType,
        };
        currentFileType = message.fileType;
        effectiveConfig = message.effectiveConfig || {};
        persistUiState();
        if (message.fileType === "key") {
          keyEntries = message.entries || [];
          keyLocked = message.locked || false;
          noteContent = "";
          commandEntries = [];
          todoEntries = [];
          snippetEntries = [];
          reminderEntries = [];
        } else if (message.fileType === "command") {
          commandEntries = message.entries || [];
          noteContent = "";
          keyEntries = [];
          todoEntries = [];
          snippetEntries = [];
          reminderEntries = [];
        } else if (message.fileType === "todo") {
          todoEntries = message.entries || [];
          noteContent = "";
          keyEntries = [];
          commandEntries = [];
          snippetEntries = [];
          reminderEntries = [];
        } else if (message.fileType === "snippet") {
          snippetEntries = message.entries || [];
          noteContent = "";
          keyEntries = [];
          commandEntries = [];
          todoEntries = [];
          reminderEntries = [];
        } else if (message.fileType === "reminder") {
          reminderEntries = message.entries || [];
          noteContent = "";
          keyEntries = [];
          commandEntries = [];
          todoEntries = [];
          snippetEntries = [];
        } else {
          noteContent = message.content || "";
          keyEntries = [];
          commandEntries = [];
          todoEntries = [];
          snippetEntries = [];
          reminderEntries = [];
        }
        break;

      case "globalSearchResults":
        globalSearchLoading = false;
        globalSearchQuery = String(message.query || "");
        globalSearchResults = message.results || [];
        break;

      case "noteCreated":
      case "noteSaved":
      case "noteDeleted":
        break;

      case "noteRenamed":
        if (selectedNote && selectedNote.filePath === message.notePath) {
          const newName =
            String(message.newPath).split(/[/\\]/).pop() || selectedNote.name;
          selectedNote = {
            ...selectedNote,
            name: newName,
            filePath: message.newPath,
          };
        }
        break;

      case "noteMoved":
        if (selectedNote && selectedNote.filePath === message.notePath) {
          selectedNote = null;
        }
        break;

      case "categoryRenamed":
        if (selectedCategory === message.category) {
          selectedCategory = String(message.newName);
        }
        selectedNote = null;
        noteContent = "";
        keyEntries = [];
        commandEntries = [];
        todoEntries = [];
        snippetEntries = [];
        reminderEntries = [];
        break;

      case "categoryDeleted":
        selectedNote = null;
        noteContent = "";
        keyEntries = [];
        commandEntries = [];
        todoEntries = [];
        snippetEntries = [];
        reminderEntries = [];
        break;

      case "selectionAnalysis": {
        const requestId = Number(message.requestId || 0);
        if (requestId !== selectionCheckSeed) break;
        selectionSuggestion = message.suggestion
          ? {
              title: String(message.suggestion.title || ""),
              type: String(message.suggestion.type || ""),
              text: String(message.suggestion.text || ""),
              languageId: String(message.suggestion.languageId || ""),
              requestId,
            }
          : null;
        break;
      }

      case "folderTree":
        moveFolderTree = message.tree || [];
        break;

      case "folderDeleted":
      case "folderMoved":
        break;

      case "notificationsLoaded":
        notificationList = message.notifications || [];
        notificationHistory = message.history || [];
        historyIndex = message.historyIndex || null;
        historyLoadedPages = new Set<number>();
        if (historyIndex?.currentPage) {
          historyLoadedPages.add(historyIndex.currentPage);
        }
        break;

      case "historyPageLoaded":
        if (!historyLoading) break;
        historyLoading = false;
        {
          const page = Number(message.page) || 0;
          const items: any[] = message.items || [];
          historyLoadedPages.add(page);
          const existingIds = new Set(
            notificationHistory.map((n: any) => n.id),
          );
          const newItems = items.filter((n: any) => !existingIds.has(n.id));
          notificationHistory = [...notificationHistory, ...newItems];
        }
        break;

      case "contentImported":
        if (successTimer) clearTimeout(successTimer);
        successMessage = $t("app.contentImported");
        successTimer = setTimeout(() => {
          successMessage = "";
        }, 4000);
        break;

      case "error":
        console.error(message.message);
        errorMessage = String(message.message);
        if (errorTimer) clearTimeout(errorTimer);
        errorTimer = setTimeout(() => {
          errorMessage = "";
        }, 5000);
        break;
    }
  }

  function handleLoadMoreHistory() {
    if (!historyIndex || historyLoading) return;
    const minLoaded = Math.min(...historyLoadedPages);
    const nextPage = minLoaded - 1;
    if (nextPage < 1) return;
    historyLoading = true;
    vscode.postMessage({ command: "loadHistoryPage", page: nextPage });
  }

  function handleOpenNotifications() {
    activeSection = "notifications";
    selectedNote = null;
    noteContent = "";
    keyEntries = [];
    commandEntries = [];
    todoEntries = [];
    snippetEntries = [];
    reminderEntries = [];
    persistUiState();
    vscode.postMessage({ command: "getNotifications" });
  }

  function handleCloseNotifications() {
    activeSection = "notes";
    persistUiState();
  }

  function handleReadNotification(id: string) {
    vscode.postMessage({ command: "markNotificationRead", id });
  }

  function handleUnreadNotification(id: string) {
    vscode.postMessage({ command: "unreadNotification", id });
  }

  function handleDeleteNotification(id: string) {
    vscode.postMessage({ command: "deleteHistoryNotification", id });
  }

  function handleOpenNotification(id: string) {
    pendingNotificationFilter = ''
    const all = [...notificationList, ...notificationHistory]
    const n = all.find(n => n.id === id)
    if (n?.title) {
      pendingNotificationFilter = n.title
    }
    vscode.postMessage({ command: "openNotification", id });
  }

  function handleSelectCategory(category: string) {
    activeSection = "notes";
    pendingGlobalFilter = null;
    selectedCategory = category;
    selectedNote = null;
    noteContent = "";
    keyEntries = [];
    commandEntries = [];
    todoEntries = [];
    snippetEntries = [];
    reminderEntries = [];
    currentFolderPath = "";
    parentFolderPath = null;
    folderBreadcrumb = [];
    folders = [];
    effectiveConfig = {};
    persistUiState();
    vscode.postMessage({ command: "selectCategory", category, folderPath: "" });
  }

  function handleSelectNote(note: { name: string; filePath: string }) {
    activeSection = "notes";
    pendingGlobalFilter = null;
    pendingNotificationFilter = '';
    selectedNote = { name: note.name, filePath: note.filePath };
    persistUiState();
    vscode.postMessage({
      command: "selectNote",
      category: selectedCategory,
      note: note.name,
    });
  }

  function handleOpenSearch() {
    activeSection = "search";
    selectedNote = null;
    noteContent = "";
    keyEntries = [];
    commandEntries = [];
    todoEntries = [];
    snippetEntries = [];
    reminderEntries = [];
    persistUiState();
  }

  function handleCloseSearch() {
    activeSection = "notes";
    persistUiState();
  }

  function handleToggleTabs() {
    tabsCollapsed = !tabsCollapsed;
    persistUiState();
  }

  function handleOpenFolder(folder: { name: string; path: string }) {
    const relativePath = currentFolderPath
      ? currentFolderPath + "/" + folder.name
      : folder.name;
    selectedNote = null;
    currentFolderPath = relativePath;
    parentFolderPath = relativePath.split("/").slice(0, -1).join("/") || null;
    folderBreadcrumb = relativePath.split("/");
    persistUiState();
    vscode.postMessage({
      command: "openFolder",
      category: selectedCategory,
      folderPath: relativePath,
    });
  }

  function handleFolderBack() {
    if (parentFolderPath !== null) {
      const path = parentFolderPath || "";
      selectedNote = null;
      currentFolderPath = path;
      parentFolderPath = path
        ? path.split("/").slice(0, -1).join("/") || null
        : null;
      folderBreadcrumb = path ? path.split("/") : [];
      persistUiState();
      vscode.postMessage({
        command: "openFolder",
        category: selectedCategory,
        folderPath: path,
      });
    }
  }

  function handleBreadcrumbClick(index: number) {
    const path = folderBreadcrumb.slice(0, index + 1).join("/");
    selectedNote = null;
    currentFolderPath = path;
    parentFolderPath = path
      ? path.split("/").slice(0, -1).join("/") || null
      : null;
    folderBreadcrumb = path ? path.split("/") : [];
    persistUiState();
    vscode.postMessage({
      command: "openFolder",
      category: selectedCategory,
      folderPath: path || "",
    });
  }

  function handleCreateFolder(name: string) {
    if (!selectedCategory) return;
    const parentPath = currentFolderPath
      ? (categories.find((c) => c.name === selectedCategory)?.path || "") +
        "/" +
        currentFolderPath
      : categories.find((c) => c.name === selectedCategory)?.path || "";
    vscode.postMessage({ command: "createFolder", parentPath, name });
  }

  function handleDeleteFolder(folder: { name: string; path: string }) {
    deletePrompt = {
      type: "folder",
      label: folder.name,
      folder,
    };
  }

  function handleRenameFolder(
    folder: { name: string; path: string },
    newName: string,
  ) {
    vscode.postMessage({
      command: "renameFolder",
      folderPath: folder.path,
      name: newName,
    });
  }

  function handleMoveFolder(item: { name: string; path: string }) {
    vscode.postMessage({
      command: "moveFolder",
      sourcePath: item.path,
      targetDir: item.path,
    });
  }

  function handleUpdateFolderColor(
    folder: { name: string; path: string },
    color: string,
  ) {
    vscode.postMessage({
      command: "updateFolderColor",
      folderPath: folder.path,
      color,
    });
  }

  function handleDropItem(data: { sourcePath: string; targetPath: string }) {
    vscode.postMessage({
      command: "dropItem",
      sourcePath: data.sourcePath,
      targetPath: data.targetPath,
    });
  }

  function handleRequestSelectionCheck() {
    selectionCheckSeed++;
    const requestId = selectionCheckSeed;
    selectionSuggestion = { requestId };
    vscode.postMessage({ command: "checkSelection", requestId });
    return requestId;
  }

  function handleSearchGlobal(event: CustomEvent<string>) {
    const query = event.detail;
    globalSearchQuery = query;

    if (!query.trim()) {
      globalSearchLoading = false;
      globalSearchResults = [];
      return;
    }

    globalSearchLoading = true;
    vscode.postMessage({ command: "searchGlobal", query });
  }

  function handleOpenSearchResult(
    event: CustomEvent<(typeof globalSearchResults)[number]>,
  ) {
    const result = event.detail;
    const categoryPath =
      categories.find((c) => c.name === result.category)?.path || "";
    const fileDir = result.filePath.substring(
      0,
      result.filePath.lastIndexOf("/"),
    );
    const relativeFolder =
      fileDir.startsWith(categoryPath) && fileDir.length > categoryPath.length
        ? fileDir.substring(categoryPath.length + 1)
        : "";

    activeSection = "notes";
    selectedCategory = result.category;
    selectedNote = null;
    noteContent = "";
    keyEntries = [];
    commandEntries = [];
    todoEntries = [];
    snippetEntries = [];
    reminderEntries = [];
    currentFolderPath = relativeFolder;
    parentFolderPath = relativeFolder
      ? relativeFolder.split("/").slice(0, -1).join("/") || ""
      : null;
    folderBreadcrumb = relativeFolder ? relativeFolder.split("/") : [];
    folders = [];
    pendingGlobalFilter = {
      filePath: result.filePath,
      query: globalSearchQuery,
      fileType: result.fileType,
    };
    persistUiState();
    vscode.postMessage({
      command: "selectCategory",
      category: result.category,
      folderPath: relativeFolder,
    });
    vscode.postMessage({
      command: "selectNote",
      category: result.category,
      note: result.noteName,
    });
  }

  function handleOpenRecentFolder(folderPath: string) {
    vscode.postMessage({ command: "openRecentFolder", folderPath });
  }

  function handleCreateNote(title: string, type: string = "md") {
    if (!selectedCategory) return;
    if (type === "folder") {
      handleCreateFolder(title);
      return;
    }
    vscode.postMessage({
      command: "createNote",
      category: selectedCategory,
      title,
      fileType: type,
      folderPath: currentFolderPath,
    });
  }

  function handleSaveNote(content: string) {
    if (!selectedNote) return;
    noteContent = content;
    vscode.postMessage({
      command: "saveNote",
      notePath: selectedNote.filePath,
      content,
    });
  }

  function handleDeleteNote(note: { name: string; filePath: string }) {
    deletePrompt = {
      type: "note",
      label: note.name,
      note,
    };
  }

  function handleDeleteCategory(category: string) {
    deletePrompt = {
      type: "category",
      label: category,
      category,
    };
  }

  function handleRenameNote(note: { name: string; filePath: string }) {
    renamePrompt = {
      type: "note",
      label: note.name,
      value: getBaseName(note.name),
      note,
    };
    renameInput = getBaseName(note.name);
  }

  function handleMoveNote(note: { name: string; filePath: string }) {
    selectedMoveCategory =
      categories.find((c) => c.name !== selectedCategory)?.name || "";
    selectedMoveFolder = "";
    moveFolderTree = [];
    movePrompt = {
      item: { name: note.name, path: note.filePath },
      isFolder: false,
    };
    if (selectedMoveCategory) {
      vscode.postMessage({
        command: "getFolderTree",
        categoryName: selectedMoveCategory,
      });
    }
  }

  function handleMoveFolderTrigger(folder: { name: string; path: string }) {
    selectedMoveCategory = selectedCategory;
    selectedMoveFolder = "";
    moveFolderTree = [];
    movePrompt = {
      item: { name: folder.name, path: folder.path },
      isFolder: true,
    };
    vscode.postMessage({
      command: "getFolderTree",
      categoryName: selectedCategory,
    });
  }

  function handleMoveCategoryChange() {
    selectedMoveFolder = "";
    moveFolderTree = [];
    if (selectedMoveCategory) {
      vscode.postMessage({
        command: "getFolderTree",
        categoryName: selectedMoveCategory,
      });
    }
  }

  function handleImport(note: { name: string; filePath: string }) {
    vscode.postMessage({ command: "importContent", notePath: note.filePath });
  }

  function handleExportNote(note: {
    name: string;
    filePath: string;
    fileType?: string;
  }) {
    const fileType = note.fileType || "md";
    let formats: { label: string; value: string }[];
    if (fileType === "key") {
      formats = [
        { label: $t("app.exportDefaultEncrypted"), value: "default" },
        { label: $t("app.exportDecrypted"), value: "en-claro" },
      ];
    } else if (fileType === "command") {
      formats = [
        { label: $t("app.exportDefaultJson"), value: "default" },
        { label: $t("app.exportText"), value: "texto" },
        { label: $t("app.exportMarkdown"), value: "markdown" },
      ];
    } else if (fileType === "todo") {
      formats = [
        { label: $t("app.exportDefaultJson"), value: "default" },
        { label: $t("app.exportText"), value: "texto" },
        { label: $t("app.exportMarkdown"), value: "markdown" },
      ];
    } else if (fileType === "snippet") {
      formats = [
        { label: $t("app.exportDefaultJson"), value: "default" },
        { label: $t("app.exportText"), value: "texto" },
        { label: $t("app.exportMarkdown"), value: "markdown" },
      ];
    } else if (fileType === "reminder") {
      formats = [
        { label: $t("app.exportDefaultJson"), value: "default" },
        { label: $t("app.exportText"), value: "texto" },
        { label: $t("app.exportMarkdown"), value: "markdown" },
      ];
    } else {
      formats = [{ label: $t("app.exportDefaultMarkdown"), value: "default" }];
    }
    selectedExportFormat = formats[0].value;
    exportPrompt = { note, formats };
  }

  function handleRenameCategory(category: string) {
    renamePrompt = {
      type: "category",
      label: category,
      value: category,
      category,
    };
    renameInput = category;
  }

  function handleBack() {
    selectedNote = null;
    noteContent = "";
    keyEntries = [];
    commandEntries = [];
    todoEntries = [];
    snippetEntries = [];
    reminderEntries = [];
    pendingGlobalFilter = null;
    persistUiState();
  }

  function confirmMoveNote() {
    if (!movePrompt || !selectedMoveCategory) return;
    if (movePrompt.isFolder) {
      const targetDir = selectedMoveFolder
        ? (categories.find((c) => c.name === selectedMoveCategory)?.path ||
            "") +
          "/" +
          selectedMoveFolder
        : categories.find((c) => c.name === selectedMoveCategory)?.path || "";
      vscode.postMessage({
        command: "moveFolder",
        sourcePath: movePrompt.item.path,
        targetDir,
      });
    } else {
      vscode.postMessage({
        command: "moveNote",
        notePath: movePrompt.item.path,
        targetCategory: selectedMoveCategory,
        targetFolderPath: selectedMoveFolder || undefined,
      });
    }
    movePrompt = null;
  }

  function cancelMovePrompt() {
    movePrompt = null;
    moveFolderTree = [];
  }

  function confirmExportNote() {
    if (!exportPrompt || !selectedExportFormat) return;
    vscode.postMessage({
      command: "exportNote",
      notePath: exportPrompt.note.filePath,
      format: selectedExportFormat,
    });
    exportPrompt = null;
  }

  function cancelExportPrompt() {
    exportPrompt = null;
  }

  function handleSelectFolder() {
    vscode.postMessage({ command: "selectStorageFolder" });
  }

  function handleRefresh() {
    if (reloading) return;
    reloading = true;
    vscode.postMessage({ command: "refresh" });
  }

  function persistUiState() {
    let locale = "en";
    currentLocale.subscribe((v) => (locale = v))();
    vscode.setState({
      tabsCollapsed,
      activeSection,
      notificationTab,
      selectedCategory,
      currentFolderPath,
      selectedNotePath: selectedNote?.filePath || null,
      selectedNoteName: selectedNote?.name || null,
      selectedNoteFileType: selectedNote?.fileType || null,
      locale,
    });
  }

  function handleCreateCategory(name: string) {
    vscode.postMessage({ command: "createCategory", name });
  }

  function handleUpdateCategoryColor(category: string, color: string) {
    vscode.postMessage({ command: "updateCategoryColor", category, color });
  }

  function handleKeySave(
    event: CustomEvent<{ entries: typeof keyEntries; locked: boolean }>,
  ) {
    if (!selectedNote) return;
    keyEntries = event.detail.entries;
    keyLocked = event.detail.locked;
    vscode.postMessage({
      command: "saveKeyEntries",
      notePath: selectedNote.filePath,
      entries: event.detail.entries,
      locked: event.detail.locked,
    });
  }

  function handleCommandSave(event: CustomEvent<typeof commandEntries>) {
    if (!selectedNote) return;
    commandEntries = event.detail;
    vscode.postMessage({
      command: "saveCommandEntries",
      notePath: selectedNote.filePath,
      entries: event.detail,
    });
  }

  function handleTodoSave(event: CustomEvent<typeof todoEntries>) {
    if (!selectedNote) return;
    todoEntries = event.detail;
    vscode.postMessage({
      command: "saveTodoEntries",
      notePath: selectedNote.filePath,
      entries: event.detail,
    });
  }

  function handleSnippetSave(event: CustomEvent<typeof snippetEntries>) {
    if (!selectedNote) return;
    snippetEntries = event.detail;
    vscode.postMessage({
      command: "saveSnippetEntries",
      notePath: selectedNote.filePath,
      entries: event.detail,
    });
  }

  function handleReminderSave(event: CustomEvent<typeof reminderEntries>) {
    if (!selectedNote) return;
    reminderEntries = event.detail;
    vscode.postMessage({
      command: "saveReminderEntries",
      notePath: selectedNote.filePath,
      entries: event.detail,
    });
  }

  function handleUnlock(event: CustomEvent<string>) {
    vscode.postMessage({ command: "unlockVault", password: event.detail });
  }

  function handleLock(event: CustomEvent<string>) {
    vscode.postMessage({ command: "lockVault", password: event.detail });
  }

  function handleOpenExternal(
    event: CustomEvent<{ type: string; value: string }>,
  ) {
    vscode.postMessage({ command: "openExternal", ...event.detail });
  }

  function handleInsertIntoEditor(event: CustomEvent<string>) {
    vscode.postMessage({ command: "insertIntoEditor", text: event.detail });
  }

  function handleReady() {
    vscode.postMessage({ command: "ready" });
  }

  function getBaseName(name: string): string {
    return name
      .replace(/\.anemona-lock$/, "")
      .replace(/\.anemona-key$/, "")
      .replace(/\.anemona-command$/, "")
      .replace(/\.anemona-todo$/, "")
      .replace(/\.anemona-snippet$/, "")
      .replace(/\.anemona-reminder$/, "")
      .replace(/\.md$/, "");
  }

  function cancelRenamePrompt() {
    renamePrompt = null;
    renameInput = "";
  }

  function confirmRenamePrompt() {
    const value = renameInput.trim();
    if (!renamePrompt || !value) {
      errorMessage = $t("app.nameRequired");
      if (errorTimer) clearTimeout(errorTimer);
      errorTimer = setTimeout(() => {
        errorMessage = "";
      }, 5000);
      return;
    }

    if (renamePrompt.type === "note") {
      vscode.postMessage({
        command: "renameNote",
        notePath: renamePrompt.note.filePath,
        title: value,
      });
    } else {
      vscode.postMessage({
        command: "renameCategory",
        category: renamePrompt.category,
        name: value,
      });
    }

    cancelRenamePrompt();
  }

  function confirmDeletePrompt() {
    if (!deletePrompt) return;

    if (deletePrompt.type === "note") {
      vscode.postMessage({
        command: "deleteNote",
        notePath: deletePrompt.note.filePath,
      });
    } else if (deletePrompt.type === "folder") {
      vscode.postMessage({
        command: "deleteFolder",
        folderPath: deletePrompt.folder.path,
      });
    } else {
      vscode.postMessage({
        command: "deleteCategory",
        category: deletePrompt.category,
      });
    }

    deletePrompt = null;
  }

  function cancelDeletePrompt() {
    deletePrompt = null;
  }

  $: deletePromptTitle = deletePrompt
    ? $t("app.deleteModalTitle", {
        type:
          deletePrompt.type === "note"
            ? $t("app.typeFile")
            : deletePrompt.type === "folder"
              ? $t("app.typeFolder")
              : $t("app.typeCategory"),
      })
    : "";

  window.addEventListener("message", handleMessage);

  import { onMount } from "svelte";
  onMount(() => {
    handleReady();
  });

  $: selectedColorRaw =
    effectiveConfig.color ||
    categories.find((c) => c.name === selectedCategory)?.config?.color ||
    "";
  $: selectedColor = resolveAccentColor(selectedColorRaw);
  $: selectedCategoryCanDelete =
    categories.find((c) => c.name === selectedCategory)?.canDelete === true;
  $: categoryPath =
    categories.find((c) => c.name === selectedCategory)?.path || "";
  $: selectedCategoryConfig =
    categories.find((c) => c.name === selectedCategory)?.config || {};
  $: activeEditorSearchText =
    selectedNote && pendingGlobalFilter?.filePath === selectedNote.filePath
      ? pendingGlobalFilter.query
      : pendingNotificationFilter;
</script>

<main>
  {#if needsStoragePath}
    {#if recentFolders.length > 0}
      <div class="recent-folders">
        <h2 class="recent-title">{$t("app.recentTitle")}</h2>
        <div class="recent-grid">
          {#each recentFolders as folder}
            <button
              class="recent-card"
              on:click={() => handleOpenRecentFolder(folder.path)}
            >
              <span
                class="recent-icon anemona {folder.icon
                  ? folder.icon
                  : 'icon-folder'}"
              ></span>
              <span class="recent-name">{folder.name}</span>
            </button>
          {/each}
        </div>
        <div class="recent-footer">
          <button class="btn" on:click={handleSelectFolder}
            >{$t("app.browseOther")}</button
          >
        </div>
      </div>
    {:else}
      <div class="setup">
        <p>{$t("app.setupTitle")}</p>
        <button class="btn primary" on:click={handleSelectFolder}
          >{$t("app.setupButton")}</button
        >
      </div>
    {/if}
  {:else}
    <div class="layout">
      <CategoryTabs
        {categories}
        {selectedCategory}
        collapsed={tabsCollapsed}
        onSelect={handleSelectCategory}
        onCreateCategory={handleCreateCategory}
        onRenameCategory={handleRenameCategory}
        onToggleCollapse={handleToggleTabs}
        notificationCount={notificationList.length}
        onShowNotifications={handleOpenNotifications}
      />
      {#if errorMessage}
        <div class="error-toast">{errorMessage}</div>
      {/if}
      {#if successMessage}
        <div class="success-toast">{successMessage}</div>
      {/if}
      <div class="content" style={`--accent-color: ${selectedColor};`}>
        {#if categories.length === 0}
          <div class="empty-content"><p>{$t("app.emptyCategories")}</p></div>
        {:else if activeSection === "search" && !selectedNote}
          <SearchPanel
            query={globalSearchQuery}
            loading={globalSearchLoading}
            results={globalSearchResults}
            on:close={handleCloseSearch}
            on:search={handleSearchGlobal}
            on:open={handleOpenSearchResult}
          />
        {:else if activeSection === "notifications"}
          <NotificationPanel
            notifications={notificationList}
            history={notificationHistory}
            activeTab={notificationTab}
            {historyIndex}
            onLoadMore={handleLoadMoreHistory}
            on:tabChange={(e) => {
              notificationTab = e.detail;
              persistUiState();
            }}
            on:close={handleCloseNotifications}
            on:open={(e) => handleOpenNotification(e.detail)}
            on:read={(e) => handleReadNotification(e.detail)}
            on:unread={(e) => handleUnreadNotification(e.detail)}
            on:delete={(e) => handleDeleteNotification(e.detail)}
            on:loadMore={handleLoadMoreHistory}
          />
        {:else if selectedNote && currentFileType === "key"}
          <KeyEditor
            entries={keyEntries}
            locked={keyLocked}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            {selectionSuggestion}
            onRequestSelectionCheck={handleRequestSelectionCheck}
            on:save={handleKeySave}
            on:back={handleBack}
            on:unlock={handleUnlock}
            on:lock={handleLock}
            on:openExternal={handleOpenExternal}
          />
        {:else if selectedNote && currentFileType === "command"}
          <CommandEditor
            entries={commandEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            {selectionSuggestion}
            onRequestSelectionCheck={handleRequestSelectionCheck}
            on:save={handleCommandSave}
            on:back={handleBack}
            on:insert={handleInsertIntoEditor}
          />
        {:else if selectedNote && currentFileType === "todo"}
          <TodoEditor
            entries={todoEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            {selectionSuggestion}
            onRequestSelectionCheck={handleRequestSelectionCheck}
            on:save={handleTodoSave}
            on:back={handleBack}
          />
        {:else if selectedNote && currentFileType === "snippet"}
          <SnippetEditor
            entries={snippetEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            {selectionSuggestion}
            onRequestSelectionCheck={handleRequestSelectionCheck}
            on:save={handleSnippetSave}
            on:back={handleBack}
            on:insert={handleInsertIntoEditor}
          />
        {:else if selectedNote && currentFileType === "reminder"}
          <ReminderEditor
            entries={reminderEntries}
            {selectedNote}
            initialFilterText={activeEditorSearchText}
            on:save={handleReminderSave}
            on:back={handleBack}
            on:openUrl={(e) =>
              vscode.postMessage({
                command: "openExternal",
                type: "url",
                value: e.detail,
              })}
          />
        {:else if selectedNote}
          <NoteEditor
            {noteContent}
            {selectedNote}
            searchText={activeEditorSearchText}
            onSave={handleSaveNote}
            onBack={handleBack}
          />
        {:else}
          <NotesList
            {notes}
            {folders}
            {selectedCategory}
            {parentFolderPath}
            {folderBreadcrumb}
            {selectedCategoryConfig}
            canDeleteCategory={selectedCategoryCanDelete}
            onSelect={handleSelectNote}
            onCreate={handleCreateNote}
            onDelete={handleDeleteNote}
            onDeleteCategory={handleDeleteCategory}
            onRename={handleRenameNote}
            onMove={handleMoveNote}
            onImport={handleImport}
            onExport={handleExportNote}
            onRenameCategory={handleRenameCategory}
            onUpdateCategoryColor={handleUpdateCategoryColor}
            onOpenFolder={handleOpenFolder}
            onFolderBack={handleFolderBack}
            onBreadcrumbClick={handleBreadcrumbClick}
            onDeleteFolder={handleDeleteFolder}
            onRenameFolder={handleRenameFolder}
            onMoveFolder={handleMoveFolderTrigger}
            onUpdateFolderColor={handleUpdateFolderColor}
            onDropItem={handleDropItem}
            {selectionSuggestion}
            onRequestSelectionCheck={handleRequestSelectionCheck}
            {categoryPath}
          />
        {/if}
      </div>
    </div>
  {/if}

  {#if reloading}
    <div class="reload-backdrop"></div>
    <div class="reload-spinner"></div>
  {/if}

  <DeleteConfirmModal
    show={deletePrompt !== null}
    title={deletePromptTitle}
    itemName={deletePrompt?.label ?? ''}
    on:confirm={confirmDeletePrompt}
    on:cancel={cancelDeletePrompt}
  />

  {#if renamePrompt}
    <button
      class="delete-modal-backdrop"
      on:click={cancelRenamePrompt}
      aria-label="Close rename dialog"
    ></button>
    <div class="delete-modal">
      <h3>
        {$t("app.renameModalTitle", {
          type:
            renamePrompt.type === "note"
              ? $t("app.typeFile")
              : $t("app.typeCategory"),
        })}
      </h3>
      <p>{$t("app.renameModalBody", { label: renamePrompt.label })}</p>
      <input
        class="rename-input"
        type="text"
        bind:value={renameInput}
        placeholder={$t("common.name")}
        on:keydown={(event) => event.key === "Enter" && confirmRenamePrompt()}
      />
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelRenamePrompt}
          >{$t("common.cancel")}</button
        >
        <button class="btn primary" on:click={confirmRenamePrompt}
          >{$t("common.save")}</button
        >
      </div>
    </div>
  {/if}

  {#if movePrompt}
    <button
      class="delete-modal-backdrop"
      on:click={cancelMovePrompt}
      aria-label="Close move dialog"
    ></button>
    <div class="delete-modal">
      <h3>
        {$t("app.moveModalTitle", {
          type: movePrompt.isFolder ? $t("app.typeFolder") : $t("app.typeFile"),
        })}
      </h3>
      <p>{$t("app.moveModalBody", { name: movePrompt.item.name })}</p>
      <label class="modal-field-label" for="move-category-select"
        >{$t("app.moveCategoryLabel")}</label
      >
      <select
        id="move-category-select"
        class="move-select"
        bind:value={selectedMoveCategory}
        on:change={handleMoveCategoryChange}
      >
        {#each categories.filter((c) => !movePrompt.isFolder || c.name !== selectedCategory) as cat}
          <option value={cat.name}>{cat.name}</option>
        {/each}
      </select>
      <label class="modal-field-label" for="move-folder-select"
        >{$t("app.moveFolderLabel")}</label
      >
      <select
        id="move-folder-select"
        class="move-select"
        bind:value={selectedMoveFolder}
      >
        <option value="">{$t("app.moveRootOption")}</option>
        {#each moveFolderTree as f1}
          <option value={f1.name}>{f1.name}</option>
          {#if f1.children}
            {#each f1.children as f2}
              <option value={f1.name + "/" + f2.name}>— {f2.name}</option>
              {#if f2.children}
                {#each f2.children as f3}
                  <option value={f1.name + "/" + f2.name + "/" + f3.name}
                    >—— {f3.name}</option
                  >
                {/each}
              {/if}
            {/each}
          {/if}
        {/each}
      </select>
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelMovePrompt}
          >{$t("common.cancel")}</button
        >
        <button class="btn primary" on:click={confirmMoveNote}
          >{$t("common.move")}</button
        >
      </div>
    </div>
  {/if}

  {#if exportPrompt}
    <button
      class="delete-modal-backdrop"
      on:click={cancelExportPrompt}
      aria-label="Close export dialog"
    ></button>
    <div class="delete-modal">
      <h3>{$t("app.exportModalTitle")}</h3>
      <p>{$t("app.exportModalBody", { name: exportPrompt.note.name })}</p>
      {#each exportPrompt.formats as fmt}
        <label class="export-option">
          <input
            type="radio"
            bind:group={selectedExportFormat}
            value={fmt.value}
          />
          <span>{fmt.label}</span>
        </label>
      {/each}
      <div class="delete-modal-actions">
        <button class="btn" on:click={cancelExportPrompt}
          >{$t("common.cancel")}</button
        >
        <button class="btn primary" on:click={confirmExportNote}
          >{$t("app.exportButton")}</button
        >
      </div>
    </div>
  {/if}
</main>

<style>
  :global(html, body, #app) {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  :global(#app) {
    --ui-radius-sm: 4px;
    --ui-radius-md: 6px;
    --ui-radius-lg: 10px;
    --ui-gap-1: 0.24rem;
    --ui-gap-2: 0.4rem;
    --ui-gap-3: 0.58rem;
    --ui-gap-4: 0.82rem;
    --ui-font-xs: 0.6rem;
    --ui-font-sm: 0.68rem;
    --ui-font-md: 0.76rem;
    --ui-font-lg: 0.84rem;
    --ui-font-title: 0.7rem;
    --ui-font-entry: 0.66rem;
    --ui-font-control: 0.64rem;
    --ui-icon-btn-size: 1.24rem;
    --ui-toolbar-btn-size: 1.3rem;
    --ui-control-height: 1.34rem;
    --ui-control-height-sm: 1.28rem;
    --ui-control-pad-x: 0.38rem;
    --ui-control-pad-y: 0.26rem;
    --ui-search-icon-left: 0.56rem;
    --ui-search-input-pad-left: 1.56rem;
    --ui-card-pad-x: 0.34rem;
    --ui-card-pad-y: 0.28rem;
    --ui-menu-pad-x: 0.34rem;
    --ui-menu-pad-y: 0.26rem;
    --ui-menu-font: 0.64rem;
    --ui-border: color-mix(
      in srgb,
      var(--vscode-panel-border) 72%,
      transparent
    );
    --ui-border-strong: color-mix(
      in srgb,
      var(--vscode-panel-border) 92%,
      transparent
    );
    --ui-muted: color-mix(in srgb, var(--vscode-foreground) 62%, transparent);
    --ui-soft: color-mix(
      in srgb,
      var(--vscode-sideBar-background) 94%,
      white 6%
    );
    --ui-soft-2: color-mix(
      in srgb,
      var(--vscode-editor-background) 96%,
      white 4%
    );
    --ui-elevated: color-mix(
      in srgb,
      var(--vscode-editor-background) 97%,
      white 3%
    );
    --ui-hover: color-mix(
      in srgb,
      var(--accent-color, var(--vscode-textLink-foreground)) 8%,
      transparent
    );
    --ui-active: color-mix(
      in srgb,
      var(--accent-color, var(--vscode-textLink-foreground)) 14%,
      transparent
    );
    --ui-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  main {
    height: 100%;
    overflow: hidden;
  }

  .setup,
  .empty-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1.2rem;
    text-align: center;
    gap: var(--ui-gap-2);
    color: var(--ui-muted);
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
    transition:
      background 0.18s,
      border-color 0.18s,
      transform 0.12s;
  }

  .btn:hover {
    background: var(--ui-soft-2);
  }
  .btn:active {
    transform: translateY(1px);
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

  .btn.danger {
    background: #c0392b;
    color: #fff;
  }

  .btn.danger:hover {
    background: #e74c3c;
  }

  .layout {
    display: flex;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-sideBar-background);
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    background: color-mix(
      in srgb,
      var(--accent-color) 3%,
      var(--vscode-editor-background)
    );
    border-left: 1px solid
      color-mix(in srgb, var(--accent-color) 14%, var(--ui-border));
    transition: background 0.2s;
  }

  .error-toast {
    position: fixed;
    bottom: 0.8rem;
    right: 0.8rem;
    left: auto;
    max-width: min(520px, calc(100vw - 1.6rem));
    background: #c0392b;
    color: #fff;
    padding: 0.7rem 0.85rem;
    border-radius: var(--ui-radius-md);
    font-size: var(--ui-font-sm);
    box-shadow: var(--ui-shadow);
    z-index: 100;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid color-mix(in srgb, #c0392b 60%, white 14%);
  }

  .success-toast {
    position: fixed;
    bottom: 0.8rem;
    right: 0.8rem;
    left: auto;
    max-width: min(520px, calc(100vw - 1.6rem));
    background: #27ae60;
    color: #fff;
    padding: 0.7rem 0.85rem;
    border-radius: var(--ui-radius-md);
    font-size: var(--ui-font-sm);
    box-shadow: var(--ui-shadow);
    z-index: 100;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid color-mix(in srgb, #27ae60 60%, white 14%);
  }

  .delete-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 30;
  }

  .delete-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(320px, calc(100vw - 2rem));
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-lg);
    padding: 1.1rem;
    z-index: 31;
    box-sizing: border-box;
    box-shadow: var(--ui-shadow);
  }

  .delete-modal h3 {
    margin: 0 0 0.5rem;
    font-size: var(--ui-font-lg);
    font-weight: 600;
  }

  .delete-modal p {
    margin: 0 0 0.75rem;
    font-size: var(--ui-font-sm);
    line-height: 1.4;
    color: var(--ui-muted);
    word-break: break-word;
  }

  .delete-code-input {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    margin-bottom: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: var(--ui-font-control);
  }

  .rename-input,
  .move-select {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--ui-border-strong);
    border-radius: var(--ui-radius-sm);
    min-height: var(--ui-control-height);
    padding: var(--ui-control-pad-y) calc(var(--ui-control-pad-x) + 0.08rem);
    margin-bottom: 0.8rem;
    font-size: var(--ui-font-control);
  }

  .delete-code-input:focus,
  .rename-input:focus,
  .move-select:focus {
    outline: none;
    border-color: var(--vscode-focusBorder);
  }

  .modal-field-label {
    display: block;
    font-size: var(--ui-font-xs);
    color: var(--ui-muted);
    margin-bottom: 0.2rem;
    margin-top: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .modal-field-label:first-of-type {
    margin-top: 0;
  }

  .export-option {
    display: flex;
    align-items: center;
    gap: 0.34rem;
    padding: 0.2rem 0;
    cursor: pointer;
    font-size: var(--ui-font-control);
    color: var(--vscode-foreground);
  }

  .export-option input[type="radio"] {
    accent-color: var(--vscode-textLink-foreground);
    margin: 0;
  }

  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-gap-2);
  }

  .recent-folders {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 1rem;
    gap: 0.8rem;
    box-sizing: border-box;
  }

  .recent-title {
    font-size: var(--ui-font-md);
    font-weight: 500;
    color: var(--ui-muted);
    margin: 0;
  }

  .recent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 0.5rem;
    width: 100%;
    max-width: 480px;
  }

  .recent-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.7rem 0.4rem;
    background: var(--ui-soft);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius-lg);
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
    text-align: center;
  }

  .recent-card:hover {
    background: var(--ui-soft-2);
    border-color: var(--ui-border-strong);
  }

  .recent-icon {
    font-size: 1.8rem;
    opacity: 0.75;
  }

  .recent-name {
    font-size: var(--ui-font-xs);
    color: var(--vscode-foreground);
    word-break: break-word;
    line-height: 1.2;
  }

  .recent-footer {
    display: flex;
    gap: 0.4rem;
  }

  .reload-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    background: rgba(0, 0, 0, 0.25);
  }

  .reload-spinner {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 1.2rem;
    height: 1.2rem;
    margin: -0.6rem 0 0 -0.6rem;
    z-index: 999;
    border: 2px solid var(--ui-border);
    border-top-color: var(--vscode-textLink-foreground);
    border-radius: 50%;
    animation: reload-spin 0.6s linear infinite;
  }

  @keyframes reload-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
