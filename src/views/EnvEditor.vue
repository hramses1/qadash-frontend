<template>
  <div class="view-container">
    <h1 class="view-title">Variables de Entorno</h1>

    <div v-if="!projectPath" class="alert alert-warning">
      ⚠️ Proyecto no configurado. Ve a
      <RouterLink to="/settings">Configuración</RouterLink>.
    </div>

    <template v-else>
      <div class="env-layout">
        <!-- Left: editor -->
        <div class="env-editor-col">
          <div class="card env-file-bar">
            <label class="env-selector-label">📄 Archivo:</label>
            <select v-model="selectedFile" class="select-env" @change="load" :disabled="loading || saving">
              <option v-for="f in envFiles" :key="f" :value="f">{{ f }}</option>
            </select>
            <span v-if="envFiles.length === 0" class="hint">No hay archivos .env en el proyecto</span>
          </div>

          <div v-if="selectedFile" class="card">
            <div class="card-header">
              <code class="file-path">{{ fullPath }}</code>
              <div class="card-actions">
                <button
                  class="btn-eye"
                  @click="openVisibilityModal"
                  :title="hiddenKeys.size > 0 ? `${hiddenKeys.size} variable(s) oculta(s)` : 'Ocultar variables'"
                >
                  <span class="eye-icon">{{ hiddenKeys.size > 0 ? '🙈' : '👁' }}</span>
                  <span v-if="hiddenKeys.size > 0" class="eye-badge">{{ hiddenKeys.size }}</span>
                </button>
                <button class="btn btn-secondary" @click="load" :disabled="loading">
                  {{ loading ? '⟳' : '🔄' }} Recargar
                </button>
                <button class="btn btn-primary" @click="save" :disabled="saving || !editableVars.length">
                  {{ saving ? 'Guardando...' : '💾 Guardar' }}
                </button>
              </div>
            </div>

            <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
            <div v-if="saveMsg" class="alert alert-success">✅ {{ saveMsg }}</div>

            <template v-if="editableVars.length">
              <div class="env-header">
                <span>Variable</span>
                <span>Valor</span>
                <span></span>
              </div>
              <template v-for="(v, idx) in editableVars" :key="idx">
                <div v-if="v.isComment" class="env-comment">
                  <span>{{ v.comment || ' ' }}</span>
                </div>
                <div v-else-if="!hiddenKeys.has(v.key)" class="env-row">
                  <input v-model="v.key" type="text" class="input input-key" placeholder="VARIABLE_NAME" />
                  <input v-model="v.value" type="text" class="input input-value" placeholder="valor" />
                  <button class="btn-icon" @click="removeVar(idx)" title="Eliminar">✕</button>
                </div>
              </template>
            </template>

            <div class="env-footer">
              <button class="btn btn-secondary btn-sm" @click="addVar">+ Agregar variable</button>
            </div>
          </div>
        </div>

        <!-- Right: profiles panel -->
        <div class="profiles-col">
          <div class="card profiles-card">
            <h3 class="profiles-title">⚡ Perfiles guardados</h3>

            <div v-if="Object.keys(profiles).length === 0" class="profiles-empty">
              Sin perfiles aún. Guarda uno abajo.
            </div>

            <div v-for="(vars, name) in profiles" :key="name" class="profile-item">
              <div class="profile-name-area">
                <template v-if="renamingProfile === name">
                  <input
                    v-model="renameValue"
                    class="input profile-rename-input"
                    @keyup.enter="commitRename(name)"
                    @keyup.escape="renamingProfile = null"
                    @blur="commitRename(name)"
                    ref="renameInputRef"
                  />
                </template>
                <template v-else>
                  <button class="profile-name-btn" @click="openModal(name)" :title="`Ver variables de ${name}`">
                    <span class="profile-name">{{ name }}</span>
                    <span class="profile-count">{{ vars.filter(v => !v.isComment && v.key).length }} vars</span>
                  </button>
                </template>
              </div>
              <div class="profile-actions">
                <button class="btn-icon" @click="startRename(name)" title="Renombrar">✏️</button>
                <button class="btn btn-sm btn-secondary" @click="applyProfile(name)" title="Cargar en editor">
                  Aplicar
                </button>
                <button class="btn btn-sm btn-secondary" @click="overwriteProfile(name)" title="Sobrescribir con editor actual">
                  ↑
                </button>
                <button class="btn-icon" @click="deleteProfile(name)" title="Eliminar">✕</button>
              </div>
            </div>

            <div class="profile-save-bar">
              <input
                v-model="newProfileName"
                type="text"
                class="input"
                placeholder="Nombre del perfil..."
                @keyup.enter="saveProfile"
              />
              <button
                class="btn btn-primary btn-sm"
                @click="saveProfile"
                :disabled="!newProfileName.trim() || !editableVars.length"
                title="Guardar editor como nuevo perfil"
              >
                💾
              </button>
            </div>
            <div v-if="profileMsg" class="profile-msg">{{ profileMsg }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Visibility modal -->
    <Teleport to="body">
      <div v-if="showVisibilityModal" class="modal-backdrop" @click.self="showVisibilityModal = false">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title">👁 Variables visibles</h3>
            <button class="btn-icon" @click="showVisibilityModal = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="visibility-hint">Desmarca las que quieres ocultar del editor.</p>
            <div class="visibility-list">
              <label
                v-for="v in editableVars.filter(v => !v.isComment && v.key)"
                :key="v.key"
                class="visibility-row"
              >
                <input
                  type="checkbox"
                  :checked="!visibilityDraft.has(v.key)"
                  @change="e => toggleVisibilityDraft(v.key, e.target.checked)"
                />
                <span class="visibility-key">{{ v.key }}</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" @click="visibilityDraft = new Set()">Mostrar todas</button>
            <button class="btn btn-secondary btn-sm" @click="visibilityDraft = new Set(editableVars.filter(v => !v.isComment && v.key).map(v => v.key))">Ocultar todas</button>
            <button class="btn btn-primary" @click="applyVisibility">Aplicar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Profile detail modal -->
    <Teleport to="body">
      <div v-if="modalProfile" class="modal-backdrop" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">⚡ {{ modalProfile.name }}</h3>
            <button class="btn-icon" @click="closeModal">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="modalSaveMsg" class="alert alert-success" style="margin-bottom:10px">✅ {{ modalSaveMsg }}</div>
            <div v-if="modalVars.length === 0" class="profiles-empty">Sin variables.</div>
            <div class="modal-vars">
              <div v-for="(v, idx) in modalVars" :key="idx" class="modal-var-row modal-var-edit">
                <input v-model="v.key" class="input modal-input-key" placeholder="VARIABLE_NAME" />
                <span class="modal-var-sep">=</span>
                <input v-model="v.value" class="input modal-input-value" placeholder="valor" />
                <button class="btn-icon" @click="modalVars.splice(idx, 1)" title="Eliminar">✕</button>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-top:10px" @click="modalVars.push({ key: '', value: '', isComment: false })">
              + Agregar variable
            </button>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="applyModalToEditor">
              Aplicar al editor
            </button>
            <button class="btn btn-primary" @click="saveModalProfile" :disabled="modalSaving">
              {{ modalSaving ? 'Guardando...' : '💾 Guardar perfil' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { apiFetch } from '../composables/apiFetch.js'

const projectPath = ref('')
const envFiles = ref([])
const selectedFile = ref('')
const editableVars = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const saveMsg = ref('')
const fullPath = ref('')

const profiles = ref({})
const newProfileName = ref('')
const profileMsg = ref('')
const renamingProfile = ref(null)
const renameValue = ref('')
const renameInputRef = ref(null)

const hiddenKeys = ref(new Set())
const showVisibilityModal = ref(false)
const visibilityDraft = ref(new Set())

function lsKey() { return `env_hidden_${selectedFile.value}` }
function loadHiddenKeys() {
  try {
    const stored = localStorage.getItem(lsKey())
    hiddenKeys.value = new Set(stored ? JSON.parse(stored) : [])
  } catch { hiddenKeys.value = new Set() }
}
function saveHiddenKeys() {
  localStorage.setItem(lsKey(), JSON.stringify([...hiddenKeys.value]))
}
function openVisibilityModal() {
  visibilityDraft.value = new Set(hiddenKeys.value)
  showVisibilityModal.value = true
}
function toggleVisibilityDraft(key, isVisible) {
  const s = new Set(visibilityDraft.value)
  isVisible ? s.delete(key) : s.add(key)
  visibilityDraft.value = s
}
function applyVisibility() {
  hiddenKeys.value = new Set(visibilityDraft.value)
  saveHiddenKeys()
  showVisibilityModal.value = false
}

const modalProfile = ref(null)
const modalVars = ref([])
const modalSaving = ref(false)
const modalSaveMsg = ref('')

function openModal(name) {
  const vars = profiles.value[name] || []
  modalVars.value = vars.filter(v => !v.isComment).map(v => ({ ...v }))
  modalProfile.value = { name }
  modalSaveMsg.value = ''
}
function closeModal() {
  modalProfile.value = null
  modalVars.value = []
  modalSaveMsg.value = ''
}

async function saveModalProfile() {
  if (!modalProfile.value) return
  modalSaving.value = true
  await apiFetch(`/api/profiles/${encodeURIComponent(modalProfile.value.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vars: modalVars.value.filter(v => v.key) })
  })
  await loadProfiles()
  modalSaving.value = false
  modalSaveMsg.value = 'Guardado'
  setTimeout(() => { modalSaveMsg.value = '' }, 2000)
}

function applyModalToEditor() {
  editableVars.value = modalVars.value.map(v => ({ ...v }))
  saveMsg.value = ''
  error.value = ''
  profileMsg.value = `Perfil "${modalProfile.value.name}" cargado en editor`
  setTimeout(() => { profileMsg.value = '' }, 2500)
  closeModal()
}

async function loadFiles() {
  const res = await apiFetch('/api/env/files')
  const data = await res.json()
  envFiles.value = data.files || []
  if (envFiles.value.length > 0 && !selectedFile.value) {
    selectedFile.value = envFiles.value[0]
  }
}

async function load() {
  if (!selectedFile.value) return
  loading.value = true
  error.value = ''
  saveMsg.value = ''
  try {
    const res = await apiFetch(`/api/env?file=${encodeURIComponent(selectedFile.value)}`)
    const data = await res.json()
    if (data.error) { error.value = data.error; return }
    fullPath.value = data.path
    editableVars.value = data.vars.map(v => ({ ...v }))
    loadHiddenKeys()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saveMsg.value = ''
  error.value = ''
  try {
    const res = await apiFetch(`/api/env?file=${encodeURIComponent(selectedFile.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vars: editableVars.value })
    })
    const data = await res.json()
    if (data.error) error.value = data.error
    else saveMsg.value = 'Guardado correctamente'
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function addVar() {
  editableVars.value.push({ key: '', value: '', isComment: false })
}

function removeVar(idx) {
  editableVars.value.splice(idx, 1)
}

async function startRename(name) {
  renamingProfile.value = name
  renameValue.value = name
  await nextTick()
  const el = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
  el?.focus()
  el?.select()
}

async function commitRename(oldName) {
  if (renamingProfile.value !== oldName) return
  renamingProfile.value = null
  const newName = renameValue.value.trim()
  if (!newName || newName === oldName) return
  await apiFetch(`/api/profiles/${encodeURIComponent(oldName)}/rename`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName })
  })
  if (modalProfile.value?.name === oldName) modalProfile.value = { name: newName }
  await loadProfiles()
}

async function loadProfiles() {
  const res = await apiFetch('/api/profiles')
  profiles.value = await res.json()
}

async function saveProfile() {
  const name = newProfileName.value.trim()
  if (!name || !editableVars.value.length) return
  await apiFetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vars: editableVars.value.filter(v => !v.isComment) })
  })
  newProfileName.value = ''
  profileMsg.value = `Perfil "${name}" guardado`
  setTimeout(() => { profileMsg.value = '' }, 2500)
  await loadProfiles()
}

async function overwriteProfile(name) {
  await apiFetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vars: editableVars.value.filter(v => !v.isComment) })
  })
  profileMsg.value = `"${name}" actualizado`
  setTimeout(() => { profileMsg.value = '' }, 2500)
  await loadProfiles()
}

function applyProfile(name) {
  const vars = profiles.value[name]
  if (!vars) return
  editableVars.value = vars.map(v => ({ ...v }))
  saveMsg.value = ''
  error.value = ''
  profileMsg.value = `Perfil "${name}" cargado en editor`
  setTimeout(() => { profileMsg.value = '' }, 2500)
}

async function deleteProfile(name) {
  if (modalProfile.value?.name === name) closeModal()
  await apiFetch(`/api/profiles/${encodeURIComponent(name)}`, { method: 'DELETE' })
  await loadProfiles()
}

onMounted(async () => {
  const cfgRes = await apiFetch('/api/config')
  const cfg = await cfgRes.json()
  projectPath.value = cfg.projectPath || ''
  if (cfg.projectPath) {
    await Promise.all([loadFiles(), loadProfiles()])
    if (selectedFile.value) load()
  } else {
    await loadProfiles()
  }
})
</script>
