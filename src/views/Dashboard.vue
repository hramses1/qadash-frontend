<template>
  <div class="view-container">
    <h1 class="view-title">Tests</h1>

    <div v-if="!hasConfig" class="alert alert-warning">
      ⚠️ Proyecto no configurado. Ve a
      <RouterLink to="/settings">Configuración</RouterLink> para establecer la ruta.
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="toolbar">
        <button class="btn btn-secondary" @click="collectTests" :disabled="collecting || running">
          {{ collecting ? '⟳ Recolectando...' : '🔄 Actualizar Tests' }}
        </button>
        <span v-if="cacheTimestamp && !collecting" class="cache-hint">
          caché {{ formatCacheDate(cacheTimestamp) }}
        </span>
<div class="toolbar-right">
          <span class="selection-count" v-if="totalTests > 0">
            {{ selectedCount }} / {{ totalTests }} seleccionados
          </span>
          <button class="btn btn-danger" v-if="running" @click="abort">⏹ Abortar</button>
          <button
            v-else
            class="btn btn-primary"
            @click="showRunModal = true"
            :disabled="selectedCount === 0 || collecting"
          >
            ▶ Ejecutar ({{ selectedCount }})
          </button>
        </div>
      </div>

      <!-- Collection error -->
      <div v-if="collectError" class="alert alert-error">
        <strong>Error al recolectar tests:</strong>
        <pre class="error-output">{{ collectError }}</pre>
      </div>

      <!-- Partial collection warning -->
      <div v-if="collectWarning" class="alert alert-warning collect-warning">
        <strong>⚠️ {{ collectWarning.count }} archivo(s) no se pudieron importar</strong>
        <span class="warn-hint"> — {{ collectWarning.reason }}</span>
        <details class="warn-details">
          <summary>Ver archivos con error</summary>
          <ul class="warn-file-list">
            <li v-for="f in collectWarning.files" :key="f">{{ f }}</li>
          </ul>
        </details>
      </div>

      <!-- Run error -->
      <div v-if="runError" class="alert alert-error">{{ runError }}</div>

      <!-- Progress -->
      <div v-if="running || executionDone" class="progress-section">
        <ProgressBar
          :percentage="progress.percentage"
          :current="progress.current"
          :total="progress.total"
          :done="executionDone"
        />
      </div>

      <!-- Execution summary -->
      <div v-if="executionDone && lastSummary" class="summary-bar">
        <span class="summary-item passed">✅ {{ lastSummary.passed }} passed</span>
        <span class="summary-item failed">❌ {{ (lastSummary.failed || 0) + (lastSummary.errors || 0) }} failed</span>
        <span class="summary-item">⏱ {{ lastSummary.duration?.toFixed(1) }}s</span>
        <RouterLink to="/reports" class="btn btn-sm btn-secondary">Ver reportes</RouterLink>
      </div>

      <!-- Execution log -->
      <div v-if="executionLog.length > 0" class="exec-log-card">
        <button class="exec-log-header" @click="executionLogOpen = !executionLogOpen">
          <span class="exec-log-title">
            {{ executionLogOpen ? '▾' : '▸' }} Resultados de ejecución
          </span>
          <span class="exec-log-pills">
            <span class="pill pill-pass">✅ {{ executionLog.filter(r => r.status === 'passed').length }}</span>
            <span class="pill pill-fail">❌ {{ executionLog.filter(r => r.status !== 'passed').length }}</span>
            <span class="pill">{{ executionLog.length }} total</span>
          </span>
        </button>

        <div v-show="executionLogOpen" class="exec-log-body">
          <template v-for="(group, gi) in executionIterations" :key="gi">
            <div v-if="executionIterations.length > 1" class="exec-iter-label">
              Vuelta {{ gi + 1 }}
            </div>
            <div
              v-for="(entry, ei) in group"
              :key="ei"
              class="exec-log-row"
              :class="entry.status"
            >
              <span class="exec-status-icon">
                {{ entry.status === 'passed' ? '✅' : entry.status === 'running' ? '⟳' : '❌' }}
              </span>
              <span class="exec-test-name" :title="entry.id">{{ shortName(entry.id) }}</span>
              <span class="exec-duration" v-if="entry.duration">{{ entry.duration.toFixed(2) }}s</span>
              <button
                v-if="entry.errorMsg"
                class="exec-error-toggle"
                @click="toggleError(gi + '-' + ei)"
              >
                {{ expandedErrors.has(gi + '-' + ei) ? '▴ ocultar' : '▾ ver error' }}
              </button>
              <div v-if="entry.errorMsg && expandedErrors.has(gi + '-' + ei)" class="exec-error-msg">
                <pre>{{ entry.errorMsg }}</pre>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Test list -->
      <div v-if="files.length > 0" class="test-list">
        <div class="select-all-bar">
          <label class="checkbox-label">
            <input type="checkbox" :checked="allSelected" :indeterminate.prop="someSelected" @change="toggleAll" />
            Seleccionar todos
          </label>
          <div class="tree-controls">
            <button class="btn-tree-ctrl" @click="expandAll" title="Desplegar carpetas y archivos">⊞ Desplegar todos</button>
            <button class="btn-tree-ctrl" @click="expandFoldersOnly" title="Solo carpetas — archivos colapsados">⊟ Solo carpetas</button>
            <button class="btn-tree-ctrl" @click="collapseAll" title="Ocultar todo">⊠ Ocultar todos</button>
          </div>
        </div>

        <FolderNode
          v-for="node in fileTree"
          :key="node.type === 'folder' ? node.path : node.file.name"
          :node="node"
          :testStatuses="testStatuses"
          @toggle="toggleTest"
          @toggle-file="toggleFile"
          @edit-file="openEditor"
        />
      </div>

      <div v-else-if="!collecting && !collectError" class="empty-state">
        Haz clic en "Actualizar Tests" para cargar los tests disponibles.
      </div>
    </template>
  </div>

  <!-- Code editor modal -->
  <Teleport to="body">
    <div v-if="editorModal" class="modal-backdrop editor-modal-backdrop" @keydown.esc="closeEditor">
      <div class="modal editor-modal">

        <div class="modal-header">
          <div class="editor-modal-title">
            <span class="editor-modal-icon">🧪</span>
            <span class="editor-modal-filename">{{ editorFile?.name }}</span>
          </div>
          <div class="editor-modal-actions">
            <span v-if="editorSaved" class="editor-saved-badge">✅ Guardado</span>
            <span v-if="editorError" class="editor-error-badge">❌ {{ editorError }}</span>
            <button
              class="btn btn-primary btn-sm"
              @click="saveEditorFile"
              :disabled="editorSaving || editorLoading"
            >
              {{ editorSaving ? '💾 Guardando...' : '💾 Guardar' }}
            </button>
            <button class="btn btn-secondary btn-sm" @click="closeEditor">✕ Cerrar</button>
          </div>
        </div>

        <div class="editor-modal-body">
          <div v-if="editorLoading" class="editor-loading">
            <span>Cargando archivo...</span>
          </div>
          <CodeEditor
            v-else
            ref="editorRef"
            v-model="editorContent"
            :filePath="editorFile?.fullPath || editorFile?.name || ''"
            @save="saveEditorFile"
          />
        </div>

      </div>
    </div>
  </Teleport>

  <!-- Run confirmation modal -->
  <Teleport to="body">
    <div v-if="showRunModal" class="modal-backdrop" @click.self="showRunModal = false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3 class="modal-title">▶ Ejecutar tests</h3>
          <button class="btn-icon" @click="showRunModal = false">✕</button>
        </div>
        <div class="modal-body">
          <p class="run-modal-desc">
            <strong>{{ selectedCount }}</strong> test{{ selectedCount !== 1 ? 's' : '' }} seleccionado{{ selectedCount !== 1 ? 's' : '' }}
          </p>
          <div class="run-modal-field">
            <label class="run-modal-label">Número de veces a ejecutar</label>
            <input
              v-model.number="runRepeat"
              type="number"
              min="1"
              max="100"
              class="input run-repeat-input"
              @keyup.enter="confirmRun"
            />
          </div>
          <p class="run-modal-total" v-if="runRepeat > 1">
            Total: {{ selectedCount * runRepeat }} ejecuciones
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showRunModal = false">Cancelar</button>
          <button class="btn btn-primary" @click="confirmRun" :disabled="runRepeat < 1">
            ▶ Ejecutar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide, nextTick, watch } from 'vue'
defineOptions({ name: 'Dashboard' })

const folderExpanded = ref({})
const fileExpanded = ref({})
provide('folderExpanded', folderExpanded)
provide('fileExpanded', fileExpanded)
import TestList from '../components/TestList.vue'
import FolderNode from '../components/FolderNode.vue'
import ProgressBar from '../components/ProgressBar.vue'
import CodeEditor from '../components/CodeEditor.vue'
import { useSocket } from '../composables/useSocket'

const { socket } = useSocket()

const files = ref([])
const hasConfig = ref(false)
const projectPath = ref('')
const cacheTimestamp = ref(null)   // when last collection was done
const showRunModal = ref(false)
const runRepeat = ref(1)
const collecting = ref(false)
const running = ref(false)
const collectError = ref('')
const collectWarning = ref(null)
const runError = ref('')
const executionDone = ref(false)
const lastSummary = ref(null)
const progress = ref({ current: 0, total: 0, percentage: 0 })
const testStatuses = ref({})

const executionLog = ref([])
const runBaseCount = ref(0)

// ── Code editor modal ──
const editorModal   = ref(false)
const editorFile    = ref(null)   // { name, path }
const editorContent = ref('')
const editorLoading = ref(false)
const editorSaving  = ref(false)
const editorError   = ref('')
const editorSaved   = ref(false)
const editorRef     = ref(null)
const executionLogOpen = ref(true)
const expandedErrors = ref(new Set())

const executionIterations = computed(() => {
  const n = runBaseCount.value
  if (!n) return [executionLog.value]
  const result = []
  for (let i = 0; i < executionLog.value.length; i += n) {
    result.push(executionLog.value.slice(i, i + n))
  }
  return result
})

function shortName(id) {
  const parts = id.split('::')
  return parts[parts.length - 1]
}

function formatCacheDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `hace ${diffH}h`
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function toggleError(key) {
  const s = new Set(expandedErrors.value)
  s.has(key) ? s.delete(key) : s.add(key)
  expandedErrors.value = s
}

function buildTree(fileList) {
  const root = []
  const folderMap = {}
  fileList.forEach((file, fileIdx) => {
    const parts = file.name.split('/')
    const fileName = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)
    let currentLevel = root
    let currentPath = ''
    for (const dir of dirParts) {
      currentPath = currentPath ? `${currentPath}/${dir}` : dir
      if (!folderMap[currentPath]) {
        const folder = { type: 'folder', name: dir, path: currentPath, children: [] }
        folderMap[currentPath] = folder
        currentLevel.push(folder)
      }
      currentLevel = folderMap[currentPath].children
    }
    currentLevel.push({ type: 'file', name: fileName, fileIdx, file })
  })
  return root
}

const fileTree = computed(() => buildTree(files.value))

const totalTests = computed(() =>
  files.value.reduce((sum, f) => sum + f.tests.length, 0)
)
const selectedCount = computed(() =>
  files.value.reduce((sum, f) => sum + f.tests.filter(t => t.selected).length, 0)
)
const allSelected = computed(() =>
  totalTests.value > 0 && selectedCount.value === totalTests.value
)
const someSelected = computed(() =>
  selectedCount.value > 0 && selectedCount.value < totalTests.value
)

function toggleAll() {
  const val = !allSelected.value
  files.value.forEach(f => f.tests.forEach(t => { t.selected = val }))
}

function getAllFolderPaths(nodes) {
  const paths = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      paths.push(node.path)
      paths.push(...getAllFolderPaths(node.children))
    }
  }
  return paths
}

function expandAll() {
  const folders = {}
  getAllFolderPaths(fileTree.value).forEach(p => { folders[p] = true })
  folderExpanded.value = folders
  const fileMap = {}
  files.value.forEach(f => { fileMap[f.name] = true })
  fileExpanded.value = fileMap
}

function collapseAll() {
  const folders = {}
  getAllFolderPaths(fileTree.value).forEach(p => { folders[p] = false })
  folderExpanded.value = folders
  const fileMap = {}
  files.value.forEach(f => { fileMap[f.name] = false })
  fileExpanded.value = fileMap
}

function expandFoldersOnly() {
  const folders = {}
  getAllFolderPaths(fileTree.value).forEach(p => { folders[p] = true })
  folderExpanded.value = folders
  const fileMap = {}
  files.value.forEach(f => { fileMap[f.name] = false })
  fileExpanded.value = fileMap
}

function toggleTest({ fileIdx, testIdx }) {
  files.value[fileIdx].tests[testIdx].selected = !files.value[fileIdx].tests[testIdx].selected
}

function toggleFile({ fileIdx }) {
  const file = files.value[fileIdx]
  const allFileSelected = file.tests.every(t => t.selected)
  file.tests.forEach(t => { t.selected = !allFileSelected })
}

async function openEditor({ file }) {
  editorFile.value = file
  editorContent.value = ''
  editorError.value = ''
  editorSaved.value = false
  editorLoading.value = true
  editorModal.value = true
  try {
    const res = await fetch(`/api/tests/file?name=${encodeURIComponent(file.name)}`)
    const data = await res.json()
    if (data.error) { editorError.value = data.error; return }
    editorContent.value = data.content
    editorFile.value = { ...file, fullPath: data.path }
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.resetDirty()
        editorRef.value.focus()
      }
    })
  } catch (e) {
    editorError.value = e.message
  } finally {
    editorLoading.value = false
  }
}

async function saveEditorFile() {
  if (!editorFile.value) return
  editorSaving.value = true
  editorError.value = ''
  editorSaved.value = false
  try {
    const res = await fetch('/api/tests/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editorFile.value.name, content: editorContent.value })
    })
    const data = await res.json()
    if (data.error) { editorError.value = data.error; return }
    editorSaved.value = true
    if (editorRef.value) editorRef.value.resetDirty()
    setTimeout(() => { editorSaved.value = false }, 2500)
  } catch (e) {
    editorError.value = e.message
  } finally {
    editorSaving.value = false
  }
}

function closeEditor() {
  editorModal.value = false
  editorFile.value = null
  editorContent.value = ''
  editorError.value = ''
}

async function collectTests() {
  collecting.value = true
  collectError.value = ''
  collectWarning.value = null
  testStatuses.value = {}
  executionDone.value = false
  lastSummary.value = null

  try {
    const res = await fetch('/api/tests/collect')
    const data = await res.json()

    if (data.error) {
      collectError.value = data.error + (data.raw ? '\n\n' + data.raw : '')
      files.value = []
      return
    }

    if (data.errorFiles?.length) {
      const reason = 'Verifica que todas las dependencias estén instaladas (pip install ...)'
      collectWarning.value = { count: data.errorFiles.length, files: data.errorFiles, reason }
    }

    // Preserve selection state across refreshes
    const prevSelected = new Set(
      files.value.flatMap(f => f.tests.filter(t => t.selected).map(t => t.id))
    )

    files.value = Object.entries(data.files).map(([name, tests]) => ({
      name,
      tests: tests.map(id => ({ id, selected: prevSelected.has(id) }))
    }))
    cacheTimestamp.value = new Date().toISOString()
  } catch (e) {
    collectError.value = e.message
  } finally {
    collecting.value = false
  }
}

function confirmRun() {
  showRunModal.value = false
  runSelected()
}

async function runSelected() {
  const base = files.value.flatMap(f => f.tests.filter(t => t.selected).map(t => t.id))
  if (!base.length) return

  const repeat = Math.max(1, runRepeat.value || 1)
  const selected = Array.from({ length: repeat }, () => base).flat()

  runError.value = ''
  testStatuses.value = {}
  base.forEach(id => { testStatuses.value[id] = { status: 'pending' } })

  progress.value = { current: 0, total: selected.length, percentage: 0 }
  executionDone.value = false
  lastSummary.value = null
  executionLog.value = []
  runBaseCount.value = base.length
  expandedErrors.value = new Set()
  executionLogOpen.value = true
  runRepeat.value = 1

  const res = await fetch('/api/tests/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testIds: selected })
  })
  const data = await res.json()
  if (data.error) runError.value = data.error
}

async function abort() {
  await fetch('/api/tests/abort', { method: 'POST' })
}

function handleExecutionStarted({ total }) {
  running.value = true
  executionDone.value = false
  progress.value = { current: 0, total, percentage: 0 }
}

function handleTestStarted({ id }) {
  testStatuses.value = { ...testStatuses.value, [id]: { status: 'running' } }
}

function handleTestCompleted({ id, status, duration, errorMsg }) {
  testStatuses.value = { ...testStatuses.value, [id]: { status, duration, errorMsg } }
  executionLog.value = [...executionLog.value, { id, status, duration, errorMsg }]
}

function handleProgress(p) {
  progress.value = p
}

function handleExecutionCompleted({ reportId, summary }) {
  running.value = false
  executionDone.value = true
  lastSummary.value = summary
  progress.value = { ...progress.value, percentage: 100 }
}

function handleExecutionAborted() {
  running.value = false
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsKey(type) { return `tdb:${type}:${projectPath.value}` }
function lsSave(type, val) {
  try { localStorage.setItem(lsKey(type), JSON.stringify(val)) } catch {}
}
function lsLoad(type, fallback) {
  try { return JSON.parse(localStorage.getItem(lsKey(type))) ?? fallback } catch { return fallback }
}

// Persist selected tests whenever they change
watch(files, () => {
  if (!projectPath.value) return
  lsSave('sel', files.value.flatMap(f => f.tests.filter(t => t.selected).map(t => t.id)))
}, { deep: true })

// Persist expand/collapse state
watch([folderExpanded, fileExpanded], () => {
  if (!projectPath.value) return
  lsSave('exp', { folders: folderExpanded.value, files: fileExpanded.value })
}, { deep: true })

onMounted(async () => {
  const cfgRes = await fetch('/api/config')
  const cfg = await cfgRes.json()
  hasConfig.value = !!(cfg.projectPath)
  projectPath.value = cfg.projectPath || ''

  if (cfg.projectPath) {
    // ── Restore from cached collection (no pytest re-run needed) ──
    try {
      const cacheRes = await fetch('/api/tests/cached')
      const cached = await cacheRes.json()
      if (cached.files && Object.keys(cached.files).length) {
        const savedSelected = new Set(lsLoad('sel', []))
        files.value = Object.entries(cached.files).map(([name, tests]) => ({
          name,
          tests: tests.map(id => ({ id, selected: savedSelected.has(id) }))
        }))
        cacheTimestamp.value = cached.timestamp || null
      }
    } catch {}

    // ── Restore expand/collapse state ──
    const savedExp = lsLoad('exp', null)
    if (savedExp) {
      if (savedExp.folders) folderExpanded.value = savedExp.folders
      if (savedExp.files)   fileExpanded.value   = savedExp.files
    }
  }

  // Check if execution was already running (e.g. page refresh mid-run)
  const statusRes = await fetch('/api/tests/status')
  const status = await statusRes.json()
  running.value = status.running

  socket.on('execution:started', handleExecutionStarted)
  socket.on('test:started', handleTestStarted)
  socket.on('test:completed', handleTestCompleted)
  socket.on('progress', handleProgress)
  socket.on('execution:completed', handleExecutionCompleted)
  socket.on('execution:aborted', handleExecutionAborted)
})

onUnmounted(() => {
  socket.off('execution:started', handleExecutionStarted)
  socket.off('test:started', handleTestStarted)
  socket.off('test:completed', handleTestCompleted)
  socket.off('progress', handleProgress)
  socket.off('execution:completed', handleExecutionCompleted)
  socket.off('execution:aborted', handleExecutionAborted)
})
</script>
