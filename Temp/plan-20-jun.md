# Analisis y plan de refactorizacion - 20 jun

## Objetivo

Agrupar logica repetitiva, instrucciones comunes y markup duplicado del webview en funciones de `lib`, utilidades y componentes Svelte reutilizables. La prioridad es reducir repeticion sin cambiar comportamiento, manteniendo el sistema visual actual y el nuevo `theme.css` como base de estilos.

## Alcance revisado

- `webview/src/App.svelte`
- `webview/src/components/NotesList.svelte`
- `webview/src/components/CommandEditor.svelte`
- `webview/src/components/SnippetEditor.svelte`
- `webview/src/components/TodoEditor.svelte`
- `webview/src/components/KeyEditor.svelte`
- `webview/src/components/ReminderEditor.svelte`
- `webview/src/components/NotificationPanel.svelte` parcialmente por busqueda de patrones
- `webview/src/lib/EditorHeader.svelte`
- `webview/src/lib/EntryTitleBar.svelte`
- `webview/src/lib/SearchToolbar.svelte`
- `webview/src/lib/DeleteConfirmModal.svelte`
- `webview/src/lib/fileUtils.ts`
- `webview/src/lib/timeUtils.ts`
- `webview/src/lib/sortUtils.ts`
- `webview/src/lib/utils.ts`
- `webview/src/utils/smartPopover.ts`

## Estado actual

Ya existen piezas reutilizables utiles:

- `EditorHeader.svelte`: header con boton back, icono y titulo del archivo.
- `EntryTitleBar.svelte`: barra de titulo para entries con menu y slots.
- `SearchToolbar.svelte`: input de filtro, clear y sort opcional.
- `DeleteConfirmModal.svelte`: confirmacion de borrado con codigo.
- `ColorPicker.svelte`: selector de color.
- `smartPopover.ts`: accion para cerrar/reposicionar popovers.
- `fileUtils.ts`: display name, iconos y resolucion de colores.
- `timeUtils.ts` y `utils.ts`: fechas, due tone, relative due y repeticion.
- `theme.css` y `editor.css`: base visual compartida.

El problema principal ya no es solo CSS. Hay repeticion de estado, operaciones CRUD locales, filtros, sort, modales, parsing de seleccion y menus en varios editores.

## Hallazgos principales

### 1. Patron repetido de editores de entradas

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`

Patron repetido:

- `entries` llega por prop.
- Se crea `localEntries = entries.map(...)`.
- Se mantiene `_prevEntries` para re-sincronizar props externas.
- Se filtra por `initialFilterText` usando `lastAppliedInitialFilter`.
- Se abre/cierra modal add/edit.
- Se valida titulo/campo principal.
- Se agrega, edita o elimina en `localEntries`.
- Se emite `save`.
- Se mantiene `deletePrompt` y se confirma con modal.
- Se hace scroll al final despues de agregar.
- Se controla un menu abierto por indice.

Ejemplos claros:

- `CommandEditor.svelte`: `_prevEntries`, `lastAppliedInitialFilter`, `filteredEntries`, `toggleSort`, `openAddModal`, `openEditModal`, `saveModal`, `cancelModal`, `requestDeleteEntry`, `confirmDeletePrompt`.
- `SnippetEditor.svelte`: estructura casi igual a command, cambiando campos `language` y `code`.
- `KeyEditor.svelte`: misma base, con campos extra, lock/unlock y copy de varias propiedades.
- `TodoEditor.svelte`: misma sincronizacion y delete prompt, mas filtros de estado/prioridad y movimiento.
- `ReminderEditor.svelte`: misma sincronizacion, delete prompt, filtros y modales, mas preset/repeat/action.

### 2. Sort triestado duplicado

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`

La funcion `toggleSort` se repite con la misma secuencia:

```ts
asc -> desc -> null -> asc
```

`sortUtils.ts` solo define el tipo `SortDirection`, por lo que es el lugar natural para agregar:

- `nextSortDirection(direction: SortDirection): SortDirection`
- `sortByTitle<T extends { title: string }>(entries: T[], direction: SortDirection): T[]`
- `filterByText<T>(entries: T[], query: string, fields: (entry: T) => unknown[]): T[]`
- `sortAndFilterEntries<T>(entries, direction, query, fields)`

### 3. Filtro inicial repetido

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`

Patron:

```ts
let filterText = ''
let lastAppliedInitialFilter = ''

$: if (initialFilterText !== lastAppliedInitialFilter) {
  filterText = initialFilterText
  lastAppliedInitialFilter = initialFilterText
}
```

Candidato:

- Crear `webview/src/lib/editorState.ts` con funcion pura `applyInitialFilter(current, incoming, last)` que devuelva `{ filterText, lastAppliedInitialFilter }`.
- Alternativa Svelte: componente/helper `createInitialFilterState` no es ideal en Svelte 4 si no se quiere complejidad de stores. Mejor funcion pura por ahora.

### 4. Sincronizacion de entries duplicada

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`
- `KeyEditor.svelte`

Patron:

```ts
let localEntries = entries.map((e) => ({ ...e }))
let _prevEntries = entries
$: if (entries !== localEntries && entries !== _prevEntries) {
  _prevEntries = entries
  localEntries = entries.map((e) => ({ ...e }))
}
```

Variantes:

- `ReminderEditor.svelte` necesita copia profunda parcial de `action`.
- `KeyEditor.svelte` usa una condicion levemente distinta.

Candidato:

- Crear `cloneEntries` y `syncLocalEntries` en `webview/src/lib/editorState.ts`.
- Mantener clone por parametro para casos con nested object:

```ts
export function cloneEntries<T>(entries: T[], clone: (entry: T) => T): T[]
export function shouldSyncEntries<T>(incoming: T[], previous: T[]): boolean
```

Nota: no conviene crear un store generico complejo en primera fase; puede generar mas cambio que beneficio.

### 5. Parsing de seleccion repetido

Archivos afectados:

- `KeyEditor.svelte`
- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `TodoEditor.svelte`
- `NotesList.svelte` parcialmente para titulo/tipo sugerido.

Patron repetido:

- Detectar JSON o array JSON.
- Tomar primer objeto si viene array.
- Mapear alias de campos.
- Si no parsea JSON, hacer parseo tolerante tipo `key: value`.
- Limpiar llaves/corchetes y comas finales.
- Rellenar modal solo una vez usando `requestId` y `filledFromSuggestion`.

Candidatos:

- `webview/src/lib/selectionParser.ts`
- Funciones:

```ts
export function parseJsonLikeObject(text: string): Record<string, unknown> | null
export function parseKeyValueLines(text: string): Record<string, string>
export function firstNonEmptyLine(text: string): string
export function parseCommandSuggestion(text: string): { title: string; command: string }
export function parseSnippetSuggestion(text: string, languageId?: string): { title: string; language: string; code: string }
export function parseTodoSuggestion(text: string): { title?: string; text?: string; priority?: 'high' | 'medium' | 'low'; due?: string }
export function parseKeySuggestion(text: string): Record<string, string>
```

Ventajas:

- Se elimina logica grande de scripts Svelte.
- Se pueden probar funciones puras sin montar Svelte.
- Se mantiene flexible para selecciones del editor.

Riesgo:

- El parser de `KeyEditor` tiene alias especificos mas amplios; debe migrarse con tests o comparando manualmente casos conocidos.

### 6. Copy to clipboard con feedback duplicado

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`

Patron:

- `navigator.clipboard.writeText(...)`
- setear indice/key copiado.
- limpiar con `setTimeout`.

Candidato:

- `webview/src/lib/clipboard.ts`

Funciones sugeridas:

```ts
export async function copyText(value: string): Promise<boolean>
export function createCopyFeedback(timeoutMs = 1500)
```

En Svelte puede quedarse simple:

- Usar `copyText` como funcion pura.
- Mantener estado `copiedIndex` local.
- Unificar tiempo con constante `COPY_FEEDBACK_MS`.

No conviene crear componente todavia; los botones tienen iconos/acciones distintas.

### 7. Modales add/edit repetidos

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`
- `NotesList.svelte`
- `App.svelte`

Patron:

- Backdrop button.
- Contenedor `.add-modal`, `.form-modal` o `.delete-modal`.
- Titulo condicional add/edit.
- Campos con `field-error`.
- Acciones cancelar/guardar.

Candidato de componente:

- `webview/src/lib/FormModal.svelte`

API propuesta:

```svelte
<FormModal
  show={modalMode !== null}
  title={modalTitle}
  closeLabel={$t('common.close')}
  on:close={cancelModal}
>
  <slot />
  <svelte:fragment slot="actions">
    <button class="btn" on:click={cancelModal}>...</button>
    <button class="btn primary" on:click={saveModal}>...</button>
  </svelte:fragment>
</FormModal>
```

Regla recomendada:

- No intentar parametrizar todos los campos del modal al inicio.
- Extraer solo carcasa, backdrop, titulo y zona de acciones.
- Cada editor conserva sus inputs especificos.

### 8. Menu popover repetido

Archivos afectados:

- `EntryTitleBar.svelte`
- `NotesList.svelte` para menu de categoria, carpeta y nota.
- `TodoEditor.svelte` y `ReminderEditor.svelte` via slots de `EntryTitleBar`.

Patron:

- `menu-wrap`, `menu-open`, `menu-popover`.
- `use:smartPopover` con `open` y `onClose`.
- Boton trigger con `icon-dots-vertical`.
- Items con icono + label.

Candidatos:

- `webview/src/lib/PopoverMenu.svelte`
- `webview/src/lib/MenuItem.svelte`

API propuesta:

```svelte
<PopoverMenu open={activeMenu === id} title="..." on:toggle on:close>
  <MenuItem icon="icon-edit-alt" label={$t('common.edit')} on:select={...} />
  <MenuItem icon="icon-trash-alt" label={$t('common.delete')} danger on:select={...} />
</PopoverMenu>
```

Uso esperado:

- `EntryTitleBar` puede consumir `PopoverMenu` internamente.
- `NotesList` puede reemplazar sus tres menus por el mismo componente.

Riesgo:

- `smartPopover` es sensible a posicion/z-index; migrar primero `EntryTitleBar`, luego un menu de `NotesList`, verificar y continuar.

### 9. Filter chips repetidos

Archivos afectados:

- `TodoEditor.svelte`
- `ReminderEditor.svelte`

Patron:

- Fila `.filter-row`.
- Varios botones `.filter-chip` con `class:active`.
- Labels con conteo.

Candidato:

- `webview/src/lib/FilterChips.svelte`

API propuesta:

```ts
type FilterChipOption<T extends string> = {
  value: T
  label: string
  count?: number
}
```

```svelte
<FilterChips options={statusOptions} value={activeFilter} on:change={...} />
```

Beneficio:

- Reduce markup repetido.
- Uniforma accesibilidad y clases.

### 10. Entry cards repetidas

Archivos afectados:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `KeyEditor.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`

Patron:

- Contenedor `.entry` o `.ui-card`.
- `EntryTitleBar`.
- Cuerpo con preview/text/meta.
- Boton add al final.
- Empty state en algunos casos.

Candidato de bajo riesgo:

- Mantener `EntryTitleBar`.
- Crear `EntryList.svelte` solo si se repite mucho despues de extraer estados/helpers.

No recomendado para primera fase:

- Crear un componente generico demasiado abstracto para todos los tipos. `Todo` y `Reminder` tienen comportamiento especial; `Command` y `Snippet` si son buenos candidatos para compartir mas.

### 11. CommandEditor y SnippetEditor son los mejores candidatos para un componente base

Ambos son muy similares:

- Tipo simple de entry.
- Header + add.
- SearchToolbar + sort.
- Lista con `EntryTitleBar`.
- Acciones copy e insert.
- Preview en `code/pre`.
- Modal add/edit con titulo + campo principal.
- Delete confirm.

Posible refactor:

- Crear `CodeEntryEditor.svelte` o `SimpleEntryEditor.svelte`.
- Parametrizar:
  - labels i18n ya resueltos desde el padre o key prefix.
  - fields: command/code/language.
  - preview tag/scrollable.
  - modal extra para language select.

Recomendacion pragmatica:

- Primero extraer helpers (`sortUtils`, `selectionParser`, `FormModal`, `PopoverMenu`).
- Despues evaluar fusion parcial de Command/Snippet si el codigo queda todavia duplicado.

### 12. NotesList mezcla demasiadas responsabilidades

Responsabilidades actuales:

- Header de categoria.
- Menu de categoria.
- Crear nueva entrada.
- Breadcrumb.
- Lista de carpetas.
- Lista de archivos.
- Menus por carpeta y archivo.
- Rename folder modal.
- Color picker categoria/carpeta.
- Drag & drop.
- Guard contra navegacion post-drop.
- Sugerencia desde seleccion.
- Resolucion de iconos.

Candidatos a componentes:

- `CategoryHeader.svelte`: titulo, back, add, menu de categoria.
- `BreadcrumbBar.svelte`: root + segmentos + drop targets.
- `FolderListItem.svelte`: carpeta, menu, color, drag/drop.
- `NoteListItem.svelte`: archivo, menu, progress bar, drag.
- `CreateEntryModal.svelte`: nombre + selector de tipo.
- `FileTypeGrid.svelte`: selector md/key/command/todo/snippet/reminder/folder.
- `RenameFolderModal.svelte` puede usar `FormModal`.

Funciones a mover a lib:

- `getIconClass` debe unificarse con `getFileIconClass` de `fileUtils.ts`, porque duplican decision de iconos.
- `resolveFolderAccent` puede moverse a `fileUtils.ts` o `colorUtils.ts`.
- Drag/drop helpers se pueden mover a `dragDrop.ts` solo si se repiten luego. Por ahora estan contenidos en NotesList.

### 13. App.svelte concentra modales globales y mucho ruteo de estado

Responsabilidades actuales relevantes:

- Seleccion de categoria/nota/carpeta.
- Ruteo entre editores.
- Persistencia de UI state.
- Modales rename/move/export.
- Delete confirm global.
- Manejo de mensajes VS Code.

Candidatos:

- `RenameModal.svelte` usando `FormModal`.
- `MoveModal.svelte` usando `FormModal`.
- `ExportModal.svelte` usando `FormModal`.
- `getMoveFolderOptions(tree)` helper para aplanar el arbol en options.
- `resetEditorState()` helper local en App para evitar repetir limpieza de `noteContent`, `keyEntries`, `commandEntries`, `todoEntries`, `snippetEntries`, `reminderEntries`.

No recomendado en primera fase:

- Mover todo el state machine de App a stores. Es grande y riesgoso. Primero extraer modales y helpers puros.

### 14. Funciones de fecha/titulo duplicadas

Duplicados:

- `deriveTitle` existe en `TodoEditor.svelte` y `ReminderEditor.svelte`.
- `getRelativeDueLabel` existe en `TodoEditor.svelte` y `ReminderEditor.svelte`, con diferencia: Todo hardcodea ingles y Reminder usa i18n.
- `normalizeDueAt` esta en Todo; Reminder tiene `computeDueIso` y presets.
- `generateId` esta en Reminder; podria ir a `utils.ts`.

Candidatos:

- `webview/src/lib/titleUtils.ts`
  - `deriveTitle(text: string, fallback = 'Untitled', wordCount = 3)`
- `webview/src/lib/timeUtils.ts`
  - ampliar con `formatRelativeDue(result, translate?)` o solo devolver datos y que cada componente traduzca.
  - `normalizeDatetimeLocal(value: string): string | undefined`
- `webview/src/lib/utils.ts`
  - mover `generateId()` o crear `idUtils.ts`.

### 15. File icon logic duplicada

Duplicados:

- `fileUtils.ts/getFileIconClass(name)` usa extension real.
- `NotesList.svelte/getIconClass(note)` usa `fileType` o extension lock.

Candidato:

```ts
export function getFileTypeIconClass(fileType?: string, name?: string): string
```

Luego `EditorHeader` y `NotesList` deberian depender de la misma gramatica de iconos.

### 16. Estilos todavia mezclados con componentes

Este plan no reemplaza el plan visual anterior, lo complementa. Despues de crear `theme.css`, hay valores y clases repetidas que conviene seguir migrando:

- `.summary-bar`, `.progress-slider`, `.priority-chip`, `.due-label`, `.action-link`, `.type-option`, breadcrumbs y note items.
- Componentes de formulario pueden reducir CSS local si se usa `FormModal`, `FilterChips`, `PopoverMenu` y tokens de `theme.css`.

## Propuesta de nuevas utilidades y componentes

### Nuevos archivos de funciones

1. `webview/src/lib/editorState.ts`

Funciones:

- `applyInitialFilter(currentFilter, incomingFilter, lastApplied)`
- `cloneEntries(entries, clone)`
- `shouldSyncEntries(incoming, previous)`
- `replaceEntry(entries, index, entry)`
- `removeEntry(entries, index)`
- `appendEntry(entries, entry)`
- `moveEntry(entries, fromIndex, targetIndex)`

2. `webview/src/lib/selectionParser.ts`

Funciones:

- `parseJsonLikeObject`
- `parseKeyValueLines`
- `parseCommandSuggestion`
- `parseSnippetSuggestion`
- `parseTodoSuggestion`
- `parseKeySuggestion`
- `firstNonEmptyLine`

3. `webview/src/lib/clipboard.ts`

Funciones:

- `copyText`
- `COPY_FEEDBACK_MS`

4. `webview/src/lib/titleUtils.ts`

Funciones:

- `deriveTitle`

5. Ampliar `webview/src/lib/sortUtils.ts`

Funciones:

- `nextSortDirection`
- `sortByTitle`
- `filterByText`
- `sortAndFilterEntries`

6. Ampliar `webview/src/lib/fileUtils.ts`

Funciones:

- `getFileTypeIconClass`
- `resolveFolderAccent`

7. Ampliar `webview/src/lib/timeUtils.ts`

Funciones:

- `normalizeDatetimeLocal`
- opcional: `getRelativeDueParts` si se quiere unificar Todo/Reminder sin acoplar i18n.

### Nuevos componentes Svelte

1. `webview/src/lib/FormModal.svelte`

Responsabilidad:

- Backdrop.
- Contenedor modal.
- Titulo.
- Slot body.
- Slot actions.
- Evento close.

2. `webview/src/lib/PopoverMenu.svelte`

Responsabilidad:

- Trigger dots opcional.
- `menu-wrap`, `menu-open`, `menu-popover`.
- `smartPopover`.
- Slots para items.

3. `webview/src/lib/MenuItem.svelte`

Responsabilidad:

- Icono + label.
- Variante danger.
- Evento select con stopPropagation.

4. `webview/src/lib/FilterChips.svelte`

Responsabilidad:

- Renderizar fila de chips.
- Active state.
- Evento change.

5. `webview/src/lib/FileTypeGrid.svelte`

Responsabilidad:

- Selector de tipo de entrada usado por `NotesList`.

6. Componentes posteriores para `NotesList`

- `CategoryHeader.svelte`
- `BreadcrumbBar.svelte`
- `FolderListItem.svelte`
- `NoteListItem.svelte`
- `CreateEntryModal.svelte`

Estos conviene crearlos despues de extraer `PopoverMenu`, `MenuItem`, `FormModal` y `FileTypeGrid`.

## Plan de implementacion por fases

### Fase 1: Helpers puros de bajo riesgo

Objetivo: reducir logica repetida sin tocar mucho markup.

Cambios:

- Ampliar `sortUtils.ts` con `nextSortDirection`, `sortByTitle`, `filterByText` y `sortAndFilterEntries`.
- Crear `titleUtils.ts` con `deriveTitle`.
- Ampliar `fileUtils.ts` con `getFileTypeIconClass` y `resolveFolderAccent`.
- Crear `clipboard.ts` con `copyText` y `COPY_FEEDBACK_MS`.
- Mover `generateId` de `ReminderEditor.svelte` a `utils.ts` o `idUtils.ts`.

Aplicar primero en:

- `CommandEditor.svelte`
- `SnippetEditor.svelte`
- `NotesList.svelte`
- `TodoEditor.svelte`
- `ReminderEditor.svelte`

Verificacion:

- `npm run build:webview`

### Fase 2: Parser de seleccion

Objetivo: sacar parsing largo de los editores.

Cambios:

- Crear `selectionParser.ts`.
- Migrar primero `CommandEditor.svelte` y `SnippetEditor.svelte` porque son mas simples.
- Migrar `TodoEditor.svelte` despues.
- Migrar `KeyEditor.svelte` al final porque tiene mas alias y campos.

Verificacion:

- Probar seleccion JSON y texto plano para command/snippet/todo/key.
- `npm run build:webview`.

### Fase 3: FormModal y modales simples

Objetivo: reducir duplicacion de backdrop/contenedor/acciones sin abstraer campos.

Cambios:

- Crear `FormModal.svelte`.
- Migrar modales de `CommandEditor.svelte` y `SnippetEditor.svelte`.
- Migrar rename folder en `NotesList.svelte`.
- Migrar add entry modal de `NotesList.svelte` solo despues de crear `FileTypeGrid`.
- Migrar modales rename/move/export de `App.svelte` en una fase posterior.

Verificacion:

- Cerrar con backdrop.
- Boton cancelar.
- Guardar/add/edit.
- Focus inicial sigue funcionando.
- `npm run build:webview`.

### Fase 4: PopoverMenu/MenuItem

Objetivo: unificar menus y `smartPopover`.

Cambios:

- Crear `PopoverMenu.svelte`.
- Crear `MenuItem.svelte`.
- Refactorizar `EntryTitleBar.svelte` para usarlos internamente.
- Migrar menu de categoria en `NotesList.svelte`.
- Migrar menu de carpeta y nota en `NotesList.svelte`.

Verificacion:

- Menus cierran al click afuera.
- Menus se posicionan bien cerca de bordes.
- Z-index sigue correcto sobre cards.
- `npm run build:webview`.

### Fase 5: FilterChips

Objetivo: simplificar filtros de estado.

Cambios:

- Crear `FilterChips.svelte`.
- Migrar `TodoEditor.svelte` status filters.
- Migrar `ReminderEditor.svelte` status filters.

Verificacion:

- Conteos correctos.
- Active state correcto.
- Filtro combinado con search sigue funcionando.
- `npm run build:webview`.

### Fase 6: NotesList por componentes

Objetivo: separar responsabilidades del archivo mas mezclado.

Orden recomendado:

- Extraer `FileTypeGrid.svelte`.
- Extraer `CreateEntryModal.svelte` usando `FormModal` + `FileTypeGrid`.
- Extraer `NoteListItem.svelte`.
- Extraer `FolderListItem.svelte`.
- Extraer `BreadcrumbBar.svelte`.
- Extraer `CategoryHeader.svelte`.

Notas:

- Mantener drag/drop en `NotesList` inicialmente si complica props.
- Si `FolderListItem` recibe demasiados handlers, aceptar eso temporalmente antes de crear una abstraccion de drag/drop prematura.

Verificacion:

- Abrir carpeta.
- Breadcrumb root/intermedios.
- Drag/drop archivo a carpeta.
- Drag/drop carpeta a breadcrumb.
- Menus de nota/carpeta/categoria.
- Color picker categoria/carpeta.
- Crear todos los tipos de entrada.
- `npm run build:webview`.

### Fase 7: App modals y reset helpers

Objetivo: limpiar `App.svelte` sin mover el state machine principal.

Cambios:

- Crear `RenameModal.svelte`, `MoveModal.svelte`, `ExportModal.svelte` o usar `FormModal` directamente.
- Crear helper local `clearSelectedContent()` o `resetEditorBuffers()` para limpiar `noteContent`, `keyEntries`, `commandEntries`, `todoEntries`, `snippetEntries`, `reminderEntries`.
- Crear `getMoveFolderOptions(tree)` para aplanar opciones de carpeta.

Verificacion:

- Rename note/category.
- Move note/folder.
- Export formatos por tipo.
- Navegacion entre secciones.
- Persistencia UI state.
- `npm run build:webview`.

### Fase 8: Evaluar componente base para Command/Snippet

Objetivo: decidir si vale la pena fusionar editores simples.

Condicion de entrada:

- Helpers, `FormModal`, `PopoverMenu` y parser ya migrados.

Decision:

- Si todavia queda mucha duplicacion, crear `SimpleCodeEntryEditor.svelte`.
- Si la duplicacion restante es baja, mantener componentes separados para claridad.

## Priorizacion recomendada

1. `sortUtils.ts`, `titleUtils.ts`, `clipboard.ts`, `fileUtils.ts` ampliado.
2. `selectionParser.ts` para Command/Snippet/Todo/Key.
3. `FormModal.svelte`.
4. `PopoverMenu.svelte` + `MenuItem.svelte`.
5. `FilterChips.svelte`.
6. Descomponer `NotesList.svelte`.
7. Limpiar modales de `App.svelte`.
8. Evaluar editor base para Command/Snippet.

## Riesgos y mitigaciones

- Riesgo: abstraer demasiado pronto los editores puede hacer el codigo menos claro.
  Mitigacion: empezar por funciones puras y componentes pequenos, no por un editor generico gigante.

- Riesgo: `smartPopover` puede romper posicion/cierre si se mueve mal.
  Mitigacion: migrar primero `EntryTitleBar`, luego un solo menu de `NotesList`, verificar y repetir.

- Riesgo: el parser de seleccion cambia comportamiento existente.
  Mitigacion: migrar por editor y conservar alias actuales; agregar ejemplos manuales en comentarios o tests si se agregan pruebas.

- Riesgo: `NotesList` tiene drag/drop sensible con `suppressNavigationUntil` y `dropGuard`.
  Mitigacion: no extraer drag/drop en la primera pasada; separar UI manteniendo handlers en padre.

- Riesgo: `App.svelte` concentra mensajes VS Code y estado persistido.
  Mitigacion: no mover el state machine todavia; solo extraer modales/helper puros.

- Riesgo: tocar `localEntries` y sincronizacion puede perder cambios no guardados.
  Mitigacion: mantener el patron actual en primera fase y solo extraer helpers simples; no introducir stores globales.

## Resultado esperado

Despues de aplicar el plan por fases:

- Los editores tendran scripts mas cortos y enfocados en reglas de negocio especificas.
- El parseo de seleccion sera testeable y compartido.
- Menus, modales y chips tendran una unica implementacion visual/estructural.
- `NotesList.svelte` dejara de mezclar header, menus, listas, modales, color picker y drag/drop en un solo archivo.
- `App.svelte` quedara mas orientado a ruteo/mensajes VS Code y menos a markup de modales.
- El sistema visual seguira usando `theme.css` y `editor.css`, evitando duplicar estilos locales.

## Recomendacion final

Implementar en commits o pasos pequenos. La primera entrega deberia limitarse a helpers puros (`sortUtils`, `clipboard`, `titleUtils`, `fileUtils`) y migrar solo `CommandEditor`/`SnippetEditor`, porque son los componentes con mayor similitud y menor riesgo. Despues avanzar a `FormModal` y `PopoverMenu`, que desbloquean la limpieza real de `NotesList`, `TodoEditor`, `ReminderEditor` y `App`.
