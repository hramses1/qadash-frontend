# QA Dash — Frontend

Dashboard web para gestión y ejecución de tests de automatización QA.

## Stack

- **Vue 3** (Composition API, `<script setup>`)
- **Vite** — build tool
- **Socket.io-client** — actualizaciones en tiempo real
- SVG nativo para gráficas (sin dependencias de charting)

## Requisitos

- Node.js 18+
- Backend corriendo en `http://localhost:3001`

## Instalación

```bash
npm install
```

## Ejecución en desarrollo

```bash
npm run dev
```

Abre `http://localhost:5173`

## Build para producción

```bash
npm run build
```

Los archivos estáticos quedan en `dist/`. Pueden servirse desde el propio backend Express con `express.static`.

## Estructura

```
frontend/src/
├── views/
│   ├── Dashboard.vue    # Árbol de tests, ejecución, editor de código
│   ├── Reports.vue      # Historial + analítica con gráficas
│   ├── Settings.vue     # Configuración + automatización (clone/pull)
│   └── EnvEditor.vue    # Editor de variables de entorno
├── components/
│   ├── FolderNode.vue   # Nodo recursivo del árbol de tests
│   ├── TestList.vue     # Lista de tests de un archivo
│   ├── CodeEditor.vue   # Editor de código in-browser
│   ├── ProgressBar.vue
│   └── ResultBadge.vue
├── composables/
│   ├── useSocket.js         # Singleton de Socket.io
│   └── useAutomationState.js # Estado persistente de automatización
├── assets/
│   └── style.css
├── App.vue
└── main.js
```

## Vistas principales

### Dashboard (`/`)
- Árbol de carpetas/archivos/tests con checkboxes
- Ejecutar tests seleccionados con barra de progreso en tiempo real
- Editor de código integrado (click ✏️ en cualquier archivo de test)
- Expandir/colapsar árbol de tests
- Estado persistido en localStorage (selección + expand)
- Caché de colección: al reabrir no necesita re-ejecutar pytest

### Reportes (`/reports`)
- **Tab Historial**: listado de ejecuciones con filtros por fecha/estado
- **Tab Analítica**:
  - Gráfico donut: pasados / fallados / sin ejecutar
  - Tendencia de pass rate por ejecución (línea)
  - Barras por aplicación/archivo con cobertura de ejecución
  - Tabla detallada por app

### Configuración (`/settings`)
- Ruta del proyecto y comando pytest
- Selector nativo de carpetas/archivos
- Sección de automatización: clonar repo, crear venv, instalar dependencias
- Actualizar repo con selector de rama
- Modal de progreso para instalar/actualizar

### Variables (`/env`)
- Editor de archivos `.env`
- Perfiles de variables guardados y reutilizables
