Extensión VS Code: Notes Sidebar

Extensión para gestionar notas organizadas por pestañas/categorías desde la barra lateral de VS Code. La interfaz visual se renderizará con Svelte dentro de un Webview View, permitiendo navegar categorías, listar notas, crear nuevas notas y visualizar/editar su contenido.

Objetivo

Crear una extensión tipo panel lateral donde el usuario pueda:

Seleccionar una categoría o pestaña.

Ver las notas asociadas a esa categoría.

Crear una nueva nota dentro de la categoría seleccionada.

Abrir una nota al hacer clic.

Visualizar y editar el contenido en formato Markdown.

Definir la carpeta donde se almacenarán las notas.

Arquitectura recomendada
1. VS Code Extension Host

Responsable de:

Registrar la extensión.

Crear la vista en el sidebar.

Manejar comandos.

Leer y escribir archivos.

Guardar configuración del usuario.

Comunicar datos al Webview.

2. Svelte Webview

Responsable de la interfaz visual:

Menú lateral tipo pestañas.

Lista de archivos/notas.

Botón para agregar nota.

Vista del contenido Markdown.

Eventos de clic, creación, edición y selección.

3. Sistema de almacenamiento

Recomendación inicial: archivos Markdown planos.

Ejemplo:

notes/
├── onboarding/
│   ├── bienvenida.md
│   └── checklist.md
├── administration/
│   └── tareas.md
├── meetings/
│   └── junta-inicial.md
└── product-ideas/
    └── nueva-idea.md

Ventajas:

Fácil de respaldar.

Compatible con Git.

Editable fuera de la extensión.

No depende de base de datos.

Más natural para notas Markdown.

SQLite puede dejarse para una segunda fase si después quieres búsqueda avanzada, etiquetas, historial o metadatos complejos.

Configuración de la extensión

Agregar configuraciones en package.json:

"configuration": {
  "title": "Notes Sidebar",
  "properties": {
    "notesSidebar.storagePath": {
      "type": "string",
      "default": "",
      "description": "Ruta donde se almacenarán las notas Markdown"
    },
    "notesSidebar.defaultCategories": {
      "type": "array",
      "default": [
        "Onboarding",
        "Administration",
        "Meetings",
        "Product Ideas",
        "Email List",
        "Customers",
        "Website",
        "Schedules",
        "Resources",
        "Inventory"
      ],
      "description": "Categorías iniciales de notas"
    }
  }
}
Estructura sugerida del proyecto
vscode-notes-sidebar/
├── src/
│   ├── extension.ts
│   ├── views/
│   │   └── NotesViewProvider.ts
│   ├── services/
│   │   ├── NotesService.ts
│   │   └── ConfigService.ts
│   └── types/
│       └── notes.ts
├── webview/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── components/
│   │   │   ├── CategoryTabs.svelte
│   │   │   ├── NotesList.svelte
│   │   │   └── NoteEditor.svelte
│   │   └── main.ts
│   └── vite.config.ts
├── media/
├── package.json
└── tsconfig.json
Flujo principal
1. Al iniciar la extensión

La extensión revisa si existe una carpeta configurada para las notas.

Si no existe, muestra opción para seleccionar una carpeta.

Después crea la estructura inicial de categorías si no existe.

2. Al abrir el sidebar

La extensión carga las categorías.

Lee los archivos .md de cada carpeta.

Envía la información al Webview de Svelte.

3. Al seleccionar una categoría

Svelte envía el evento:

selectCategory

La extensión responde con la lista de notas de esa categoría.

4. Al crear una nota

El usuario da clic en “Nueva nota”.

Se solicita nombre de la nota.

Se crea un archivo .md dentro de la categoría actual.

Ejemplo:

meetings/reunion-cliente.md
5. Al abrir una nota

Se lee el archivo Markdown.

El contenido se envía al Webview.

Se muestra en editor visual o textarea Markdown.

6. Al guardar cambios

Svelte envía el contenido actualizado.

La extensión sobrescribe el archivo .md.

Comunicación entre Svelte y VS Code

La comunicación se hace con mensajes:

vscode.postMessage({
  command: 'createNote',
  category: 'Meetings',
  title: 'Nueva reunión'
});

Y desde la extensión hacia Svelte:

webview.postMessage({
  command: 'notesLoaded',
  notes: [...]
});
Comandos recomendados
notesSidebar.selectStorageFolder
notesSidebar.createNote
notesSidebar.createCategory
notesSidebar.refresh
notesSidebar.openNote
notesSidebar.deleteNote
Sidebar en VS Code

En package.json se registra una vista:

"viewsContainers": {
  "activitybar": [
    {
      "id": "notesSidebar",
      "title": "Notes",
      "icon": "media/icon.svg"
    }
  ]
},
"views": {
  "notesSidebar": [
    {
      "id": "notesSidebar.view",
      "name": "Notes"
    }
  ]
}
Fases sugeridas
Fase 1

Crear extensión base.

Registrar sidebar.

Renderizar Webview con Svelte.

Mostrar categorías estáticas.

Mostrar notas de ejemplo.

Fase 2

Permitir seleccionar carpeta de almacenamiento.

Leer carpetas reales.

Leer archivos Markdown.

Crear nuevas notas.

Abrir contenido de notas.

Fase 3

Editar y guardar Markdown.

Crear categorías.

Eliminar notas.

Renombrar notas.

Refrescar vista.

Fase 4

Agregar buscador.

Agregar etiquetas.

Agregar favoritos.

Agregar ordenamiento.

Agregar vista previa Markdown.

Fase 5

Evaluar SQLite solo si se requiere:

búsqueda avanzada,

metadatos,

historial,

sincronización,

relaciones entre notas,

estado de lectura,

etiquetas complejas.

Recomendación final

Para iniciar, conviene hacerlo con archivos Markdown en carpetas, no SQLite.



Si quieres, el siguiente paso ya sería una última unificación global:
1. radios exactos en toda la app
2. alturas de botones uniformes
3. paddings uniformes entre todos los editores


Para el caso del los estatus cuando lo cambios y d eigual manera cuando marco la tarea como terminada no se estan actualizando los fintros.. y aparte en este caso el color del estatus si debe ser el color de la tarea.. es decir decuardo a la prioridad como semafor..  ya sabes.&