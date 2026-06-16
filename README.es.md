# Anémona Vault

Tu espacio de trabajo de desarrollador dentro de Visual Studio Code.

Organiza todo lo que usas a diario en un solo lugar — notas, secretos, tareas, comandos y fragmentos de código — accesible desde una barra lateral dedicada.

<img src="screenshot/01.gif" alt="Demo de Anémona Vault" width="100%">

## Tipos de nota

| Tipo | Extensión | Icono | Descripción |
|------|-----------|-------|-------------|
| Texto | `.md` | 📄 | Notas markdown con búsqueda por texto |
| Clave | `.anemona-key` / `.anemona-lock` | 🔑 / 🔒 | Secrets cifrados, contraseñas, tokens de API |
| Comando | `.anemona-command` | ⌘ | Comandos de shell reutilizables con copiado |
| Todo | `.anemona-todo` | ☑️ | Tareas con progreso, prioridades y fechas de vencimiento |
| Snippet | `.anemona-snippet` | 📋 | Fragmentos de código con lenguaje y copiado |

## Gestión del vault

- **Múltiples vaults** — cambia entre carpetas de trabajo desde la barra lateral
- **Categorías** — agrupa notas en secciones con colores personalizados
- **Carpetas** — organiza notas dentro de categorías con anidamiento arbitrario
- **Cifrado** — bloquea/desbloquea archivos `.anemona-key` con contraseña (AES-256-GCM)
- **Importar / Exportar** — backup y restauración del vault completo vía ZIP
- **Búsqueda** — búsqueda global en todos los tipos de nota y categorías

## UX

- **Barra lateral compacta** — Diseño responsivo para la barra estrecha de VS Code
- **Colores de acento** — Tema de color por categoría
- **Arrastrar y soltar** — Mueve archivos y carpetas arrastrándolos sobre una carpeta destino. También funciona sobre las migas de pan (Home o cualquier carpeta en la ruta).
- **Filtrado** — Filtro inline para las entradas de cada tipo de nota
- **Diálogos de confirmación** — Confirmación de eliminación con código para evitar pérdidas accidentales

## Funcionalidades por tipo

- **Markdown** — edición completa con búsqueda y resaltado
- **Claves** — agrega/edita/elimina credenciales (título, usuario, contraseña, email, URL, host, puerto, token, notas); copia valores al portapapeles
- **Comandos** — almacena y copia comandos de shell; ordena y filtra por nombre
- **Tareas** — progreso (0–100%), prioridad (baja/media/alta), fechas de vencimiento, marca como completada o cancelada
- **Snippets** — código con 30+ lenguajes disponibles, copia al portapapeles, filtra y ordena

## Galería

<table>
  <tr>
    <td width="50%">
      <img src="screenshot/02.gif" alt="Arrastrar y soltar carpetas" width="100%">
      <br>
      <em>Arrastrar y soltar — mueve carpetas entre categorías</em>
    </td>
    <td width="50%">
      <img src="screenshot/03.gif" alt="Comandos y snippets" width="100%">
      <br>
      <em>Comandos & snippets — agrega, edita y organiza</em>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshot/04.gif" alt="Snippets y tareas" width="100%">
      <br>
      <em>Snippets & tareas — filtra, ordena, cambia estados</em>
    </td>
    <td width="50%">
      <img src="screenshot/05.gif" alt="Markdown y claves" width="100%">
      <br>
      <em>Notas markdown & claves — copia contraseñas con un clic</em>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="screenshot/09.gif" alt="Gestión de tareas" width="100%">
      <br>
      <em>Tareas — vista detallada con progreso, prioridad y fechas</em>
    </td>
    <td width="50%">
      <img src="screenshot/10.gif" alt="Bloquear archivo key" width="100%">
      <br>
      <em>Bloquear — protege archivos key con contraseña</em>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <img src="screenshot/11.gif" alt="Desbloquear archivo key" width="100%">
      <br>
      <em>Desbloquear — abre archivos protegidos con tu contraseña</em>
    </td>
  </tr>
</table>

## Almacenamiento

Todos los datos se almacenan como archivos planos en tu sistema de archivos local. Puedes elegir cualquier carpeta como raíz de tu vault.

```
vault/
├── .config.json             # config del vault (clave de cifrado, colores)
├── Notes/
│   ├── .config.json         # config de categoría (color, icono)
│   ├── meeting-notes.md
│   ├── apis.anemona-key
│   ├── deploy.anemona-command
│   ├── ideas.anemona-snippet
│   └── subfolder/
│       └── references.md
└── Projects/
    └── ...
```

## Importante

Al copiar un vault o alguna de sus carpetas internas, **incluye siempre el archivo `.config.json`**. Este archivo contiene la configuración y la clave de cifrado necesaria para acceder a las entradas protegidas.

## Historial de cambios

Ver [CHANGELOG.md](./CHANGELOG.md).
