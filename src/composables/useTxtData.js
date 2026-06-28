import { ref, computed, watch } from 'vue'

/**
 * Estado, filtros y exportación de la vista Datos TXT.
 * Una sola fuente de verdad (`rows`); todo lo demás se deriva.
 *
 * @typedef {Record<string, any>} TxtRow
 */

const META_COLS = ['_archivo', '_linea']

/**
 * Parsea una celda a Date. Soporta:
 *  - DD/MM/YYYY [ - HH:MM]
 *  - YYYY-MM-DD
 *  - fecha embebida en nombre de archivo (_YYYY-MM-DD_)
 * @param {unknown} v
 * @returns {Date | null}
 */
export function parseCellDate(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  m = s.match(/(?:^|[_\s])(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  return null
}

export function useTxtData() {
  // ── Estado base (fuente de verdad) ──
  const loading = ref(false)
  const configured = ref(true)
  const error = ref('')
  const folder = ref('')
  const fileCount = ref(0)
  const columns = ref(/** @type {string[]} */ ([]))
  const rows = ref(/** @type {TxtRow[]} */ ([]))
  const parseErrors = ref([])
  const files = ref(/** @type {string[]} */ ([]))

  // ── Filtros ──
  const mergeFiles = ref(false)
  const fileFilter = ref('')
  const search = ref('')
  const dateColumn = ref('')
  const dateFrom = ref('')
  const dateTo = ref('')
  const company = ref('')

  // ── Derivados ──
  function prettyCol(c) {
    if (c === '_archivo') return 'Archivo'
    if (c === '_linea') return 'Línea'
    return c
  }

  // Columnas mayormente fecha (≥60% de valores parseables)
  const dateColumns = computed(() =>
    columns.value.filter(c => {
      if (c === '_linea') return false
      let total = 0, ok = 0
      for (const r of rows.value) {
        const v = r[c]
        if (v == null || v === '') continue
        total++
        if (parseCellDate(v)) ok++
        if (total >= 80) break
      }
      return total > 0 && ok / total >= 0.6
    })
  )

  // Columna de empresa (primera que coincida por nombre)
  const companyColumn = computed(() =>
    columns.value.find(c => /empresa|compa(ñ|n)|company|cliente/i.test(c)) || ''
  )

  // Valores distintos de empresa, ordenados
  const companyValues = computed(() => {
    if (!companyColumn.value) return []
    const set = new Set()
    for (const r of rows.value) {
      const v = String(r[companyColumn.value] ?? '').trim()
      if (v) set.add(v)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  })

  // ── Archivos con error / vacíos ──
  // Marcador de comprobantes ilegibles (dump HTML). Esos archivos se ocultan.
  const ERROR_RE = /no se pudo leer el comprobante|revisar dump html/i

  // Set de archivos cuyo contenido indica error de lectura.
  const erroredFiles = computed(() => {
    const set = new Set()
    for (const r of rows.value) {
      if (set.has(r._archivo)) continue
      for (const c of columns.value) {
        if (c === '_archivo' || c === '_linea') continue
        if (ERROR_RE.test(String(r[c] ?? ''))) { set.add(r._archivo); break }
      }
    }
    return set
  })
  const erroredCount = computed(() => erroredFiles.value.size)

  // Mostrar/ocultar los archivos con error (oculto por defecto).
  const showErrored = ref(false)

  const hasFilters = computed(() =>
    !!fileFilter.value ||
    !!search.value.trim() ||
    !!company.value ||
    (!!dateColumn.value && (!!dateFrom.value || !!dateTo.value))
  )

  // Filas tras aplicar TODOS los filtros: archivo → empresa → búsqueda → fecha.
  // El Excel se exporta exactamente desde aquí, así que descarga = lo filtrado.
  const visibleRows = computed(() => {
    let out = rows.value
    // Oculta archivos con error salvo que se pidan explícitamente.
    if (!showErrored.value && erroredFiles.value.size) {
      out = out.filter(r => !erroredFiles.value.has(r._archivo))
    }
    if (fileFilter.value) {
      out = out.filter(r => r._archivo === fileFilter.value)
    }
    if (company.value && companyColumn.value) {
      out = out.filter(r => String(r[companyColumn.value] ?? '').trim() === company.value)
    }
    const q = search.value.trim().toLowerCase()
    if (q) {
      out = out.filter(r => columns.value.some(c => String(r[c] ?? '').toLowerCase().includes(q)))
    }
    if (dateColumn.value && (dateFrom.value || dateTo.value)) {
      const from = dateFrom.value ? new Date(dateFrom.value + 'T00:00:00') : null
      const to = dateTo.value ? new Date(dateTo.value + 'T23:59:59') : null
      out = out.filter(r => {
        const d = parseCellDate(r[dateColumn.value])
        if (!d) return false
        if (from && d < from) return false
        if (to && d > to) return false
        return true
      })
    }
    return out
  })

  // Columnas a mostrar: solo las que tienen algún valor en las filas visibles.
  // Así, al ocultar los archivos con error desaparecen sus columnas (_linea,
  // contenido) que ensucian la tabla; al mostrarlos, vuelven a aparecer.
  const visibleColumns = computed(() => {
    const rowsV = visibleRows.value
    return columns.value.filter(c => {
      if (c === '_archivo') return true
      return rowsV.some(r => String(r[c] ?? '').trim() !== '')
    })
  })

  function clearFilters() {
    fileFilter.value = ''
    search.value = ''
    company.value = ''
    dateFrom.value = ''
    dateTo.value = ''
    showErrored.value = false
  }

  // Autoselecciona la primera columna de fecha (prioriza "ingreso"/"fecha")
  watch(dateColumns, (cols) => {
    if (dateColumn.value && cols.includes(dateColumn.value)) return
    const preferred = cols.find(c => /ingreso|fecha/i.test(c))
    dateColumn.value = preferred || cols[0] || ''
  })

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const res = await fetch('/api/txtdata')
      const data = await res.json()
      configured.value = data.configured !== false
      if (data.error) {
        error.value = data.error
        rows.value = []
        columns.value = []
        return
      }
      folder.value = data.folder || ''
      fileCount.value = data.fileCount || 0
      columns.value = data.columns || []
      rows.value = data.rows || []
      parseErrors.value = data.errors || []
      files.value = data.files || []
      clearFilters()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  /** Exporta SOLO las filas filtradas (`visibleRows`) a un .xlsx. */
  async function downloadExcel() {
    if (visibleRows.value.length === 0) return
    const XLSX = await import('xlsx')
    // Exporta las columnas visibles; omite origen (_archivo/_linea) al unir.
    const exportCols = mergeFiles.value
      ? visibleColumns.value.filter(c => !META_COLS.includes(c))
      : visibleColumns.value
    const header = exportCols.map(prettyCol)
    const body = visibleRows.value.map(r => exportCols.map(c => r[c]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Datos TXT')
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const name = mergeFiles.value ? `datos-txt-unidos-${ts}.xlsx` : `datos-txt-${ts}.xlsx`
    XLSX.writeFile(wb, name)
  }

  return {
    // estado
    loading, configured, error, folder, fileCount, columns, rows, parseErrors, files,
    // filtros
    mergeFiles, fileFilter, search, dateColumn, dateFrom, dateTo, company,
    showErrored,
    // derivados
    dateColumns, companyColumn, companyValues, hasFilters, visibleRows, visibleColumns,
    erroredFiles, erroredCount,
    // acciones
    prettyCol, clearFilters, load, downloadExcel
  }
}
