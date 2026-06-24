# Notification System — Status Analysis

## ✅ Pasan correctamente

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | Abrir bóveda → carga tareas/recordatorios | ✅ `ScheduledEventsCache.rebuild()` escanea todos los archivos `.anemona-reminder` y `.anemona-todo` |
| 2 | Revisa fechas activas | ✅ Scheduler compara `dueAt` vs `now` cada ~5s |
| 3 | Si no llegó la hora, no hace nada | ✅ `if (dueMinute > nowMinute) continue` |
| 4 | Cuando llega la hora, genera notificación | ✅ `createAndShow()` la crea y muestra un `showInformationMessage` |
| 5 | Solo avisa, no reemplaza | ✅ Nunca modifica los archivos fuente |
| 6 | Tarea/recordatorio sigue existiendo | ✅ Sistema es read-only respecto a source files |
| 7 | Si completas, no notifica de nuevo | ✅ **FIXED** — se invirtió el orden: `_syncScheduledEventsFile` antes que `_cleanupTodoKeys`/`_cleanupReminderKeys` |
| 8 | Vencido pero no completado → overdue/soon | ✅ **FIXED** — `dueSoonHours` ahora genera `task_due_soon` y `task_overdue` |
| 9 | No refirear al abrir la bóveda | ✅ **FIXED** — `rebuild()` preserva el estado `notified` del cache anterior |
| 10 | Únicos: notifica una vez | ✅ |
| 12 | Inbox/history guarda lo notificado | ✅ `inbox.json` + `history/page-NNNN.json` |
| 13 | Panel de tareas/recordatorios muestra pendientes | ✅ |
| 14 | Notificación es solo aviso visual | ✅ |

## ❌ Pendiente / No aplica

| # | Requisito | Estado |
|---|-----------|--------|
| 11 | Periódicos: notifica una vez por ciclo | ❌ **No implementado**: No hay campo `interval` ni lógica de recurrencia. Todos son one-shot. |

## Otros gaps menores

- **`removeGeneratedKeysByPrefix`**: El método existe pero nunca se llama.
- **`system` type**: Definido en tipos y UI, pero ningún código crea notificaciones de tipo `system`.
