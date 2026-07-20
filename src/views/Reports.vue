<template>
  <div class="view-container">

    <!-- Page header + tabs -->
    <div class="rp-header">
      <h1 class="view-title" style="margin:0">Reportes</h1>
      <div class="rp-tabs">
        <button class="rp-tab" :class="{ active: activeTab === 'list' }" @click="switchTab('list')">
          <span class="rp-tab-icon">📋</span>
          <span>Historial</span>
        </button>
        <button class="rp-tab rp-tab-analytics" :class="{ active: activeTab === 'analytics' }" @click="switchTab('analytics')">
          <span class="rp-tab-icon">📊</span>
          <span>Analítica</span>
          <span v-if="stats?.totalRuns" class="rp-tab-badge">{{ stats.totalRuns }}</span>
        </button>
      </div>
    </div>

    <!-- ═══════════════════ HISTORIAL TAB ═══════════════════ -->
    <template v-if="activeTab === 'list'">

      <template v-if="!selectedReport">
        <!-- Filters -->
        <div v-if="reports.length > 0" class="filters-card">
          <div class="filters-row">
            <div class="filter-group">
              <label class="filter-label">Desde</label>
              <input v-model="filters.dateFrom" type="date" class="input filter-input" />
            </div>
            <div class="filter-group">
              <label class="filter-label">Hasta</label>
              <input v-model="filters.dateTo" type="date" class="input filter-input" />
            </div>
            <div class="filter-group">
              <label class="filter-label">Mín. pasados ≥</label>
              <input v-model.number="filters.minPassed" type="number" min="0" class="input filter-input filter-input-num" placeholder="0" />
            </div>
            <div class="filter-group">
              <label class="filter-label">Mín. fallidos ≥</label>
              <input v-model.number="filters.minFailed" type="number" min="0" class="input filter-input filter-input-num" placeholder="0" />
            </div>
            <div class="filter-group filter-group-status">
              <label class="filter-label">Estado</label>
              <select v-model="filters.status" class="input filter-input">
                <option value="">Todos</option>
                <option value="clean">Sin fallos</option>
                <option value="failed">Con fallos</option>
              </select>
            </div>
            <button v-if="hasActiveFilters" class="btn btn-secondary btn-sm filter-clear" @click="clearFilters">
              ✕ Limpiar
            </button>
          </div>
          <div class="filter-count">
            {{ filteredReports.length }} de {{ reports.length }} reporte{{ reports.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <div v-if="!reports.length" class="empty-state">
          No hay reportes. Ejecuta algunos tests primero.
        </div>
        <div v-else-if="filteredReports.length === 0" class="empty-state">
          Ningún reporte coincide con los filtros.
        </div>

        <div v-else class="reports-list">
          <div v-for="report in filteredReports" :key="report.id" class="report-card" @click="viewReport(report.id)">
            <div class="report-meta">
              <span class="report-date">{{ formatDate(report.timestamp) }}</span>
              <div class="report-actions" @click.stop>
                <a :href="apiUrl(`/api/reports/${report.id}/download/json`)" class="btn btn-sm btn-secondary" download>↓ JSON</a>
                <a :href="apiUrl(`/api/reports/${report.id}/download/html`)" class="btn btn-sm btn-secondary" target="_blank">↗ HTML</a>
                <button class="btn btn-sm btn-danger" @click="deleteReport(report.id)">Eliminar</button>
              </div>
            </div>
            <div class="report-summary">
              <span class="badge badge-passed">✅ {{ report.summary.passed }} passed</span>
              <span class="badge badge-failed">❌ {{ (report.summary.failed || 0) + (report.summary.errors || 0) }} failed</span>
              <span class="badge">{{ report.summary.total }} total</span>
              <span class="badge">⏱ {{ formatDurationLong(report.summary.duration) }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- Report detail -->
      <template v-else>
        <div class="report-detail-header">
          <button class="btn btn-secondary no-print" @click="selectedReport = null">← Volver</button>
          <h2>{{ formatDate(selectedReport.timestamp) }}</h2>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-pdf no-print" @click="printReportPDF">⬇ PDF</button>
            <a :href="apiUrl(`/api/reports/${selectedReport.id}/download/json`)" class="btn btn-sm btn-secondary no-print" download>↓ JSON</a>
            <a :href="apiUrl(`/api/reports/${selectedReport.id}/download/html`)" class="btn btn-sm btn-secondary no-print" target="_blank">↗ HTML</a>
          </div>
        </div>
        <div class="summary-cards">
          <div class="stat-card"><div class="stat-num">{{ selectedReport.summary.total }}</div><div class="stat-label">Total</div></div>
          <div class="stat-card passed"><div class="stat-num">{{ selectedReport.summary.passed }}</div><div class="stat-label">Pasaron</div></div>
          <div class="stat-card failed"><div class="stat-num">{{ (selectedReport.summary.failed || 0) + (selectedReport.summary.errors || 0) }}</div><div class="stat-label">Fallaron</div></div>
          <div class="stat-card"><div class="stat-num">{{ formatDuration(selectedReport.summary.duration) }}</div><div class="stat-label">Duración</div></div>
          <div class="stat-card"><div class="stat-num">{{ passRate }}%</div><div class="stat-label">Pass Rate</div></div>
        </div>
        <div class="tests-detail">
          <div v-for="mod in testModules" :key="mod.key" class="module-group">
            <div class="module-header" @click="toggleModule(mod.key)">
              <span class="module-caret">{{ expandedModules.has(mod.key) ? '▾' : '▸' }}</span>
              <span class="module-name">📦 {{ mod.name }}</span>
              <span class="module-badges">
                <span class="badge badge-passed">✅ {{ mod.passed }}</span>
                <span v-if="mod.failed" class="badge badge-failed">❌ {{ mod.failed }}</span>
                <span class="badge">{{ mod.tests.length }} test{{ mod.tests.length !== 1 ? 's' : '' }}</span>
                <span class="badge">⏱ {{ formatDuration(mod.duration) }}</span>
              </span>
            </div>

            <div v-show="expandedModules.has(mod.key)" class="module-tests">
              <div v-for="test in mod.tests" :key="test.id" class="test-detail-row" :class="`status-${test.status}`">
                <div class="test-detail-header" @click="test._expanded = !test._expanded">
                  <span class="test-status-icon">{{ test.status === 'passed' ? '✅' : test.status === 'failed' ? '❌' : '⚠️' }}</span>
                  <span class="test-detail-id">{{ test.id }}</span>
                  <span class="test-duration">{{ formatDuration(test.duration) }}</span>
                  <span class="expand-icon" v-if="test.errorMsg || test.output">{{ test._expanded ? '▾' : '▸' }}</span>
                </div>
                <div v-if="test._expanded && (test.errorMsg || test.output)" class="test-output">
                  <pre>{{ test.errorMsg || test.output }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </template>

    <!-- ═══════════════════ ANALÍTICA TAB ═══════════════════ -->
    <template v-else>

      <div v-if="statsLoading" class="analytics-loading">
        <span class="spinner">⟳</span> Cargando estadísticas...
      </div>
      <div v-else-if="statsError" class="alert alert-error">{{ statsError }}</div>

      <template v-else-if="stats">

        <!-- Toolbar -->
        <div class="analytics-toolbar">
          <button class="btn btn-secondary btn-sm no-print" @click="reloadAnalytics">🔄 Actualizar</button>
          <button class="btn btn-sm btn-pdf no-print" @click="printAnalyticsPDF">⬇ PDF</button>
          <span class="analytics-subtitle">Acumulado de {{ stats.totalRuns }} ejecución{{ stats.totalRuns !== 1 ? 'es' : '' }}</span>
        </div>

        <!-- ── Stat cards ── -->
        <div class="an-stat-row">
          <div class="an-stat-card">
            <div class="an-stat-num blue">{{ stats.totalRuns }}</div>
            <div class="an-stat-label">Ejecuciones</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num">{{ stats.totalAvailable ?? '—' }}</div>
            <div class="an-stat-label">Tests disponibles</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num blue">{{ stats.uniqueExecuted }}</div>
            <div class="an-stat-label">Ejecutados (únicos)</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num" :class="stats.neverExecuted > 0 ? 'yellow' : 'green'">
              {{ stats.neverExecuted ?? '—' }}
            </div>
            <div class="an-stat-label">Sin ejecutar</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num green">{{ stats.uniquePassed }}</div>
            <div class="an-stat-label">✅ Pasaron</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num red">{{ stats.uniqueFailed }}</div>
            <div class="an-stat-label">❌ Fallaron</div>
          </div>
          <div class="an-stat-card highlight">
            <div class="an-stat-num" :class="rateColor(donutPassRate)">{{ donutPassRate }}%</div>
            <div class="an-stat-label">{{ stats.totalAvailable ? 'Pasaron del total' : 'Pass rate' }}</div>
          </div>
          <div class="an-stat-card">
            <div class="an-stat-num">{{ formatDuration(stats.avgDuration) }}</div>
            <div class="an-stat-label">Duración prom.</div>
          </div>
        </div>

        <!-- ── Donut + Timeline row ── -->
        <div class="an-charts-row">

          <!-- Donut chart -->
          <div class="an-card an-card-donut">
            <div class="an-card-title">Resultado Global</div>
            <div class="an-donut-wrap">
              <svg viewBox="0 0 200 200" width="200" height="200" class="an-donut-svg">
                <!-- background ring (full gray) -->
                <circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8f0" stroke-width="28"/>

                <template v-if="donut">
                  <!-- never-executed (light gray — drawn first, full arc) -->
                  <circle
                    v-if="donut.neverArc > 0"
                    cx="100" cy="100" r="70"
                    fill="none" stroke="#cbd5e1" stroke-width="28"
                    :stroke-dasharray="`${donut.neverArc} ${donut.circ}`"
                    stroke-dashoffset="0"
                    :transform="`rotate(${donut.neverRot}, 100, 100)`"
                  />
                  <!-- failed segment (red) -->
                  <circle
                    v-if="donut.failArc > 0"
                    cx="100" cy="100" r="70"
                    fill="none" stroke="#ef4444" stroke-width="28"
                    :stroke-dasharray="`${donut.failArc} ${donut.circ}`"
                    stroke-dashoffset="0"
                    :transform="`rotate(${donut.failRot}, 100, 100)`"
                  />
                  <!-- passed segment (green — drawn on top) -->
                  <circle
                    v-if="donut.passArc > 0"
                    cx="100" cy="100" r="70"
                    fill="none" stroke="#22c55e" stroke-width="28"
                    :stroke-dasharray="`${donut.passArc} ${donut.circ}`"
                    stroke-dashoffset="0"
                    :transform="`rotate(${donut.passRot}, 100, 100)`"
                  />
                </template>

                <!-- center: pass rate of executed tests -->
                <text x="100" y="90" text-anchor="middle" font-size="28" font-weight="700" fill="#1e293b" font-family="sans-serif">
                  {{ donutPassRate }}%
                </text>
                <text x="100" y="109" text-anchor="middle" font-size="11" fill="#64748b" font-family="sans-serif">{{ stats.totalAvailable ? 'del total' : 'pass rate' }}</text>
                <text v-if="!donut" x="100" y="105" text-anchor="middle" font-size="13" fill="#94a3b8" font-family="sans-serif">Sin datos</text>
              </svg>

              <!-- Legend -->
              <div class="an-donut-legend">
                <div class="an-legend-item">
                  <span class="an-legend-dot green"></span>
                  <span class="an-legend-text">Pasaron</span>
                  <span class="an-legend-val">{{ stats.uniquePassed }}</span>
                </div>
                <div class="an-legend-item">
                  <span class="an-legend-dot red"></span>
                  <span class="an-legend-text">Fallaron</span>
                  <span class="an-legend-val">{{ stats.uniqueFailed }}</span>
                </div>
                <div class="an-legend-item">
                  <span class="an-legend-dot gray"></span>
                  <span class="an-legend-text">Sin ejecutar</span>
                  <span class="an-legend-val">{{ stats.neverExecuted ?? '—' }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline chart -->
          <div class="an-card an-card-timeline">
            <div class="an-card-title">Tendencia — Pass Rate por Ejecución</div>
            <div v-if="stats.timeline.length < 2" class="an-chart-empty">
              Se necesitan 2+ ejecuciones para mostrar tendencia.
            </div>
            <div v-else class="an-timeline-wrap">
              <svg viewBox="0 0 800 155" preserveAspectRatio="none" class="an-timeline-svg">
                <!-- grid lines -->
                <line x1="38" y1="12"  x2="795" y2="12"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="38" y1="63"  x2="795" y2="63"  stroke="#e2e8f0" stroke-width="1"/>
                <line x1="38" y1="114" x2="795" y2="114" stroke="#e2e8f0" stroke-width="1"/>
                <!-- Y labels (fixed, don't distort with preserveAspectRatio:none → use separate overlay) -->
                <!-- area fill -->
                <polygon :points="timelineAreaPts" fill="#3b82f620"/>
                <!-- line -->
                <polyline :points="timelineLinePts" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round"/>
                <!-- dots -->
                <circle v-for="(d, i) in timelineDots" :key="i" :cx="d.x" :cy="d.y" r="4" fill="#3b82f6" stroke="#ffffff" stroke-width="2">
                  <title>{{ formatDate(d.timestamp) }} — {{ d.passRate }}% ({{ d.passed }}p / {{ d.failed }}f)</title>
                </circle>
              </svg>
              <!-- Y-axis labels (outside SVG to avoid distortion) -->
              <div class="an-timeline-ylabels">
                <span>100%</span>
                <span>50%</span>
                <span>0%</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Apps bar chart ── -->
        <div class="an-card an-card-bars" v-if="stats.byFile.length > 0">
          <div class="an-card-title">Tests por Aplicación / Archivo</div>
          <div class="an-bars-scroll">
            <svg :viewBox="`0 0 700 ${barSvgH}`" :style="{ width: '100%', height: barSvgH + 'px' }">

              <!-- bars for each app -->
              <g v-for="(app, i) in stats.byFile" :key="app.file">
                <!-- file label -->
                <text
                  x="155" :y="i * BAR_ROW + BAR_ROW / 2 + 4"
                  text-anchor="end" font-size="12.5" fill="#374151" font-family="sans-serif"
                >{{ truncate(app.file, 20) }}<title>{{ app.file }}</title></text>

                <!-- never-executed (gray, drawn first = back) -->
                <rect
                  v-if="appNeverPx(app) > 0"
                  x="162" :y="i * BAR_ROW + 7"
                  :width="appTotalPx(app)" :height="BAR_H"
                  fill="#e2e8f0" rx="3"
                >
                  <title>{{ app.file }} — Sin ejecutar: {{ app.neverExecuted }}</title>
                </rect>

                <!-- passed (green) -->
                <rect
                  v-if="appPassPx(app) > 0"
                  x="162" :y="i * BAR_ROW + 7"
                  :width="appPassPx(app)" :height="BAR_H"
                  fill="#22c55e" rx="3"
                >
                  <title>{{ app.file }} — Pasaron: {{ app.uniquePassed }}</title>
                </rect>

                <!-- failed (red, stacked after passed) -->
                <rect
                  v-if="appFailPx(app) > 0"
                  :x="162 + appPassPx(app)" :y="i * BAR_ROW + 7"
                  :width="appFailPx(app)" :height="BAR_H"
                  fill="#ef4444" rx="3"
                >
                  <title>{{ app.file }} — Fallaron: {{ app.uniqueFailed }}</title>
                </rect>

                <!-- count label -->
                <text
                  :x="162 + appTotalPx(app) + 8" :y="i * BAR_ROW + BAR_ROW / 2 + 4"
                  font-size="11.5" fill="#94a3b8" font-family="sans-serif"
                >{{ app.uniquePassed }}✅ {{ app.uniqueFailed }}❌{{ app.neverExecuted ? ' ' + app.neverExecuted + '⊘' : '' }} / {{ app.totalAvailable ?? app.uniqueExecuted }}</text>
              </g>

            </svg>
          </div>

          <!-- Bar legend -->
          <div class="an-bar-legend">
            <span class="an-legend-item"><span class="an-legend-dot green"></span>Pasaron</span>
            <span class="an-legend-item"><span class="an-legend-dot red"></span>Fallaron</span>
            <span class="an-legend-item"><span class="an-legend-dot gray"></span>Sin ejecutar (⊘)</span>
          </div>
        </div>

        <!-- Detailed app table -->
        <div class="an-card" v-if="stats.byFile.length > 0">
          <div class="an-card-title">Detalle por Aplicación</div>
          <table class="an-table">
            <colgroup>
              <col />
              <col style="width:88px" />
              <col style="width:88px" />
              <col style="width:88px" />
              <col style="width:88px" />
              <col style="width:88px" />
              <col style="width:148px" />
            </colgroup>
            <thead>
              <tr>
                <th>Archivo / App</th>
                <th class="col-num">Disponibles</th>
                <th class="col-num">✅ Pasaron</th>
                <th class="col-num">❌ Fallaron</th>
                <th class="col-num">⊘ Sin exec.</th>
                <th class="col-num">Pass Rate</th>
                <th class="col-bar-h">Barra</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="app in stats.byFile" :key="app.file">
                <td class="app-name-cell" :title="app.file">{{ app.file }}</td>
                <td class="col-num">{{ app.totalAvailable ?? '—' }}</td>
                <td class="col-num green-text">{{ app.uniquePassed }}</td>
                <td class="col-num red-text">{{ app.uniqueFailed }}</td>
                <td class="col-num" :class="app.neverExecuted > 0 ? 'yellow' : ''">{{ app.neverExecuted ?? '—' }}</td>
                <td class="col-num" :class="rateColor(appRate(app))">{{ appRate(app) }}%</td>
                <td class="bar-cell">
                  <div class="mini-bar-track">
                    <div class="mini-bar-pass" :style="{ width: appRate(app) + '%' }"></div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="stats.totalRuns === 0" class="empty-state">
          No hay ejecuciones registradas. Ejecuta algunos tests primero.
        </div>

      </template>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { apiFetch, apiUrl } from '../composables/apiFetch.js'

// ── Tab state ─────────────────────────────────────────────────────────────────
const activeTab = ref('list')

// ── Reports list state ────────────────────────────────────────────────────────
const reports        = ref([])
const selectedReport = ref(null)
const filters = ref({ dateFrom: '', dateTo: '', minPassed: '', minFailed: '', status: '' })

// ── Analytics state ───────────────────────────────────────────────────────────
const stats       = ref(null)
const statsLoading = ref(false)
const statsError   = ref('')

// ── Donut chart ───────────────────────────────────────────────────────────────
const DR = 70
const DC = 2 * Math.PI * DR   // ≈ 439.82

const donut = computed(() => {
  if (!stats.value) return null
  const { uniquePassed, uniqueFailed, uniqueExecuted, totalAvailable, neverExecuted } = stats.value
  const total = totalAvailable ?? uniqueExecuted
  if (!total) return null

  const passArc  = (uniquePassed  / total) * DC
  const failArc  = (uniqueFailed  / total) * DC
  const neverArc = neverExecuted ? (neverExecuted / total) * DC : 0

  return {
    circ:     DC,
    passArc,  failArc,  neverArc,
    passRot:  -90,
    failRot:  -90 + (passArc  / DC) * 360,
    neverRot: -90 + ((passArc + failArc) / DC) * 360
  }
})

// % of ALL tests that passed (matches visual green arc on donut)
const donutPassRate = computed(() => {
  if (!stats.value) return 0
  const total = stats.value.totalAvailable ?? stats.value.uniqueExecuted
  if (!total) return 0
  return Math.round((stats.value.uniquePassed / total) * 100)
})

// ── Timeline chart ────────────────────────────────────────────────────────────
// SVG viewBox: 0 0 800 155
const TL = 40, TR = 795, TTop = 14, TBot = 132

const timelineDots = computed(() => {
  const runs = stats.value?.timeline || []
  if (runs.length === 0) return []
  const n = runs.length
  const drawW = TR - TL
  const drawH = TBot - TTop
  return runs.map((r, i) => ({
    x: parseFloat((TL + (n === 1 ? drawW / 2 : (i / (n - 1)) * drawW)).toFixed(1)),
    y: parseFloat((TBot - (r.passRate / 100) * drawH).toFixed(1)),
    ...r
  }))
})

const timelineLinePts = computed(() =>
  timelineDots.value.map(d => `${d.x},${d.y}`).join(' ')
)

const timelineAreaPts = computed(() => {
  const dots = timelineDots.value
  if (dots.length === 0) return ''
  const pts = dots.map(d => `${d.x},${d.y}`).join(' ')
  return `${TL},${TBot} ${pts} ${TR},${TBot}`
})

// ── Bar chart ─────────────────────────────────────────────────────────────────
const BAR_H   = 22
const BAR_GAP = 14
const BAR_ROW = BAR_H + BAR_GAP
const BAR_MAX_W = 370   // max bar width in SVG units (out of 700-162-~100 space)

// Total width for one app = proportional to its available tests vs the largest app
const maxBarTotal = computed(() =>
  Math.max(...(stats.value?.byFile || []).map(f => f.totalAvailable ?? f.uniqueExecuted ?? 0), 1)
)

function appTotalPx(app) {
  const avail = app.totalAvailable ?? app.uniqueExecuted ?? 0
  return (avail / maxBarTotal.value) * BAR_MAX_W
}
function appPassPx(app) {
  const total = app.totalAvailable ?? app.uniqueExecuted ?? 0
  if (!total) return 0
  const w = appTotalPx(app)
  return Math.max((app.uniquePassed / total) * w, app.uniquePassed > 0 ? 2 : 0)
}
function appFailPx(app) {
  const total = app.totalAvailable ?? app.uniqueExecuted ?? 0
  if (!total) return 0
  const w = appTotalPx(app)
  return Math.max((app.uniqueFailed / total) * w, app.uniqueFailed > 0 ? 2 : 0)
}
function appNeverPx(app) {
  const never = app.neverExecuted
  const total = app.totalAvailable ?? 0
  if (!never || !total) return 0
  const w = appTotalPx(app)
  return Math.max((never / total) * w, 2)
}

const barSvgH = computed(() => {
  const n = stats.value?.byFile?.length || 0
  return n * BAR_ROW + 20
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncate(str, n = 22) {
  return str.length > n ? str.slice(0, n) + '…' : str
}

function appRate(app) {
  return app.uniqueExecuted > 0 ? Math.round((app.uniquePassed / app.uniqueExecuted) * 100) : 0
}

function rateColor(rate) {
  if (rate >= 90) return 'green'
  if (rate >= 60) return 'yellow'
  return 'red'
}

// ── Reports logic ─────────────────────────────────────────────────────────────
const hasActiveFilters = computed(() =>
  filters.value.dateFrom || filters.value.dateTo ||
  filters.value.minPassed !== '' || filters.value.minFailed !== '' || filters.value.status
)

function clearFilters() {
  filters.value = { dateFrom: '', dateTo: '', minPassed: '', minFailed: '', status: '' }
}

const filteredReports = computed(() =>
  reports.value.filter(r => {
    const date = new Date(r.timestamp)
    if (filters.value.dateFrom && date < new Date(filters.value.dateFrom + 'T00:00:00')) return false
    if (filters.value.dateTo   && date > new Date(filters.value.dateTo   + 'T23:59:59')) return false
    const failed = (r.summary.failed || 0) + (r.summary.errors || 0)
    if (filters.value.minPassed !== '' && r.summary.passed < Number(filters.value.minPassed)) return false
    if (filters.value.minFailed !== '' && failed < Number(filters.value.minFailed)) return false
    if (filters.value.status === 'clean'  && failed > 0)  return false
    if (filters.value.status === 'failed' && failed === 0) return false
    return true
  })
)

const passRate = computed(() => {
  if (!selectedReport.value) return 0
  const { total, passed } = selectedReport.value.summary
  return total > 0 ? Math.round((passed / total) * 100) : 0
})

// ── Agrupación por módulo (archivo de test) ───────────────────────────────────
// Clave de módulo = ruta del archivo (lo anterior a "::").
function moduleKey(id) {
  return String(id).split('::')[0]
}
// Etiqueta legible: "…/test_pago_tercero.py" => "Pago Tercero".
function moduleLabel(key) {
  const base = key.split(/[\\/]/).pop().replace(/\.py$/, '').replace(/^test_/, '')
  return base.split('_').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ') || key
}

const testModules = computed(() => {
  const r = selectedReport.value
  if (!r || !r.tests) return []
  const map = new Map()
  for (const t of r.tests) {
    const key = moduleKey(t.id)
    if (!map.has(key)) {
      map.set(key, { key, name: moduleLabel(key), tests: [], duration: 0, passed: 0, failed: 0 })
    }
    const g = map.get(key)
    g.tests.push(t)
    g.duration += t.duration || 0
    if (t.status === 'passed') g.passed++
    else g.failed++
  }
  return [...map.values()]
})

const expandedModules = ref(new Set())
function toggleModule(key) {
  const s = new Set(expandedModules.value)
  s.has(key) ? s.delete(key) : s.add(key)
  expandedModules.value = s
}
// Al abrir un reporte, expandir todos sus módulos por defecto.
watch(selectedReport, () => {
  expandedModules.value = new Set(testModules.value.map(m => m.key))
})

async function loadReports() {
  try {
    const res = await apiFetch('/api/reports')
    reports.value = await res.json()
  } catch {
    reports.value = []
  }
}

async function loadAnalytics() {
  statsLoading.value = true
  statsError.value = ''
  try {
    const res = await apiFetch('/api/reports/analytics')
    stats.value = await res.json()
  } catch (e) {
    statsError.value = e.message
  } finally {
    statsLoading.value = false
  }
}

async function reloadAnalytics() {
  stats.value = null
  await loadAnalytics()
}

async function viewReport(id) {
  try {
    const res = await apiFetch(`/api/reports/${id}`)
    const report = await res.json()
    report.tests = (report.tests || []).map(t => ({ ...t, _expanded: false }))
    selectedReport.value = { ...report, id }
  } catch (e) {
    console.error('Failed to load report:', e)
  }
}

async function deleteReport(id) {
  if (!confirm('¿Eliminar este reporte? No se puede deshacer.')) return
  await apiFetch(`/api/reports/${id}`, { method: 'DELETE' })
  reports.value = reports.value.filter(r => r.id !== id)
  stats.value = null  // force analytics refresh
}

function switchTab(tab) {
  activeTab.value = tab
  selectedReport.value = null
  if (tab === 'analytics' && !stats.value) loadAnalytics()
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

// Detalle/módulos/PDF: <1min => "6s"; >=1min => "7m:3s".
function formatDuration(totalSeconds) {
  if (totalSeconds == null) return '—'
  if (totalSeconds < 60) {
    const s = Math.round(totalSeconds * 10) / 10
    return `${Number.isInteger(s) ? s : s.toFixed(1)}s`
  }
  const total = Math.round(totalSeconds)
  const hrs = Math.floor(total / 3600)
  const min = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (hrs > 0) return `${hrs}h:${min}m:${sec}s`
  return `${min}m:${sec}s`
}

// Lista de reportes: forma textual "4 minutos y 6 segundos".
function formatDurationLong(totalSeconds) {
  if (totalSeconds == null) return '—'
  if (totalSeconds < 60) {
    const s = Math.round(totalSeconds * 10) / 10
    return `${Number.isInteger(s) ? s : s.toFixed(1)}s`
  }
  const total = Math.round(totalSeconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  const minLabel = `${min} ${min === 1 ? 'minuto' : 'minutos'}`
  if (sec === 0) return minLabel
  return `${minLabel} y ${sec} ${sec === 1 ? 'segundo' : 'segundos'}`
}

// ── PDF export ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function printReportPDF() {
  const r = selectedReport.value
  if (!r) return
  const failed  = (r.summary.failed || 0) + (r.summary.errors || 0)
  const rate    = r.summary.total > 0 ? Math.round((r.summary.passed / r.summary.total) * 100) : 0
  const rateCol = rate >= 90 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626'
  const now     = new Date().toLocaleString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const testsRows = testModules.value.map(mod => {
    const modHead = `<tr><td colspan="3" style="background:#eef2ff;padding:8px 10px;font-weight:700;font-size:12px;color:#1e293b">📦 ${esc(mod.name)} &nbsp;·&nbsp; ✅ ${mod.passed}${mod.failed ? ' · ❌ ' + mod.failed : ''} · ${mod.tests.length} test${mod.tests.length !== 1 ? 's' : ''} · ⏱ ${formatDuration(mod.duration)}</td></tr>`
    const rows = mod.tests.map(t => {
      const icon   = t.status === 'passed' ? '✅' : t.status === 'failed' ? '❌' : '⚠️'
      const rowBg  = t.status === 'failed' ? 'background:#fff5f5' : ''
      const errRow = t.errorMsg
        ? `<tr><td colspan="3" style="background:#fff5f5;padding:0 10px 8px"><pre style="background:#fef2f2;border-left:3px solid #ef4444;border-radius:0 4px 4px 0;padding:8px 10px;font-size:11px;font-family:Consolas,monospace;white-space:pre-wrap;color:#991b1b;margin:0">${esc(t.errorMsg)}</pre></td></tr>`
        : ''
      return `<tr style="${rowBg}">
        <td style="width:32px;font-size:15px;padding:7px 8px">${icon}</td>
        <td style="font-family:Consolas,monospace;font-size:12px;word-break:break-all;padding:7px 8px">${esc(t.id)}</td>
        <td style="text-align:right;width:120px;color:#64748b;white-space:nowrap;padding:7px 8px">${formatDuration(t.duration)}</td>
      </tr>${errRow}`
    }).join('')
    return modHead + rows
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<title>Reporte QA — ${esc(formatDate(r.timestamp))}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#1e293b;background:white;padding:40px}
h1{font-size:22px;font-weight:700;margin-bottom:6px}
.sub{color:#64748b;font-size:13px;margin-bottom:28px}
.cards{display:flex;gap:14px;margin-bottom:28px;flex-wrap:wrap}
.card{border:1px solid #e2e8f0;border-radius:8px;padding:14px 20px;text-align:center;min-width:90px}
.num{font-size:30px;font-weight:700;line-height:1;margin-bottom:5px}
.lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.sec{font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin:24px 0 10px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;font-size:10.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
td{border-bottom:1px solid #f1f5f9;vertical-align:top}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
@media print{body{padding:16px}tr{break-inside:avoid}}
</style>
</head><body>
<h1>⚡ Reporte de Ejecución QA</h1>
<p class="sub">Ejecución: ${esc(formatDate(r.timestamp))} &nbsp;·&nbsp; Generado: ${esc(now)}</p>
<div class="cards">
  <div class="card"><div class="num">${r.summary.total}</div><div class="lbl">Total</div></div>
  <div class="card"><div class="num" style="color:#16a34a">${r.summary.passed}</div><div class="lbl">Pasaron</div></div>
  <div class="card"><div class="num" style="color:${failed > 0 ? '#dc2626' : '#16a34a'}">${failed}</div><div class="lbl">Fallaron</div></div>
  <div class="card"><div class="num">${formatDuration(r.summary.duration)}</div><div class="lbl">Duración</div></div>
  <div class="card"><div class="num" style="color:${rateCol}">${rate}%</div><div class="lbl">Pass Rate</div></div>
</div>
<div class="sec">Detalle de Tests (${r.tests.length})</div>
<table>
  <thead><tr>
    <th></th><th>Test ID</th><th style="text-align:right">Duración</th>
  </tr></thead>
  <tbody>${testsRows}</tbody>
</table>
<div class="footer">QA Dashboard &nbsp;·&nbsp; ${new Date().getFullYear()}</div>
<script>
window.addEventListener('load',function(){
  setTimeout(function(){window.print()},250)
  window.addEventListener('afterprint',function(){window.close()})
})
<\/script>
</body></html>`

  const win = window.open('', '_blank', 'width=960,height=720')
  if (!win) { alert('Permite ventanas emergentes para generar el PDF'); return }
  win.document.write(html)
  win.document.close()
}

function printAnalyticsPDF() {
  window.print()
}

onMounted(loadReports)
</script>

<style scoped>
/* ── PDF button ─────────────────────────────────────────────────── */
.btn-pdf {
  background: linear-gradient(135deg, #1e293b, #334155);
  color: #f1f5f9;
  border: 1px solid #475569;
  font-weight: 600;
  letter-spacing: .02em;
}
.btn-pdf:hover { background: linear-gradient(135deg, #0f172a, #1e293b); color: white; }

/* ── Header & tabs ───────────────────────────────────────────────── */
.rp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

/* Segmented-control tab bar */
.rp-tabs {
  display: inline-flex;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 4px;
  gap: 3px;
}

.rp-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 20px;
  border: none;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.rp-tab:hover:not(.active) {
  background: rgba(255,255,255,0.75);
  color: #334155;
}

/* Historial tab — active */
.rp-tab.active {
  background: white;
  color: #1e293b;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04);
}

/* Analytics tab — inactive hover */
.rp-tab-analytics:hover:not(.active) {
  background: #eff6ff;
  color: #2563eb;
}

/* Analytics tab — active: gradient + glow */
.rp-tab-analytics.active {
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  color: white;
  font-weight: 600;
  box-shadow:
    0 4px 14px rgba(99, 102, 241, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.15);
}

.rp-tab-icon { font-size: 15px; line-height: 1; }

/* Badge (shows run count on analytics tab) */
.rp-tab-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 99px;
  min-width: 20px;
  text-align: center;
  line-height: 18px;
  height: 18px;
  background: rgba(255,255,255,0.22);
  color: white;
  transition: background 0.2s;
}
.rp-tab-analytics:not(.active) .rp-tab-badge {
  background: #dbeafe;
  color: #2563eb;
}

/* ── Analytics toolbar ───────────────────────────────────────────── */
.analytics-loading {
  text-align: center;
  padding: 60px;
  color: #94a3b8;
  font-size: 16px;
}
.spinner { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.analytics-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}
.analytics-subtitle { color: #64748b; font-size: 13px; }

/* ── Stat cards ──────────────────────────────────────────────────── */
.an-stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.an-stat-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 14px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.an-stat-card.highlight {
  border-color: #93c5fd;
  background: linear-gradient(135deg, #eff6ff, #eef2ff);
}
.an-stat-num   { font-size: 2rem; font-weight: 700; color: #1e293b; line-height: 1.1; }
.an-stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
.an-stat-num.blue   { color: #2563eb; }
.an-stat-num.green  { color: #16a34a; }
.an-stat-num.red    { color: #dc2626; }
.an-stat-num.yellow { color: #d97706; }

/* ── Card base ───────────────────────────────────────────────────── */
.an-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.an-card-title {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 14px;
}

/* ── Donut + Timeline row ────────────────────────────────────────── */
.an-charts-row {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 800px) { .an-charts-row { grid-template-columns: 1fr; } }

/* Donut */
.an-donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.an-donut-svg  { flex-shrink: 0; }
.an-donut-legend { display: flex; flex-direction: column; gap: 10px; }

.an-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1e293b;
}
.an-legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.an-legend-dot.green { background: #22c55e; }
.an-legend-dot.red   { background: #ef4444; }
.an-legend-dot.gray  { background: #cbd5e1; }
.an-legend-text { flex: 1; color: #64748b; }
.an-legend-val  { font-weight: 600; }

/* Timeline */
.an-card-timeline { display: flex; flex-direction: column; }
.an-chart-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  min-height: 100px;
}
.an-timeline-wrap { display: flex; align-items: stretch; }
.an-timeline-svg  { flex: 1; height: 155px; min-width: 0; }
.an-timeline-ylabels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 10px 0 20px 0;
  font-size: 11px;
  color: #94a3b8;
  width: 34px;
  text-align: right;
  flex-shrink: 0;
  order: -1;
}

/* Bar chart */
.an-bars-scroll { overflow-x: auto; }
.an-bar-legend  { display: flex; gap: 20px; margin-top: 8px; font-size: 12px; color: #64748b; }

/* ── App detail table ────────────────────────────────────────────── */
.an-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;   /* enforces colgroup widths — fixes misalignment */
}
.an-table th {
  text-align: left;
  padding: 8px 10px;
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  border-bottom: 2px solid #e2e8f0;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
}
.an-table td {
  padding: 9px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: middle;
  overflow: hidden;
}
.an-table tr:last-child td { border-bottom: none; }
.an-table tr:hover td      { background: #f8fafc; }

/* Numeric columns: right-aligned, no width here (managed by colgroup) */
.col-num     { text-align: right; }
.col-bar-h   { padding-left: 12px; }

/* App name: truncate long names */
.app-name-cell {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.green-text { color: #16a34a; font-weight: 600; }
.red-text   { color: #dc2626; font-weight: 600; }
.green      { color: #16a34a; font-weight: 600; }
.yellow     { color: #d97706; font-weight: 600; }
.red        { color: #dc2626; font-weight: 600; }

/* Mini progress bar in table */
.bar-cell { padding-left: 12px; }
.mini-bar-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.mini-bar-pass {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #4ade80);
  border-radius: 4px;
  transition: width 0.4s ease;
  min-width: 2px;
}
</style>
