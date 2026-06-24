# Plan de homologacion visual 1.0.5

## Objetivo

Unificar los componentes visuales del webview de Anemona Vault para que botones, inputs, selects, textareas, cards, formularios, titulos, menus, mensajes, alerts, toasts, badges, modales, iconos, tablas y estados visuales usen el mismo sistema de estilos.

## Reglas

- No cambiar la logica funcional.
- No redisenar por gusto personal.
- Mantener compatibilidad con el estilo actual del proyecto.
- Usar las variables CSS existentes como base del sistema visual.
- Hacer que los colores dependan de variables del tema de VS Code y de `--accent-color`.
- Crear clases base reutilizables.
- Evitar estilos duplicados o hardcodeados.
- Revisar estados: `hover`, `focus`, `active`, `disabled`, `loading`, `error`, `success`, `warning` y `empty state`.
- Revisar dark/light theme, espaciados, bordes, radios, sombras, fuentes e iconos.

## 1. Inventario de componentes visuales encontrados

- `webview/src/App.svelte`: layout principal, variables `--ui-*`, modales globales, botones, selects de mover/exportar, estados vacios.
- `webview/src/lib/editor.css`: base compartida actual para `.btn`, `.field`, `.form-input`, `.modal-field`, `.menu-item`, `.icon-btn`, `.entry`, `.add-entry-btn`, `.delete-modal`, etc.
- `webview/src/components/NotesList.svelte`: sidebar de notas, menus, cards de notas, botones, popovers, modales de crear/renombrar, selector de colores.
- `webview/src/components/CategoryTabs.svelte`: sidebar de categorias, tabs, badge de notificaciones, input de nueva categoria.
- `webview/src/components/SearchPanel.svelte`: panel, header, tarjetas de resultado, empty states.
- `webview/src/components/NotificationPanel.svelte`: tabs, notification cards, badges, botones propios `.notif-btn`, modal propio.
- `webview/src/components/TodoEditor.svelte`: cards de tareas, badges/prioridades, estados, progress slider, empty state.
- `webview/src/components/ReminderEditor.svelte`: cards, badges, selects, formularios, toast propio `.success-toast`, modal de confirmacion.
- `webview/src/components/KeyEditor.svelte`: formularios de llave, unlock area, warning text, detail rows, inputs propios.
- `webview/src/components/CommandEditor.svelte`: editor de comandos, modal, textarea, botones.
- `webview/src/components/SnippetEditor.svelte`: editor de snippets, modal, select, textarea, badge de lenguaje.
- `webview/src/lib/EntryTitleBar.svelte`: titulo de entry, acciones, popover menu.
- `webview/src/lib/DeleteConfirmModal.svelte`: modal de confirmacion, input de codigo, toast de error.
- `webview/src/lib/SearchToolbar.svelte`: input de busqueda, boton sort, clear button.
- `webview/src/components/NoteEditor.svelte`: editor markdown/texto.
- `webview/src/lib/EditorHeader.svelte` y `webview/src/lib/KeyPasswordRow.svelte`: piezas reutilizables menores.

## 2. Lista de inconsistencias

- `.btn` esta definido en `editor.css`, pero tambien aparece en `App.svelte`, `NotesList.svelte` y variantes como `.notif-btn` en `NotificationPanel.svelte`.
- `.icon-btn` esta centralizado, pero se redefine en `NotesList.svelte` y `NotificationPanel.svelte`.
- `.menu-item` existe en `editor.css`, pero se redefine en `NotesList.svelte`.
- Los popovers de menu se duplican entre `NotesList.svelte` y `EntryTitleBar.svelte`.
- Hay inputs similares con nombres distintos: `.field`, `.form-input`, `.modal-field`, `.delete-code-input`, `.unlock-input`, `.move-select`, `.new-cat-input`.
- Los modales usan varias familias visuales: `.delete-modal`, `.add-modal`, `.form-modal`, `.confirm-modal`.
- Hay empty states duplicados en `SearchPanel.svelte`, `TodoEditor.svelte`, `ReminderEditor.svelte`, `NotificationPanel.svelte` y `App.svelte`.
- Hay hardcodes de color para estados: `#c0392b`, `#e74c3c`, `#e87070`, `#ff8d8d`, `#f5a623`, `#ffd792`, `#68c3a0`, `#27ae60`, etc.
- Hay sombras hardcodeadas: `0 4px 12px rgba(...)`, `0 4px 14px rgba(...)`, aunque ya existe `--ui-shadow`.
- Algunos tamanos estan hardcodeados: `8px`, `10px`, `16px`, `2rem`, `0.52rem`, `0.54rem`, etc.
- Existen estilos inline, por ejemplo iconos de empty state en `NotificationPanel.svelte` y variables dinamicas de color en `NotesList.svelte`/`CategoryTabs.svelte`.
- Los estados visuales no son uniformes: `hover`, `focus`, `active`, `danger`, `success`, `warning`, `disabled` y `empty` no comparten una gramatica unica.
- Dark/light theme depende mayormente de variables VS Code, pero los colores hardcodeados pueden romper contraste en algunos temas.

## 3. Propuesta de sistema visual unificado

Mantener el estilo actual, pero formalizarlo en capas:

- Tokens: variables `--ui-*` para tamanos, radios, espacios, colores semanticos, sombras y z-index.
- Componentes base: clases reutilizables globales en `editor.css`.
- Variantes semanticas: `primary`, `secondary`, `danger`, `success`, `warning`, `info`, `muted`.
- Utilidades pequenas: layout, truncado, texto muted, acciones, grupos de botones.
- Componentes especificos: cada Svelte conserva solo estilos unicos de su dominio, no botones/inputs/cards genericos.

## 4. Clases CSS/base sugeridas

Clases a centralizar o normalizar en `editor.css`:

```css
.ui-btn
.ui-btn.primary
.ui-btn.secondary
.ui-btn.danger
.ui-btn.success
.ui-btn.warning
.ui-btn.ghost
.ui-btn.small
.ui-btn.icon

.ui-field
.ui-input
.ui-select
.ui-textarea
.ui-field.error
.ui-label
.ui-help
.ui-error

.ui-card
.ui-card.interactive
.ui-card.compact
.ui-card.warning
.ui-card.error
.ui-card.success

.ui-modal-backdrop
.ui-modal
.ui-modal-header
.ui-modal-body
.ui-modal-actions

.ui-menu-wrap
.ui-menu-popover
.ui-menu-item
.ui-menu-item.danger
.ui-menu-section-label

.ui-toast
.ui-toast.success
.ui-toast.error
.ui-toast.warning

.ui-badge
.ui-badge.success
.ui-badge.warning
.ui-badge.error
.ui-badge.info
.ui-badge.muted

.ui-empty
.ui-empty-icon
.ui-empty-title
.ui-empty-text

.ui-title
.ui-subtitle
.ui-muted
.ui-icon
.ui-icon-btn
```

No es necesario renombrar todo de golpe. Se puede hacer compatible con clases actuales:

```css
.btn,
.ui-btn { ... }

.form-input,
.modal-field,
.field,
.ui-field { ... }
```

Esto permite migrar por fases sin romper componentes.

## 5. Variables CSS faltantes o recomendadas

Variables existentes utiles:

- Radios: `--ui-radius-sm`, `--ui-radius-md`, `--ui-radius-lg`.
- Espaciados: `--ui-gap-*`.
- Tipografia: `--ui-font-*`.
- Controles: `--ui-control-*`.
- Bordes/sombras: `--ui-border`, `--ui-border-strong`, `--ui-shadow`.
- Estados: `--ui-hover`, `--ui-active`.

Variables recomendadas:

```css
--ui-danger
--ui-danger-bg
--ui-danger-border

--ui-warning
--ui-warning-bg
--ui-warning-border

--ui-success
--ui-success-bg
--ui-success-border

--ui-info
--ui-info-bg
--ui-info-border

--ui-disabled-opacity
--ui-focus-ring
--ui-overlay-bg

--ui-shadow-sm
--ui-shadow-md
--ui-shadow-lg

--ui-z-popover
--ui-z-modal
--ui-z-toast

--ui-icon-size-sm
--ui-icon-size-md
--ui-icon-size-lg

--ui-card-bg
--ui-card-bg-hover
--ui-card-border
```

Estas variables deben derivarse de `--vscode-*` y `--accent-color`, no de colores fijos, salvo excepciones semanticas cuidadosamente mezcladas.

## 6. Archivos que deberian modificarse

Primera prioridad:

- `webview/src/lib/editor.css`: convertirlo en la hoja base del sistema visual.
- `webview/src/App.svelte`: mover o consolidar tokens globales `--ui-*`; idealmente dejar solo layout/app.
- `webview/src/components/NotificationPanel.svelte`: tiene muchos estilos aislados de botones, badges, cards y modal.
- `webview/src/components/NotesList.svelte`: duplica botones, menus, popovers, modales e inputs.
- `webview/src/lib/EntryTitleBar.svelte`: popover menu duplicado.
- `webview/src/components/ReminderEditor.svelte`: toast, badges, selects y estados.
- `webview/src/components/TodoEditor.svelte`: badges, prioridades, cards y estados.
- `webview/src/components/KeyEditor.svelte`: warning, unlock input y cards internas.

Segunda prioridad:

- `webview/src/components/SearchPanel.svelte`.
- `webview/src/components/CategoryTabs.svelte`.
- `webview/src/components/CommandEditor.svelte`.
- `webview/src/components/SnippetEditor.svelte`.
- `webview/src/components/NoteEditor.svelte`.
- `webview/src/lib/DeleteConfirmModal.svelte`.
- `webview/src/lib/SearchToolbar.svelte`.

## 7. Plan de implementacion por fases

### Fase 1: Tokens y base visual

Crear o ampliar el sistema en `editor.css` usando las variables actuales. No cambiar logica ni markup grande. Agregar variables semanticas para error, warning, success, info, focus, overlay y z-index.

### Fase 2: Botones, inputs y formularios

Unificar `.btn`, `.notif-btn`, `.field`, `.form-input`, `.modal-field`, `.delete-code-input`, `.unlock-input`, `.move-select`. Mantener aliases para no tener que cambiar todo de golpe.

### Fase 3: Modales, menus y toasts

Centralizar `.delete-modal`, `.add-modal`, `.form-modal`, `.confirm-modal`, `.menu-popover`, `.menu-item`, `.success-toast`, `.delete-code-toast`.

### Fase 4: Cards, badges y estados

Normalizar cards de entries, todos, reminders, notifications y search results. Crear badges semanticos para prioridad, estado, periodicidad, lenguaje y conteos.

### Fase 5: Componentes especificos

Limpiar CSS local en `NotesList`, `NotificationPanel`, `TodoEditor`, `ReminderEditor`, `KeyEditor`. Dejar solo estilos estructurales o de layout especifico.

### Fase 6: Revision visual

Probar VS Code dark/light, sidebar angosto, menus cerca de bordes, modales, toasts, empty states, focus keyboard y estados danger/error/success.

## 8. Riesgos o puntos delicados

- `EntryTitleBar` y `NotesList` usan `smartPopover`; tocar menus puede reintroducir problemas de z-index/posicion.
- Los colores de categoria y carpeta en `NotesList`/`CategoryTabs` son dinamicos; no conviene eliminarlos, solo encapsularlos mejor.
- Los recordatorios y tareas tienen estados visuales importantes; si se simplifican demasiado, se pierde informacion.
- Los hardcodes de colores de prioridad pueden tener intencion visual; hay que migrarlos a variables semanticas, no borrarlos sin reemplazo.
- Cambiar nombres de clases en muchos componentes puede causar regresiones; mejor primero aliases globales y luego migracion gradual.
- `editor.css` ya se importa desde `App.svelte`, asi que cualquier cambio global puede afectar muchos componentes de una vez.

## Recomendacion inicial

Empezar por una fase pequena y segura: consolidar tokens y aliases globales en `editor.css`, sin cambiar markup. Despues migrar `NotificationPanel.svelte` y `NotesList.svelte`, porque son los que mas estilos aislados tienen y darian mayor consistencia visual rapidamente.
