<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo">⚡ Test Dashboard</span>
      </div>

      <!-- Selector de perfil (workspace) -->
      <div class="profile-switcher">
        <label class="profile-label">Perfil</label>
        <div class="profile-row">
          <select class="profile-select" :value="activeProfileId" @change="onSwitch">
            <option v-for="p in profiles" :key="p.id" :value="p.id">
              {{ runningIds.has(p.id) ? '● ' : '' }}{{ p.name }}
            </option>
          </select>
          <button class="profile-manage" title="Gestionar perfiles" @click="openManager">⚙</button>
        </div>
        <span v-if="activeRunning" class="profile-running">● corriendo</span>
      </div>

      <ul class="nav-list">
        <li>
          <RouterLink to="/dashboard" class="nav-link">
            <span class="nav-icon">🧪</span>
            <span>Tests</span>
          </RouterLink>
        </li>
        <li v-for="f in FEATURE_MAP" :key="f.key" v-show="isEnabled(f.key)">
          <RouterLink :to="f.path" class="nav-link">
            <span class="nav-icon">{{ f.icon }}</span>
            <span>{{ f.label }}</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings" class="nav-link">
            <span class="nav-icon">🔧</span>
            <span>Configuración</span>
          </RouterLink>
        </li>
      </ul>
      <div class="sidebar-footer">
        <span class="connection-status" :class="connected ? 'connected' : 'disconnected'">
          {{ connected ? '● Conectado' : '● Desconectado' }}
        </span>
      </div>
    </nav>
    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="['Dashboard', 'Docker']">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>

    <!-- Modal de gestión de perfiles -->
    <div v-if="showManager" class="pm-overlay" @click.self="showManager = false">
      <div class="pm-modal">
        <div class="pm-head">
          <h3>Perfiles</h3>
          <button class="pm-close" @click="showManager = false">✕</button>
        </div>

        <p v-if="pmError" class="pm-error">{{ pmError }}</p>

        <ul class="pm-list">
          <li v-for="p in profiles" :key="p.id" class="pm-item" :class="{ active: p.id === activeProfileId }">
            <span class="pm-name">
              <span v-if="runningIds.has(p.id)" class="pm-dot" title="Corriendo">●</span>
              {{ p.name }}
            </span>
            <span class="pm-actions">
              <button v-if="p.id !== activeProfileId" @click="doActivate(p.id)">Usar</button>
              <button @click="startRename(p)">Renombrar</button>
              <button @click="doDuplicate(p)">Duplicar</button>
              <button class="pm-del" :disabled="profiles.length <= 1" @click="doDelete(p)">Borrar</button>
            </span>
          </li>
        </ul>

        <div class="pm-create">
          <input v-model="newName" placeholder="Nombre del nuevo perfil" @keyup.enter="doCreate" />
          <button class="pm-primary" @click="doCreate">Crear perfil</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { useSocket } from './composables/useSocket'
import { useFeatures } from './composables/useFeatures'
import { useProfiles } from './composables/useProfiles'
import { FEATURE_MAP } from './composables/featureMap'

const { connected } = useSocket()
const { isEnabled, loadFeatures } = useFeatures()
const {
  profiles, activeProfileId, runningIds,
  loadProfiles, setActive, createProfile, renameProfile, duplicateProfile, deleteProfile,
} = useProfiles()

const showManager = ref(false)
const newName = ref('')
const pmError = ref('')

const activeRunning = computed(() => runningIds.value.has(activeProfileId.value))

onMounted(async () => {
  await loadProfiles()
  await loadFeatures()
})

// Cambiar de perfil: activa en backend y recarga para que todas las vistas y
// composables carguen el estado del nuevo perfil de forma limpia y aislada.
async function onSwitch(e) {
  const id = e.target.value
  if (id === activeProfileId.value) return
  await setActive(id)
  window.location.reload()
}

function openManager() {
  pmError.value = ''
  showManager.value = true
}

async function doActivate(id) {
  await setActive(id)
  window.location.reload()
}

async function doCreate() {
  pmError.value = ''
  const name = newName.value.trim()
  if (!name) return
  try {
    await createProfile(name)
    newName.value = ''
  } catch (err) { pmError.value = err.message }
}

async function startRename(p) {
  const name = window.prompt('Nuevo nombre del perfil', p.name)
  if (!name || !name.trim()) return
  pmError.value = ''
  try { await renameProfile(p.id, name.trim()) }
  catch (err) { pmError.value = err.message }
}

async function doDuplicate(p) {
  const name = window.prompt('Nombre del perfil duplicado', `${p.name} (copia)`)
  if (!name || !name.trim()) return
  pmError.value = ''
  try { await duplicateProfile(p.id, name.trim()) }
  catch (err) { pmError.value = err.message }
}

async function doDelete(p) {
  if (runningIds.value.has(p.id)) { pmError.value = 'Perfil en ejecución; deténlo antes de borrar'; return }
  if (!window.confirm(`¿Borrar el perfil "${p.name}"? Se eliminan su config y reportes.`)) return
  pmError.value = ''
  const wasActive = p.id === activeProfileId.value
  try {
    await deleteProfile(p.id)
    if (wasActive) window.location.reload()
  } catch (err) { pmError.value = err.message }
}
</script>

<style scoped>
.profile-switcher {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.profile-label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
  margin-bottom: 4px;
}
.profile-row { display: flex; gap: 6px; }
.profile-select {
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font-size: 0.85rem;
}
.profile-manage {
  width: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  cursor: pointer;
}
.profile-manage:hover { background: rgba(255, 255, 255, 0.1); }
.profile-running {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.72rem;
  color: #22c55e;
}

.pm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.pm-modal {
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 10px;
  width: min(560px, 92vw);
  max-height: 82vh;
  overflow: auto;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}
.pm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.pm-head h3 { margin: 0; }
.pm-close { background: none; border: none; color: inherit; font-size: 1.1rem; cursor: pointer; }
.pm-error { color: #f87171; font-size: 0.85rem; margin: 4px 0 10px; }
.pm-list { list-style: none; margin: 0 0 16px; padding: 0; }
.pm-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 8px;
}
.pm-item.active { border-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
.pm-name { font-weight: 500; }
.pm-dot { color: #22c55e; margin-right: 4px; }
.pm-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pm-actions button {
  padding: 4px 8px;
  font-size: 0.78rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  cursor: pointer;
}
.pm-actions button:hover { background: rgba(255, 255, 255, 0.14); }
.pm-del { color: #f87171; }
.pm-del:disabled { opacity: 0.4; cursor: not-allowed; }
.pm-create { display: flex; gap: 8px; }
.pm-create input {
  flex: 1;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
}
.pm-primary {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: #3b82f6;
  color: white;
  cursor: pointer;
}
.pm-primary:hover { background: #2563eb; }
</style>
