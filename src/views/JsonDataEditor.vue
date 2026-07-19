<template>
  <div class="view-container">
    <h1 class="view-title">Datos JSON</h1>

    <!-- Sin carpeta configurada -->
    <div v-if="loaded && !configured" class="alert alert-warning">
      ⚠️ Carpeta de datos JSON no configurada. Ve a
      <RouterLink to="/settings">Configuración</RouterLink> y selecciona la carpeta
      (ej. <code>src\data\dataTest</code>).
    </div>

    <div v-else-if="treeError" class="alert alert-error">❌ {{ treeError }}</div>

    <template v-else-if="configured">
      <!-- Selector carpeta / archivo -->
      <div class="card selector-bar">
        <div class="sel-field">
          <label class="sel-label">📁 Carpeta</label>
          <select v-model="selectedFolder" class="sel-input" @change="onFolderChange">
            <option v-for="g in tree" :key="g.folder" :value="g.folder">
              {{ g.folder || '(raíz)' }} ({{ g.files.length }})
            </option>
          </select>
        </div>
        <div class="sel-field">
          <label class="sel-label">📄 Archivo</label>
          <select v-model="selectedFile" class="sel-input" @change="loadFile" :disabled="!currentFiles.length">
            <option v-if="!currentFiles.length" value="">— sin archivos —</option>
            <option v-for="f in currentFiles" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <button class="btn btn-secondary" @click="loadTree" :disabled="loading" title="Refrescar lista">↺</button>
      </div>

      <div v-if="selectedFile" class="editor-layout">
        <!-- Editor -->
        <div class="editor-col">
          <div class="card">
            <div class="card-header">
              <code class="file-path">{{ currentPath }}</code>
              <div class="card-actions">
                <button class="btn btn-secondary" @click="loadFile" :disabled="loading">
                  {{ loading ? '⟳' : '🔄' }} Recargar
                </button>
                <button class="btn btn-primary" @click="saveFile" :disabled="saving || !hasData">
                  {{ saving ? 'Guardando...' : '💾 Guardar' }}
                </button>
              </div>
            </div>

            <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
            <div v-if="saveMsg" class="alert alert-success">✅ {{ saveMsg }}</div>

            <div v-if="loading" class="empty-state">Cargando...</div>
            <div v-else-if="hasData" class="json-tree">
              <JsonNode :container="holder" prop-key="value" :is-root="true" />
            </div>
          </div>
        </div>

        <!-- Snapshots / perfiles -->
        <div class="snap-col">
          <div class="card snap-card">
            <h3 class="snap-title">⚡ Datos guardados</h3>
            <p class="snap-hint">Guarda versiones de este archivo y aplícalas cuando las necesites.</p>

            <div v-if="Object.keys(snapshots).length === 0" class="snap-empty">
              Aún no hay versiones guardadas.
            </div>

            <div v-for="(data, name) in snapshots" :key="name" class="snap-item">
              <button class="snap-name" @click="openSnapshotEditor(name)" title="Editar esta versión">
                <span class="snap-dot"></span>{{ name }}
              </button>
              <div class="snap-actions">
                <button class="btn btn-sm btn-secondary" @click="applySnapshot(name)" title="Cargar en el editor">
                  Aplicar
                </button>
                <button class="btn btn-sm btn-secondary" @click="saveSnapshot(name)" title="Sobrescribir con lo del editor">↑</button>
                <button class="btn-icon" @click="deleteSnapshot(name)" title="Eliminar">✕</button>
              </div>
            </div>

            <div class="snap-save-bar">
              <input
                v-model="newSnapName"
                type="text"
                class="input"
                placeholder="Nombre de la versión..."
                @keyup.enter="saveSnapshot(newSnapName)"
              />
              <button
                class="btn btn-primary btn-sm"
                @click="saveSnapshot(newSnapName)"
                :disabled="!newSnapName.trim() || !hasData"
                title="Guardar editor como nueva versión"
              >💾</button>
            </div>
            <div v-if="snapMsg" class="snap-msg">{{ snapMsg }}</div>
          </div>
        </div>
      </div>

      <div v-else-if="!currentFiles.length" class="card empty-card">
        <p class="hint-text">No hay archivos <code>.json</code> en esta carpeta.</p>
      </div>
    </template>

    <!-- Modal: editar versión guardada -->
    <Teleport to="body">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
        <div class="modal json-modal">
          <div class="modal-header">
            <h3 class="modal-title">⚡ Editar versión: {{ modalName }}</h3>
            <button class="btn-icon" @click="closeModal">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="modalMsg" class="alert alert-success" style="margin-bottom:.75rem">✅ {{ modalMsg }}</div>
            <div class="json-tree">
              <JsonNode v-if="modalHasData" :container="modalHolder" prop-key="value" :is-root="true" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="applyModalToEditor" title="Cargar esta versión en el editor principal">
              Cargar en el editor
            </button>
            <button class="btn btn-primary" @click="saveModal" :disabled="modalSaving">
              {{ modalSaving ? 'Guardando...' : '💾 Guardar versión' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { apiFetch } from '../composables/apiFetch.js'
import JsonNode from '../components/JsonNode.vue'

const loaded = ref(false)
const configured = ref(false)
const tree = ref([])
const treeError = ref('')

const selectedFolder = ref('')
const selectedFile = ref('')
const currentPath = ref('')

const holder = reactive({ value: null })
const hasData = computed(() => holder.value !== null && holder.value !== undefined)

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const saveMsg = ref('')

const snapshots = ref({})
const newSnapName = ref('')
const snapMsg = ref('')

// Edición de versión guardada (modal)
const modalOpen = ref(false)
const modalName = ref('')
const modalHolder = reactive({ value: null })
const modalHasData = computed(() => modalHolder.value !== null && modalHolder.value !== undefined)
const modalSaving = ref(false)
const modalMsg = ref('')

const currentFiles = computed(() => {
  const g = tree.value.find(g => g.folder === selectedFolder.value)
  return g ? g.files : []
})

function q() {
  const p = new URLSearchParams()
  if (selectedFolder.value) p.set('folder', selectedFolder.value)
  p.set('file', selectedFile.value)
  return p.toString()
}

function clone(v) {
  return JSON.parse(JSON.stringify(v))
}

async function loadTree() {
  treeError.value = ''
  try {
    const res = await apiFetch('/api/jsondata/tree')
    const data = await res.json()
    configured.value = !!data.configured
    if (data.error) { treeError.value = data.error; tree.value = []; return }
    tree.value = data.tree || []
    if (tree.value.length) {
      const stillThere = tree.value.some(g => g.folder === selectedFolder.value)
      if (!stillThere) selectedFolder.value = tree.value[0].folder
      if (!currentFiles.value.includes(selectedFile.value)) {
        selectedFile.value = currentFiles.value[0] || ''
      }
      if (selectedFile.value) await loadFile()
    }
  } catch (e) {
    treeError.value = e.message
  } finally {
    loaded.value = true
  }
}

function onFolderChange() {
  selectedFile.value = currentFiles.value[0] || ''
  holder.value = null
  currentPath.value = ''
  if (selectedFile.value) loadFile()
}

async function loadFile() {
  if (!selectedFile.value) return
  loading.value = true
  error.value = ''
  saveMsg.value = ''
  try {
    const res = await apiFetch(`/api/jsondata/file?${q()}`)
    const data = await res.json()
    if (data.error) { error.value = data.error; holder.value = null; return }
    holder.value = data.data
    currentPath.value = data.path
    await loadSnapshots()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function saveFile() {
  saving.value = true
  saveMsg.value = ''
  error.value = ''
  try {
    const res = await apiFetch(`/api/jsondata/file?${q()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: holder.value })
    })
    const data = await res.json()
    if (data.error) error.value = data.error
    else saveMsg.value = 'Guardado en el archivo'
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function loadSnapshots() {
  try {
    const res = await apiFetch(`/api/jsondata/snapshots?${q()}`)
    snapshots.value = await res.json()
  } catch { snapshots.value = {} }
}

async function saveSnapshot(name) {
  const n = (name || '').trim()
  if (!n || !hasData.value) return
  await apiFetch(`/api/jsondata/snapshots/${encodeURIComponent(n)}?${q()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: holder.value })
  })
  newSnapName.value = ''
  snapMsg.value = `"${n}" guardada`
  setTimeout(() => { snapMsg.value = '' }, 2500)
  await loadSnapshots()
}

function applySnapshot(name) {
  const data = snapshots.value[name]
  if (data === undefined) return
  holder.value = clone(data)
  saveMsg.value = ''
  error.value = ''
  snapMsg.value = `"${name}" cargada en el editor (recuerda Guardar)`
  setTimeout(() => { snapMsg.value = '' }, 3000)
}

async function deleteSnapshot(name) {
  await apiFetch(`/api/jsondata/snapshots/${encodeURIComponent(name)}?${q()}`, { method: 'DELETE' })
  await loadSnapshots()
}

function openSnapshotEditor(name) {
  modalName.value = name
  modalHolder.value = clone(snapshots.value[name])
  modalMsg.value = ''
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  modalHolder.value = null
}

async function saveModal() {
  if (!modalName.value) return
  modalSaving.value = true
  try {
    await apiFetch(`/api/jsondata/snapshots/${encodeURIComponent(modalName.value)}?${q()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: modalHolder.value })
    })
    await loadSnapshots()
    modalMsg.value = 'Versión guardada'
    setTimeout(() => { modalMsg.value = '' }, 2000)
  } finally {
    modalSaving.value = false
  }
}

function applyModalToEditor() {
  holder.value = clone(modalHolder.value)
  saveMsg.value = ''
  error.value = ''
  snapMsg.value = `"${modalName.value}" cargada en el editor (recuerda Guardar)`
  setTimeout(() => { snapMsg.value = '' }, 3000)
  closeModal()
}

onMounted(loadTree)
</script>

<style scoped>
.selector-bar {
  display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; padding: 1rem;
}
.sel-field { display: flex; flex-direction: column; gap: .3rem; min-width: 200px; }
.sel-field:last-of-type { flex: 1 1 240px; }
.sel-label {
  font-size: .72rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: .03em; opacity: .6;
}
.sel-input {
  height: 38px; padding: 0 .7rem; font-size: .85rem;
  border: 1px solid var(--border, #e2e8f0); border-radius: 8px;
  background: var(--bg, #fff); color: inherit; width: 100%;
}
.sel-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }

.editor-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1rem; align-items: start; }
@media (max-width: 900px) { .editor-layout { grid-template-columns: 1fr; } }

.card-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; flex-wrap: wrap; margin-bottom: .75rem;
}
.file-path { font-size: .78rem; opacity: .7; word-break: break-all; }
.card-actions { display: flex; gap: .5rem; }

.json-tree {
  margin-top: .5rem; max-height: 68vh; overflow: auto;
  padding: .5rem; border: 1px solid var(--border, #eef2f7); border-radius: 8px;
  background: var(--bg-secondary, #fbfcfe);
}

.snap-card { position: sticky; top: 1rem; }
.snap-title { font-weight: 600; font-size: .95rem; margin: 0 0 .25rem; }
.snap-hint { font-size: .78rem; opacity: .65; margin: 0 0 .75rem; }
.snap-empty { font-size: .82rem; opacity: .6; padding: .5rem 0; }
.snap-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: .5rem; padding: .45rem 0; border-bottom: 1px solid var(--border, #f1f5f9);
}
.snap-name {
  display: flex; align-items: center; gap: .45rem;
  font-size: .85rem; font-weight: 600; color: #4338ca;
  background: none; border: none; cursor: pointer; padding: .1rem 0;
  text-align: left; word-break: break-word; min-width: 0;
}
.snap-name:hover { text-decoration: underline; }
.snap-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
.snap-actions { display: flex; align-items: center; gap: .25rem; flex-shrink: 0; }

/* Modal editar versión */
.json-modal { width: 720px; max-width: 95vw; max-height: 85vh; }
.json-modal .json-tree { max-height: 60vh; }
.snap-save-bar { display: flex; gap: .5rem; margin-top: .85rem; }
.snap-save-bar .input { flex: 1; }
.snap-msg { font-size: .8rem; color: #16a34a; margin-top: .5rem; }

.empty-state { padding: 2rem; text-align: center; opacity: .6; }
.empty-card { padding: 1.5rem; }
.btn-icon { background: none; border: none; cursor: pointer; opacity: .5; font-size: .9rem; color: inherit; }
.btn-icon:hover { opacity: 1; color: #ef4444; }
</style>
