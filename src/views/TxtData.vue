<template>
  <div class="view-container">
    <div class="page-head">
      <h1 class="view-title">Datos TXT</h1>
      <div class="head-actions">
        <label class="merge-toggle" title="Une todos los archivos omitiendo las columnas Archivo y Línea">
          <input type="checkbox" v-model="mergeFiles" />
          <span>Unir archivos (omitir origen)</span>
        </label>
        <button class="btn btn-secondary" @click="load" :disabled="loading">
          {{ loading ? 'Cargando...' : '↺ Refrescar' }}
        </button>
        <button
          class="btn btn-primary"
          @click="downloadExcel"
          :disabled="loading || visibleRows.length === 0"
          :title="hasFilters ? 'Descarga solo las filas filtradas' : 'Descarga todas las filas'"
        >
          ⬇️ Descargar Excel ({{ visibleRows.length }})
        </button>
      </div>
    </div>

    <!-- Sin carpeta configurada -->
    <div v-if="!loading && !configured" class="card empty-card">
      <p class="hint-text">
        No hay carpeta de archivos <code>.txt</code> configurada.
        Ve a <RouterLink to="/settings">Configuración</RouterLink> y selecciona la carpeta.
      </p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="alert alert-error">❌ {{ error }}</div>

    <!-- Datos -->
    <template v-else>
      <div v-if="configured" class="meta-bar">
        <span class="meta-item">{{ fileCount }} archivo{{ fileCount !== 1 ? 's' : '' }}</span>
        <span class="meta-item">
          {{ visibleRows.length }} de {{ rows.length }} fila{{ rows.length !== 1 ? 's' : '' }}
        </span>
        <button
          v-if="erroredCount > 0"
          class="error-toggle"
          :class="{ on: showErrored }"
          @click="showErrored = !showErrored"
          :title="showErrored ? 'Ocultar archivos con error' : 'Mostrar archivos con error de lectura'"
        >
          ⚠️ {{ erroredCount }} con error · {{ showErrored ? 'ocultar' : 'mostrar' }}
        </button>
      </div>

      <!-- Barra de filtros -->
      <div v-if="rows.length > 0" class="card filter-card">
        <div class="filter-row">
          <div class="filter-field grow">
            <label class="filter-label">Buscar</label>
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                v-model="search"
                class="filter-input"
                placeholder="Buscar en todas las columnas..."
              />
              <button v-if="search" class="clear-x" @click="search = ''" title="Limpiar">✕</button>
            </div>
          </div>

          <div class="filter-field" v-if="files.length > 1">
            <label class="filter-label">Archivo</label>
            <select v-model="fileFilter" class="filter-input">
              <option value="">— Todos ({{ files.length }}) —</option>
              <option v-for="f in files" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <div class="filter-field" v-if="companyColumn">
            <label class="filter-label">{{ prettyCol(companyColumn) }}</label>
            <select v-model="company" class="filter-input">
              <option value="">— Todas —</option>
              <option v-for="c in companyValues" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="filter-field" v-if="dateColumns.length">
            <label class="filter-label">Filtrar por fecha</label>
            <select v-model="dateColumn" class="filter-input">
              <option value="">— Sin filtro —</option>
              <option v-for="c in dateColumns" :key="c" :value="c">{{ prettyCol(c) }}</option>
            </select>
          </div>

          <div class="filter-field" v-if="dateColumn">
            <label class="filter-label">Desde</label>
            <input type="date" v-model="dateFrom" class="filter-input" />
          </div>

          <div class="filter-field" v-if="dateColumn">
            <label class="filter-label">Hasta</label>
            <input type="date" v-model="dateTo" class="filter-input" />
          </div>

          <button v-if="hasFilters" class="btn btn-ghost clear-btn" @click="clearFilters">
            Limpiar filtros
          </button>
        </div>
      </div>

      <div v-if="parseErrors.length" class="alert alert-error">
        ⚠️ Errores al leer: {{ parseErrors.map(e => e.file).join(', ') }}
      </div>

      <div class="card table-card">
        <div v-if="loading" class="empty-state">Cargando datos...</div>
        <div v-else-if="rows.length === 0" class="empty-state">
          No se encontraron datos en los archivos .txt.
        </div>
        <div v-else-if="visibleRows.length === 0" class="empty-state">
          Ninguna fila coincide con los filtros.
          <button class="btn-link" @click="clearFilters">Limpiar filtros</button>
        </div>
        <div v-else class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th class="idx-col">#</th>
                <th v-for="c in visibleColumns" :key="c">{{ prettyCol(c) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in visibleRows"
                :key="i"
                class="row-clickable"
                title="Ver detalle"
                @click="selectedIndex = i"
              >
                <td class="idx-col">{{ i + 1 }}</td>
                <td v-for="c in visibleColumns" :key="c" :title="row[c]">{{ row[c] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTxtData } from '../composables/useTxtData'
import RowDetailModal from '../components/RowDetailModal.vue'

const {
  loading, configured, error, folder, fileCount, columns, rows, parseErrors, files,
  mergeFiles, fileFilter, search, dateColumn, dateFrom, dateTo, company, showErrored,
  dateColumns, companyColumn, companyValues, hasFilters, visibleRows, visibleColumns, erroredCount,
  prettyCol, clearFilters, load, downloadExcel
} = useTxtData()

const selectedIndex = ref(-1)

onMounted(load)
</script>

<style scoped>
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;
}
.head-actions { display: flex; align-items: center; gap: .75rem; }
.merge-toggle {
  display: flex; align-items: center; gap: .4rem;
  font-size: .85rem; cursor: pointer; user-select: none; opacity: .85;
}
.merge-toggle input { cursor: pointer; }

.meta-bar {
  display: flex; gap: 1.25rem; flex-wrap: wrap;
  font-size: .85rem; opacity: .8; margin-bottom: .75rem;
}
.meta-item code { word-break: break-all; }
.error-toggle {
  border: 1px solid #fcd34d; background: #fffbeb; color: #b45309;
  border-radius: 99px; padding: .15rem .7rem; font-size: .78rem; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.error-toggle:hover { background: #fef3c7; border-color: #f59e0b; }
.error-toggle.on { background: #b45309; border-color: #b45309; color: #fff; }

.files-card { padding: 1rem; margin-bottom: 1rem; }
.files-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: .75rem;
}
.files-title { font-weight: 600; font-size: .9rem; }
.btn-link {
  background: none; border: none; cursor: pointer;
  color: #6366f1; font-size: .82rem; font-weight: 500; padding: 0;
}
.btn-link:hover { text-decoration: underline; }
.files-grid { display: flex; flex-wrap: wrap; gap: .5rem; }
.file-chip {
  display: flex; align-items: center; gap: .4rem;
  padding: .35rem .7rem; border-radius: 99px; cursor: pointer;
  border: 1px solid var(--border, #e2e8f0); font-size: .82rem;
  user-select: none; transition: all .15s;
}
.file-chip input { cursor: pointer; }
.file-chip-on { background: rgba(99,102,241,.12); border-color: #6366f1; color: #6366f1; }

/* --- Barra de filtros --- */
.filter-card { padding: 1rem; margin-bottom: 1rem; }
.filter-row {
  display: flex; flex-wrap: wrap; align-items: flex-end; gap: .75rem;
}
.filter-field { display: flex; flex-direction: column; gap: .3rem; min-width: 150px; }
.filter-field.grow { flex: 1 1 240px; }
.filter-label {
  font-size: .72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: .03em; opacity: .6;
}
.filter-input {
  height: 38px; padding: 0 .7rem; font-size: .85rem;
  border: 1px solid var(--border, #e2e8f0); border-radius: 8px;
  background: var(--bg, #fff); color: inherit; width: 100%;
  transition: border-color .15s, box-shadow .15s;
}
.filter-input:focus {
  outline: none; border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}
.search-box { position: relative; display: flex; align-items: center; }
.search-icon {
  position: absolute; left: .6rem; font-size: .8rem; opacity: .5; pointer-events: none;
}
.search-box .filter-input { padding-left: 2rem; padding-right: 2rem; }
.clear-x {
  position: absolute; right: .5rem; border: none; background: none;
  cursor: pointer; font-size: .8rem; opacity: .5; line-height: 1;
}
.clear-x:hover { opacity: 1; }
.btn-ghost {
  background: none; border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px; height: 38px; padding: 0 .9rem;
  cursor: pointer; font-size: .82rem; color: inherit;
}
.btn-ghost:hover { border-color: #6366f1; color: #6366f1; }

.table-card { padding: 0; overflow: hidden; border: 1px solid #e2e8f0; }
.table-scroll { overflow: auto; max-height: 72vh; }
.data-table {
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: .85rem;
}
.data-table th, .data-table td {
  padding: .6rem .9rem; text-align: left;
  border-bottom: 1px solid #f1f5f9;
  white-space: nowrap; max-width: 360px;
  overflow: hidden; text-overflow: ellipsis;
}
.data-table td { color: #334155; }

/* Header sticky con realce y sombra al hacer scroll */
.data-table thead th {
  position: sticky; top: 0; z-index: 2;
  background: #f8fafc;
  color: #475569; font-weight: 700;
  font-size: .72rem; text-transform: uppercase; letter-spacing: .04em;
  border-bottom: 2px solid #e2e8f0;
  box-shadow: 0 1px 0 #e2e8f0;
}

/* Columna índice fija a la izquierda */
.idx-col {
  width: 1%; text-align: right; color: #94a3b8;
  font-variant-numeric: tabular-nums; padding-right: 1rem;
  position: sticky; left: 0;
}
th.idx-col { z-index: 3; background: #f1f5f9; }
td.idx-col { background: #fff; border-right: 1px solid #eef2f7; }

.data-table tbody tr:nth-child(even) td { background: #fbfcfe; }
.data-table tbody tr:nth-child(even) td.idx-col { background: #f6f8fc; }
.row-clickable { cursor: pointer; }
.data-table tbody tr:hover td { background: #eef2ff; }
.data-table tbody tr:hover td.idx-col { background: #e6ebfd; color: #4f46e5; }
.data-table tbody tr:last-child td { border-bottom: none; }

.empty-state { padding: 2.5rem; text-align: center; opacity: .6; }
.empty-card { padding: 1.5rem; }
</style>
