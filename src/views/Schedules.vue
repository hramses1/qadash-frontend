<template>
  <div class="view-container">
    <div class="sched-head">
      <h1 class="view-title">Calendarización</h1>
      <button class="btn btn-primary" @click="openCreate">＋ Nueva programación</button>
    </div>
    <p class="hint-text">
      Programa ejecuciones automáticas de tests a una hora fija.
    </p>

    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>

    <!-- Lista -->
    <div v-if="!loading && schedules.length === 0" class="card sched-empty">
      <div class="sched-empty-icon">🗓️</div>
      <p>No hay programaciones todavía.</p>
      <button class="btn btn-primary" @click="openCreate">Crear la primera</button>
    </div>

    <div class="sched-list">
      <div v-for="s in schedules" :key="s.id" class="card sched-card" :class="{ 'sched-off': !s.enabled }">
        <div class="sched-card-main">
          <div class="sched-time-box">
            <span class="sched-time">{{ s.time }}</span>
            <span class="sched-days">{{ daysLabel(s.days) }}</span>
          </div>
          <div class="sched-info">
            <div class="sched-name-row">
              <span class="sched-name">{{ s.name }}</span>
              <span v-if="s.useDocker" class="sched-tag">🐳 Docker</span>
              <span v-if="s.repeat > 1" class="sched-tag">×{{ s.repeat }}</span>
            </div>
            <div class="sched-meta">
              <span>🧪 {{ s.testIds.length }} test{{ s.testIds.length !== 1 ? 's' : '' }}</span>
              <span v-if="paramCount(s)">⚙️ {{ paramCount(s) }} parámetro{{ paramCount(s) !== 1 ? 's' : '' }}</span>
              <span class="sched-next">⏭️ {{ s.enabled ? fmtNext(s.nextRun) : 'Pausada' }}</span>
              <span v-if="s.lastRun" class="sched-last">Última: {{ fmtDate(s.lastRun) }}</span>
            </div>
          </div>
        </div>

        <div class="sched-actions">
          <label class="switch" :title="s.enabled ? 'Activa' : 'Pausada'">
            <input type="checkbox" :checked="s.enabled" @change="toggleSchedule(s.id)" />
            <span class="switch-track"></span>
          </label>
          <button class="btn btn-sm btn-secondary" :disabled="runningId === s.id" @click="doRunNow(s)" title="Ejecutar ahora">
            {{ runningId === s.id ? '⏳' : '▶ Ahora' }}
          </button>
          <button class="btn btn-sm btn-secondary" @click="openEdit(s)" title="Editar">✏️</button>
          <button class="btn btn-sm btn-danger" @click="askDelete(s)" title="Eliminar">🗑️</button>
        </div>
      </div>
    </div>

    <div v-if="runMsg" class="alert alert-success run-toast">✅ {{ runMsg }}</div>

    <!-- Modal crear/editar -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
        <div class="modal sched-modal">
          <div class="modal-header">
            <h3 class="modal-title">{{ form.id ? '✏️ Editar programación' : '＋ Nueva programación' }}</h3>
            <button class="btn-icon" @click="showModal = false">✕</button>
          </div>

          <div class="modal-body sched-modal-body">
            <div class="sched-grid">
              <div class="form-group">
                <label>Nombre</label>
                <input v-model="form.name" class="input" placeholder="Pruebas preproducción" />
              </div>
              <div class="form-group sched-time-field">
                <label>Hora</label>
                <input v-model="form.time" type="time" class="input" />
              </div>
              <div class="form-group sched-repeat-field">
                <label>Repeticiones</label>
                <input v-model.number="form.repeat" type="number" min="1" max="100" class="input" />
              </div>
            </div>

            <!-- Días -->
            <div class="form-group">
              <label>Días</label>
              <div class="day-presets">
                <button class="chip-btn" :class="{ on: isPreset('daily') }" @click="setPreset('daily')">Todos</button>
                <button class="chip-btn" :class="{ on: isPreset('weekdays') }" @click="setPreset('weekdays')">Lun–Vie</button>
                <button class="chip-btn" :class="{ on: isPreset('weekend') }" @click="setPreset('weekend')">Fines</button>
              </div>
              <div class="day-row">
                <button
                  v-for="d in DAYS"
                  :key="d.n"
                  class="day-chip"
                  :class="{ on: form.days.includes(d.n) }"
                  @click="toggleDay(d.n)"
                >{{ d.l }}</button>
              </div>
              <small class="hint">Sin días marcados = todos los días.</small>
            </div>

            <!-- Tests -->
            <div class="form-group">
              <label>Tests a ejecutar ({{ form.testIds.length }})</label>
              <input v-model="testSearch" class="input" placeholder="🔍 Filtrar tests..." />
              <div v-if="testGroups.length === 0" class="param-empty" style="margin-top:8px">
                No hay tests recolectados. Ve a <RouterLink to="/dashboard">Tests</RouterLink> y pulsa "Actualizar Tests".
              </div>
              <div v-else class="test-picker">
                <div v-for="g in filteredGroups" :key="g.name" class="tp-group">
                  <div class="tp-group-head" @click="toggleGroupOpen(g.name)">
                    <input
                      type="checkbox"
                      :checked="groupAllSelected(g)"
                      :indeterminate.prop="groupSomeSelected(g)"
                      @click.stop
                      @change="toggleGroup(g)"
                    />
                    <span class="tp-chev" :class="{ open: openGroups[g.name] }">▸</span>
                    <span class="tp-file">{{ g.name }}</span>
                    <span class="tp-badge">{{ countSelected(g) }}/{{ g.tests.length }}</span>
                  </div>
                  <div v-show="openGroups[g.name]" class="tp-tests">
                    <label v-for="id in g.tests" :key="id" class="tp-test">
                      <input type="checkbox" :value="id" v-model="form.testIds" />
                      <span>{{ shortName(id) }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Docker -->
            <label class="checkbox-label sched-docker">
              <input type="checkbox" v-model="form.useDocker" />
              🐳 Levantar Selenium en Docker antes de ejecutar
            </label>

            <datalist id="sched-env-keys">
              <option v-for="k in envKeys" :key="k" :value="k" />
            </datalist>

            <!-- Parámetros para todos -->
            <div class="param-section">
              <div class="param-section-head">
                <span class="run-modal-label">Parámetros para todos</span>
                <span class="param-badge">opcional</span>
              </div>
              <p class="run-modal-hint param-hint">
                Se aplican a todos los tests. Vacío → valor del <code>.env</code>.
              </p>
              <div v-if="form.params.length" class="param-list">
                <div v-for="(row, i) in form.params" :key="i" class="param-row">
                  <input v-model="row.key" list="sched-env-keys" class="input param-key" placeholder="VARIABLE" />
                  <span class="param-eq">=</span>
                  <input
                    v-model="row.value"
                    class="input param-val"
                    :placeholder="envMap[row.key] ? `.env: ${envMap[row.key]}` : 'valor del .env'"
                  />
                  <button class="param-del" @click="form.params.splice(i, 1)">✕</button>
                </div>
              </div>
              <p v-else class="param-empty">Sin parámetros — se usa el <code>.env</code>.</p>
              <button class="param-add-btn" @click="form.params.push({ key: '', value: '' })">＋ Agregar parámetro</button>
            </div>

            <!-- Parámetros por test (cuando hay más de uno) -->
            <div v-if="form.testIds.length > 1" class="param-section">
              <div class="param-section-head">
                <span class="run-modal-label">Parámetros por test</span>
                <span class="param-badge">opcional</span>
              </div>
              <p class="run-modal-hint param-hint">
                Pisan a los de "para todos" y al <code>.env</code>, solo para ese test.
              </p>
              <div class="test-param-list">
                <div v-for="id in form.testIds" :key="id" class="test-param-item">
                  <button class="test-param-head" @click="expandedTest = expandedTest === id ? null : id">
                    <span class="tp-caret" :class="{ open: expandedTest === id }">▸</span>
                    <span class="tp-name" :title="id">{{ shortName(id) }}</span>
                    <span v-if="testParamCount(id)" class="tp-count">{{ testParamCount(id) }}</span>
                  </button>
                  <div v-show="expandedTest === id" class="test-param-body">
                    <div class="param-list">
                      <div v-for="(row, i) in form.paramsByTest[id] || []" :key="i" class="param-row">
                        <input v-model="row.key" list="sched-env-keys" class="input param-key" placeholder="VARIABLE" />
                        <span class="param-eq">=</span>
                        <input
                          v-model="row.value"
                          class="input param-val"
                          :placeholder="envMap[row.key] ? `.env: ${envMap[row.key]}` : 'valor'"
                        />
                        <button class="param-del" @click="form.paramsByTest[id].splice(i, 1)">✕</button>
                      </div>
                    </div>
                    <button class="param-add-btn" @click="addTestParam(id)">＋ Agregar parámetro</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer sched-footer">
            <button class="btn btn-secondary" @click="showModal = false">Cancelar</button>
            <button class="btn btn-primary" :disabled="!canSave || saving" @click="saveForm">
              {{ saving ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear programación') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirmar borrado -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal modal-sm sched-modal">
          <div class="modal-header">
            <h3 class="modal-title">Eliminar programación</h3>
            <button class="btn-icon" @click="deleteTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p class="run-modal-desc">¿Eliminar <strong>{{ deleteTarget.name }}</strong>?</p>
          </div>
          <div class="modal-footer" style="justify-content:center">
            <button class="btn btn-secondary" @click="deleteTarget = null">Cancelar</button>
            <button class="btn btn-danger" @click="confirmDelete">Eliminar</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSchedules } from '../composables/useSchedules'

defineOptions({ name: 'Schedules' })

const {
  schedules, loading, error,
  fetchSchedules, createSchedule, updateSchedule, toggleSchedule, deleteSchedule, runNow
} = useSchedules()

const DAYS = [
  { n: 1, l: 'Lun' }, { n: 2, l: 'Mar' }, { n: 3, l: 'Mié' }, { n: 4, l: 'Jue' },
  { n: 5, l: 'Vie' }, { n: 6, l: 'Sáb' }, { n: 0, l: 'Dom' }
]

// ── Lista / acciones ──
const runningId = ref(null)
const runMsg = ref('')
const deleteTarget = ref(null)

function shortName(id) {
  const parts = id.split('::')
  return parts.slice(1).join('::') || id
}
function daysLabel(days) {
  if (!days || days.length === 0) return 'Todos los días'
  if (days.length === 7) return 'Todos los días'
  if (sameSet(days, [1, 2, 3, 4, 5])) return 'Lun a Vie'
  if (sameSet(days, [0, 6])) return 'Fines de semana'
  return DAYS.filter(d => days.includes(d.n)).map(d => d.l).join(', ')
}
function sameSet(a, b) { return a.length === b.length && b.every(x => a.includes(x)) }
function paramCount(s) {
  let n = Object.keys(s.params || {}).length
  for (const kv of Object.values(s.paramsByTest || {})) n += Object.keys(kv).length
  return n
}
function fmtNext(iso) {
  if (!iso) return 'Sin próxima'
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const hm = d.toTimeString().slice(0, 5)
  if (sameDay) return `Hoy ${hm}`
  if (isTomorrow) return `Mañana ${hm}`
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + ` ${hm}`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function doRunNow(s) {
  runningId.value = s.id
  runMsg.value = ''
  try {
    await runNow(s.id)
    runMsg.value = `"${s.name}" lanzada. Mira el avance en Tests.`
    setTimeout(() => { runMsg.value = '' }, 5000)
  } catch (e) {
    error.value = e.message
  } finally {
    runningId.value = null
  }
}

function askDelete(s) { deleteTarget.value = s }
async function confirmDelete() {
  await deleteSchedule(deleteTarget.value.id)
  deleteTarget.value = null
}

// ── Modal crear/editar ──
const showModal = ref(false)
const saving = ref(false)
const form = ref(blankForm())
const testSearch = ref('')
const openGroups = ref({})
const expandedTest = ref(null)

// Colección de tests (cache) + variables del .env
const testGroups = ref([])   // [{ name, tests: [ids] }]
const envMap = ref({})       // key -> valor del .env (placeholder)
const envKeys = ref([])      // claves para el datalist

function blankForm() {
  return { id: null, name: '', time: '03:00', days: [], testIds: [], repeat: 1, useDocker: false, params: [], paramsByTest: {} }
}

async function fetchEnvVars() {
  try {
    const res = await fetch('/api/env')
    const data = await res.json()
    if (Array.isArray(data.vars)) {
      const map = {}
      data.vars.filter(v => !v.isComment && v.key).forEach(v => { map[v.key] = v.value })
      envMap.value = map
      envKeys.value = Object.keys(map)
    }
  } catch { /* .env opcional */ }
}

async function loadTests() {
  try {
    const res = await fetch('/api/tests/cached')
    const data = await res.json()
    testGroups.value = Object.entries(data.files || {}).map(([name, tests]) => ({ name, tests }))
  } catch { testGroups.value = [] }
}

const filteredGroups = computed(() => {
  const q = testSearch.value.trim().toLowerCase()
  if (!q) return testGroups.value
  return testGroups.value
    .map(g => ({ name: g.name, tests: g.tests.filter(id => id.toLowerCase().includes(q)) }))
    .filter(g => g.tests.length > 0 || g.name.toLowerCase().includes(q))
})

const canSave = computed(() => form.value.name.trim() && form.value.time && form.value.testIds.length > 0)

function openCreate() {
  form.value = blankForm()
  resetModalAux()
  showModal.value = true
}
function openEdit(s) {
  // paramsByTest del backend ({id:{k:v}}) → rows editables ({id:[{key,value}]})
  const pbt = {}
  for (const [id, kv] of Object.entries(s.paramsByTest || {})) {
    pbt[id] = Object.entries(kv).map(([key, value]) => ({ key, value }))
  }
  form.value = {
    id: s.id,
    name: s.name,
    time: s.time,
    days: [...(s.days || [])],
    testIds: [...(s.testIds || [])],
    repeat: s.repeat || 1,
    useDocker: !!s.useDocker,
    params: Object.entries(s.params || {}).map(([key, value]) => ({ key, value })),
    paramsByTest: pbt
  }
  resetModalAux()
  showModal.value = true
}

function resetModalAux() {
  testSearch.value = ''
  openGroups.value = {}
  expandedTest.value = null
  loadTests()
  if (envKeys.value.length === 0) fetchEnvVars()
}

// ── Parámetros por test ──
function addTestParam(id) {
  if (!form.value.paramsByTest[id]) form.value.paramsByTest[id] = []
  form.value.paramsByTest[id].push({ key: '', value: '' })
  expandedTest.value = id
}
function testParamCount(id) {
  return (form.value.paramsByTest[id] || []).filter(r => (r.key || '').trim() && (r.value || '').trim()).length
}

function toggleDay(n) {
  const i = form.value.days.indexOf(n)
  if (i === -1) form.value.days.push(n)
  else form.value.days.splice(i, 1)
}
function setPreset(p) {
  if (p === 'daily') form.value.days = []
  else if (p === 'weekdays') form.value.days = [1, 2, 3, 4, 5]
  else if (p === 'weekend') form.value.days = [0, 6]
}
function isPreset(p) {
  const d = form.value.days
  if (p === 'daily') return d.length === 0 || d.length === 7
  if (p === 'weekdays') return sameSet(d, [1, 2, 3, 4, 5])
  if (p === 'weekend') return sameSet(d, [0, 6])
  return false
}

function toggleGroupOpen(name) { openGroups.value[name] = !openGroups.value[name] }
function countSelected(g) { return g.tests.filter(id => form.value.testIds.includes(id)).length }
function groupAllSelected(g) { return g.tests.length > 0 && g.tests.every(id => form.value.testIds.includes(id)) }
function groupSomeSelected(g) { const n = countSelected(g); return n > 0 && n < g.tests.length }
function toggleGroup(g) {
  const all = groupAllSelected(g)
  const set = new Set(form.value.testIds)
  for (const id of g.tests) { all ? set.delete(id) : set.add(id) }
  form.value.testIds = [...set]
}

async function saveForm() {
  if (!canSave.value) return
  saving.value = true
  error.value = ''
  try {
    const params = {}
    for (const r of form.value.params) {
      const k = (r.key || '').trim(); const v = (r.value || '').trim()
      if (k && v) params[k] = v
    }
    // Por test: solo los seleccionados y con overrides reales.
    const paramsByTest = {}
    const selected = new Set(form.value.testIds)
    for (const [id, rows] of Object.entries(form.value.paramsByTest)) {
      if (!selected.has(id)) continue
      const o = {}
      for (const r of rows) {
        const k = (r.key || '').trim(); const v = (r.value || '').trim()
        if (k && v) o[k] = v
      }
      if (Object.keys(o).length) paramsByTest[id] = o
    }
    const payload = {
      name: form.value.name, time: form.value.time, days: form.value.days,
      testIds: form.value.testIds, repeat: form.value.repeat, useDocker: form.value.useDocker,
      params, paramsByTest
    }
    if (form.value.id) await updateSchedule(form.value.id, payload)
    else await createSchedule(payload)
    showModal.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(fetchSchedules)
</script>

<style scoped>
.sched-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .5rem; }
.sched-head .view-title { margin: 0; }

.sched-empty { text-align: center; padding: 2.5rem 1.5rem; }
.sched-empty-icon { font-size: 2.5rem; margin-bottom: .5rem; }
.sched-empty p { color: #64748b; margin-bottom: 1rem; }

.sched-list { display: flex; flex-direction: column; gap: 12px; margin-top: 1rem; }
.sched-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; }
.sched-off { opacity: .6; }
.sched-card-main { display: flex; align-items: center; gap: 18px; min-width: 0; flex: 1; }

.sched-time-box {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff;
  border-radius: 12px; padding: 10px 16px; min-width: 92px;
}
.sched-time { font-size: 22px; font-weight: 800; line-height: 1; }
.sched-days { font-size: 10px; opacity: .9; margin-top: 3px; text-align: center; }

.sched-info { min-width: 0; }
.sched-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
.sched-name { font-size: 15px; font-weight: 600; color: #1e293b; }
.sched-tag { font-size: 11px; font-weight: 600; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 99px; padding: 1px 8px; }
.sched-meta { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #64748b; }
.sched-next { color: #2563eb; font-weight: 600; }
.sched-last { color: #94a3b8; }

.sched-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* Switch */
.switch { position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; }
.switch-track { position: absolute; inset: 0; background: #cbd5e1; border-radius: 99px; transition: .2s; }
.switch-track::before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
.switch input:checked + .switch-track { background: #22c55e; }
.switch input:checked + .switch-track::before { transform: translateX(18px); }

.run-toast { position: sticky; bottom: 1rem; }

/* Modal */
.sched-modal { width: 640px; max-width: 96vw; max-height: 90vh; }
.sched-modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 18px; }
.sched-grid { display: grid; grid-template-columns: 1fr 120px 120px; gap: 12px; }
.sched-time-field input, .sched-repeat-field input { text-align: center; }

.day-presets { display: flex; gap: 6px; margin-bottom: 8px; }
.chip-btn {
  font-size: 12px; padding: 4px 12px; border-radius: 99px; cursor: pointer;
  border: 1px solid #e2e8f0; background: #fff; color: #475569; font-weight: 500;
}
.chip-btn.on { background: rgba(99,102,241,.12); border-color: #6366f1; color: #4f46e5; }
.day-row { display: flex; gap: 6px; flex-wrap: wrap; }
.day-chip {
  width: 42px; height: 34px; border-radius: 8px; cursor: pointer;
  border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 12px; font-weight: 600;
}
.day-chip.on { background: #3b82f6; border-color: #3b82f6; color: #fff; }

/* Test picker */
.test-picker { margin-top: 8px; max-height: 240px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
.tp-group { border-bottom: 1px solid #f1f5f9; }
.tp-group:last-child { border-bottom: none; }
.tp-group-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; cursor: pointer; font-size: 13px; }
.tp-group-head:hover { background: #f8fafc; }
.tp-chev { color: #94a3b8; transition: transform .2s; }
.tp-chev.open { transform: rotate(90deg); }
.tp-file { flex: 1; font-family: 'Cascadia Code', monospace; font-size: 12px; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-badge { font-size: 11px; font-weight: 700; color: #6366f1; background: rgba(99,102,241,.1); border-radius: 99px; padding: 1px 8px; }
.tp-tests { padding: 4px 12px 8px 34px; display: flex; flex-direction: column; gap: 4px; }
.tp-test { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; cursor: pointer; }

.sched-docker { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #475569; cursor: pointer; }

.sched-footer { justify-content: center; gap: 12px; }
.sched-footer .btn { min-width: 150px; justify-content: center; }
</style>
