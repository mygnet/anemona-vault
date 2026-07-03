# Changelog

## 1.0.6 — 2026-06-24
- **Fix: Recordatorios recurrentes se desfasaban en meses cortos** — Los recordatorios mensuales/anuales ahora se ajustan al último día válido del mes destino en lugar de desbordar (ej: 31 Ene + 1 mes → 28 Feb, no 3 Mar). Misma corrección para 29 Feb en años no bisiestos. Aplica tanto al planificador como al editor de recordatorios.
- **Documentación en comandos** — Las entradas de comandos ahora soportan documentación/notas de uso opcionales, con edición, vista expandible, filtrado/búsqueda y exportación a texto/markdown.

## 1.0.5 — 2026-06-18

- **Fix: Estado de vistas no se reiniciaba al cambiar de bóveda** — Al cambiar entre bóvedas (abrir carpeta o recientes), los editores y paneles ya no mantienen contenido obsoleto de la bóveda anterior. Se solucionó limpiando el estado del webview y el `getState()` persistido antes de cargar los datos de la nueva bóveda. Evita confusiones cuando ambas bóvedas comparten nombres de categoría como "Dev".
- **Fix: Índices en editores ordenables** — El ordenamiento en los editores de comandos, claves y fragmentos ahora es solo visual y ya no reordena/guarda la lista interna. Los menús y acciones usan el índice real después de ordenar o filtrar, evitando que agregar, editar, eliminar, copiar o insertar afecten al elemento incorrecto.
- **Fixes: Secciones comunes y notificaciones** — Búsqueda global y Notificaciones ya no heredan el color de la categoría seleccionada; Notificaciones ahora soporta color propio persistido en `.anemona/notifications/.config.json`, el eliminar del historial es un icono compacto alineado a la derecha, y las tarjetas/badges de notificaciones usan colores controlados por el tema.
- **Mejoras visuales y de tema** — Se unificaron encabezados de NotesList, editores, Búsqueda y Notificaciones; se homologaron iconos de regreso; se agregó selector de color personalizado; y se ampliaron controles de tema para modales, formularios, buscadores locales, placeholders, contraste de textos de estado, breadcrumbs, badges e intensidades por sección.

## 1.0.4 — 2026-06-18

- **Sistema de notificaciones** — Nuevo módulo de notificaciones locales para recordatorios y tareas vencidas. Almacenamiento persistente, bandeja de entrada e historial. Contador en el icono de la barra lateral e indicador en el encabezado del panel.
- **Persistencia de estado en notificaciones** — El panel de notificaciones recuerda la pestaña activa (Bandeja/Historial) al cambiar de vista.
- **Internacionalización (i18n)** — Soporte completo de idiomas con detección automática desde VS Code. Selector de idioma en el menú de acciones (Auto / Español / English). Inglés y español incluidos. Agregar un nuevo idioma solo requiere un archivo JSON.
- **Notas de tipo Recordatorio** — Nuevo tipo de nota `.anemona-reminder` con editor dedicado, fecha de vencimiento, acciones (URL/archivo/comando/tarea), y notificaciones automáticas.
- **Notificaciones para recordatorios** — Los recordatorios con fecha de vencimiento generan notificaciones automáticas.
- **Búsqueda y exportación** — Búsqueda de texto completo en recordatorios. Exportación a JSON, texto plano y markdown.
- **Mejoras en interfaz** — Overlay de recarga con animación, indicador de carga inicial, iconos más grandes en la barra lateral, selector visual de tipo de nota, iconos de archivo en encabezados, validación visual con bordes rojos, botón de URL en tarjetas de recordatorio, botón "Agregar" fijo al final y orden normalizado en historial de notificaciones.
- **Fix: Acciones en listas filtradas** — Las acciones (editar, eliminar, copiar, insertar) ahora afectan al elemento correcto cuando hay un filtro activo, en lugar de actuar siempre sobre el primero de la lista.
- **Fix: Búsqueda global incluye nuevos campos** — La búsqueda global ahora encuentra recordatorios por título y tareas por descripción.
- **Fix: Mensaje de importación** — Muestra una confirmación al completar la importación de contenido.
- **UI: Botón para limpiar búsqueda** — Los campos de búsqueda ahora muestran una X para borrar el filtro.
- **UI: Filtro de prioridad en tareas** — Botón de filtro por prioridad (P/T/M/B) restaurado junto a la barra de búsqueda.
- **UI: Estilos unificados** — Los editores ahora comparten estilos comunes para una apariencia más consistente.

## 1.0.3 — 2026-06-15

- **Arrastrar y soltar** — Mové notas y carpetas arrastrándolas. Resaltado visual al pasar el mouse. También funciona sobre los segmentos de la ruta de navegación.
- **Importar contenido** — Importá texto seleccionado o un archivo elegido. Reconoce JSON, pares clave:valor, bloques de código, listas de tareas y comandos. Asigna campos conocidos (usuario, contraseña, email, etc.) y deduce títulos cuando faltan.
- **Importación inteligente desde selección** — Con texto seleccionado en VS Code, al hacer clic en "+" se pre-rellena el modal de agregar con los campos detectados.
- **Botón "Agregar" fijo** — El botón de agregar queda fijo al final del listado cuando hay contenido, y en la parte superior cuando la lista está vacía.
- **Estado persistente** — La extensión recuerda la categoría, subcarpeta y nota abierta al cambiar de vista.

## 1.0.2 — 2026-06-12

- **Fix: Exportación ZIP** — Los archivos ocultos (`.config.json`) ahora se incluyen en la exportación para preservar la configuración de cifrado.
- **Fix: Progreso en subcarpetas** — Guardar tareas desde subcarpetas ya no corrompe el progreso ni crea directorios fantasma.
- **Fix: Color de acento** — El color de acento de carpeta ya no se pierde al volver desde una nota.
- **Mejora: Configuración en cascada** — Las configuraciones se fusionan desde la raíz hacia categoría y subcarpetas. Cada nivel sobrescribe solo propiedades coincidentes.

## 1.0.1 — 2026-06-12

- **Optimización** — Reemplazo de dependencias externas de ZIP con implementación nativa de Node.js. Sin dependencias adicionales.

## 1.0.0 — 2026-06-11

- **Fragmentos de código** — Nuevo tipo de nota `.anemona-snippet` con selector de lenguaje (30+ idiomas), vista previa y copia al portapapeles.
- **Reordenar categorías** — Arrastrá las pestañas para reordenar.
- **Gestión de carpetas** — Crear, renombrar, eliminar y cambiar color de carpetas dentro de categorías.
- **Búsqueda global** — Buscar en todos los tipos de nota desde un panel dedicado.
- **Importar/Exportar bóveda** — Respaldo y restauración mediante ZIP con resolución de conflictos (sobrescribir/saltar).
- **Carpetas recientes** — Acceso rápido a bóvedas recientes desde la pantalla de inicio.
- **Exportar nota** — Exportar notas individuales como JSON, texto plano o markdown.
- **Mover notas** — Mover notas entre categorías y carpetas.
- **Bloquear/desbloquear claves** — Proteger archivos de claves con contraseña mediante cifrado AES-256-GCM.
- **Gestión de categorías** — Crear, renombrar, eliminar categorías con color personalizado.
- **Colores de carpeta** — Color de acento por carpeta.
- **Filtro en línea** — Filtrar entradas dentro de cada editor (claves, comandos, tareas, fragmentos).
- **Diálogos de confirmación** — Confirmación con código para eliminar notas, carpetas y categorías.
- **Mejoras visuales** — Diseño compacto, colores de acento, estados vacíos mejorados.

## 0.1.0 — 2026-06-08

- Versión inicial
- Notas markdown con búsqueda y resaltado
- Gestión de credenciales con cifrado
- Tareas con seguimiento de progreso
- Librería de comandos con copia y ordenamiento
- Almacenamiento local sin dependencias externas
