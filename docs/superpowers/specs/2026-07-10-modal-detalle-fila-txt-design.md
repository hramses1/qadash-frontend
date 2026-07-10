# Modal de detalle de fila — Datos TXT

Fecha: 2026-07-10
Vista afectada: `src/views/TxtData.vue`

## Objetivo

Al hacer clic en una fila de la tabla de Datos TXT, abrir un modal que muestre
todos los datos de ese registro en formato campo/valor, sin el truncado de celda
que sufre la tabla (`max-width: 360px` + ellipsis).

## Alcance

- Clic en **cualquier parte de la fila** abre el modal (incluida la celda `#`).
- El modal muestra la **fila completa**, usando **solo las columnas visibles**
  (`visibleColumns`) — mismo conjunto y orden que la tabla, por lo que respeta
  el ocultado de archivos con error y el toggle "unir archivos".
- Acciones: solo lectura + **Copiar registro** + navegación **‹ Anterior /
  Siguiente ›**.
- Sin cambios de backend ni de `useTxtData`. Los datos ya están en cliente.

## Componente nuevo: `src/components/RowDetailModal.vue`

Props:
- `row: Object | null` — la fila seleccionada; `v-if="row"` controla visibilidad.
- `columns: string[]` — `visibleColumns`.
- `prettyCol: (c: string) => string` — etiqueta legible de columna.
- `index: number` — índice en `visibleRows`.
- `total: number` — `visibleRows.length`.

Emits: `close`, `prev`, `next`.

Estructura:
- `<Teleport to="body">` para escapar el `overflow` de la tabla.
- Overlay oscuro + tarjeta centrada.
- **Header:** `Registro #{{ index + 1 }} de {{ total }}` + botón ✕.
- **Body:** `<dl>` que recorre `columns`; `prettyCol(c)` como `<dt>`, `row[c]`
  como `<dd>` con `white-space: pre-wrap; word-break: break-word` (texto largo
  completo). Scroll vertical si excede altura máxima (`max-height: ~70vh`).
- **Footer:** `‹ Anterior` · `Copiar` · `Siguiente ›`.

Interacción:
- **Cerrar:** botón ✕, clic en overlay (no en la tarjeta), tecla `Esc`.
- **Navegar:** botones y flechas `←`/`→`. `‹` deshabilitado en `index === 0`;
  `›` deshabilitado en `index === total - 1`.
- **Copiar:** `navigator.clipboard.writeText(columns.map(c => prettyCol(c)+': '+
  (row[c] ?? '')).join('\n'))`. Feedback breve "✓ Copiado" ~1.5 s.
- Listeners de teclado (`keydown` sobre `window`) añadidos en `onMounted`,
  retirados en `onUnmounted`.

## Cambios en `TxtData.vue`

- Estado local: `const selectedIndex = ref(-1)`.
- `<tr>` de datos: `@click="selectedIndex = i"`, `cursor: pointer`,
  `title="Ver detalle"`.
- Montar el modal al final del `<template>`:
  ```
  <RowDetailModal
    :row="visibleRows[selectedIndex] ?? null"
    :columns="visibleColumns"
    :prettyCol="prettyCol"
    :index="selectedIndex"
    :total="visibleRows.length"
    @close="selectedIndex = -1"
    @prev="selectedIndex--"
    @next="selectedIndex++"
  />
  ```
- Importar `RowDetailModal` y `ref`.

Seleccionar por **índice sobre `visibleRows`** hace que previo/siguiente salga
gratis y respete siempre los filtros activos.

## Fuera de alcance (YAGNI)

- Copiar valor por campo individual.
- Edición de datos desde el modal.
- Exportar un solo registro.
