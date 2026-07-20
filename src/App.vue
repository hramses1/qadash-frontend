<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo">⚡ Test Dashboard</span>
      </div>

      <!-- Switcher de workspace (perfil), alineado a la paleta del sidebar -->
      <div class="ws">
        <span class="ws-eyebrow">Workspace</span>

        <button
          class="ws-current"
          :class="{ open: menuOpen }"
          :aria-expanded="menuOpen"
          aria-haspopup="listbox"
          @click="menuOpen = !menuOpen"
        >
          <span class="ws-dot" :class="{ live: activeRunning }" aria-hidden="true"></span>
          <span class="ws-current-name">{{ activeProfile?.name || 'Sin perfil' }}</span>
          <svg class="ws-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div v-if="menuOpen" class="ws-backdrop" @click="menuOpen = false"></div>

        <ul v-if="menuOpen" class="ws-menu" role="listbox">
          <li
            v-for="p in profiles"
            :key="p.id"
            class="ws-option"
            :class="{ selected: p.id === activeProfileId }"
            role="option"
            :aria-selected="p.id === activeProfileId"
            tabindex="0"
            @click="pick(p.id)"
            @keyup.enter="pick(p.id)"
          >
            <span class="ws-dot" :class="{ live: runningIds.has(p.id) }" aria-hidden="true"></span>
            <span class="ws-option-name">{{ p.name }}</span>
            <span v-if="runningIds.has(p.id)" class="ws-tag">corriendo</span>
            <span v-else-if="p.id === activeProfileId" class="ws-check" aria-hidden="true">✓</span>
          </li>
          <li class="ws-menu-foot">
            <button class="ws-manage" @click="openManager">⚙ Gestionar workspaces</button>
          </li>
        </ul>
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

    <!-- Panel de gestión de workspaces: modal claro, estilo del dashboard -->
    <div v-if="showManager" class="modal-backdrop" @click.self="showManager = false">
      <div class="modal wm-modal" role="dialog" aria-label="Gestionar workspaces">
        <div class="modal-header">
          <h3 class="modal-title">Workspaces</h3>
          <button class="btn-icon" aria-label="Cerrar" @click="showManager = false">✕</button>
        </div>

        <div class="modal-body">
          <p class="wm-sub">Cada workspace corre aislado. Puedes ejecutar varios a la vez sin que se interfieran.</p>
          <p v-if="pmError" class="alert alert-error">{{ pmError }}</p>

          <ul class="wm-list">
            <li
              v-for="p in profiles"
              :key="p.id"
              class="wm-item"
              :class="{ active: p.id === activeProfileId }"
            >
              <div class="wm-info">
                <div class="wm-name-row">
                  <span class="ws-dot" :class="{ live: runningIds.has(p.id) }" aria-hidden="true"></span>
                  <span class="wm-name">{{ p.name }}</span>
                  <span v-if="p.id === activeProfileId" class="wm-badge active-badge">activo</span>
                  <span v-if="runningIds.has(p.id)" class="wm-badge live-badge">corriendo</span>
                </div>
                <span class="wm-id">{{ p.id }}</span>
              </div>
              <div class="wm-actions">
                <button v-if="p.id !== activeProfileId" class="btn btn-primary btn-sm" @click="doActivate(p.id)">Usar</button>
                <button class="btn btn-secondary btn-sm" @click="startRename(p)">Renombrar</button>
                <button class="btn btn-secondary btn-sm" @click="doDuplicate(p)">Duplicar</button>
                <button class="btn btn-danger btn-sm" :disabled="profiles.length <= 1" @click="doDelete(p)">Borrar</button>
              </div>
            </li>
          </ul>
        </div>

        <div class="modal-footer wm-footer">
          <input v-model="newName" class="wm-input" placeholder="Nombre del nuevo workspace" @keyup.enter="doCreate" />
          <button class="btn btn-primary" @click="doCreate">+ Crear workspace</button>
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

const menuOpen = ref(false)
const showManager = ref(false)
const newName = ref('')
const pmError = ref('')

const activeProfile = computed(() => profiles.value.find(p => p.id === activeProfileId.value) || null)
const activeRunning = computed(() => runningIds.value.has(activeProfileId.value))

onMounted(async () => {
  await loadProfiles()
  await loadFeatures()
})

// Cambiar de workspace: activa en backend y recarga para que todas las vistas y
// composables carguen el estado del nuevo workspace de forma limpia y aislada.
async function pick(id) {
  menuOpen.value = false
  if (id === activeProfileId.value) return
  try { await setActive(id); window.location.reload() }
  catch (err) { pmError.value = err.message; showManager.value = true }
}

function openManager() {
  menuOpen.value = false
  pmError.value = ''
  showManager.value = true
}

async function doActivate(id) {
  try { await setActive(id); window.location.reload() }
  catch (err) { pmError.value = err.message }
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
  const name = window.prompt('Nuevo nombre del workspace', p.name)
  if (!name || !name.trim()) return
  pmError.value = ''
  try { await renameProfile(p.id, name.trim()) }
  catch (err) { pmError.value = err.message }
}

async function doDuplicate(p) {
  const name = window.prompt('Nombre del workspace duplicado', `${p.name} (copia)`)
  if (!name || !name.trim()) return
  pmError.value = ''
  try { await duplicateProfile(p.id, name.trim()) }
  catch (err) { pmError.value = err.message }
}

async function doDelete(p) {
  if (runningIds.value.has(p.id)) { pmError.value = 'Workspace en ejecución; deténlo antes de borrar'; return }
  if (!window.confirm(`¿Borrar el workspace "${p.name}"? Se eliminan su configuración y reportes.`)) return
  pmError.value = ''
  const wasActive = p.id === activeProfileId.value
  try {
    await deleteProfile(p.id)
    if (wasActive) window.location.reload()
  } catch (err) { pmError.value = err.message }
}
</script>

<style scoped>
/* ── Switcher de workspace: mismos tokens que el nav del sidebar ──── */
.ws { position: relative; margin: 8px 8px 6px; }
.ws-eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #64748b;
  margin: 0 4px 5px;
}
.ws-current {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.12s, background 0.12s;
}
.ws-current:hover { background: #334155; border-color: #475569; }
.ws-current.open { border-color: #60a5fa; background: #0f172a; }
.ws-current-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-chevron { color: #94a3b8; flex-shrink: 0; transition: transform 0.18s; }
.ws-current.open .ws-chevron { transform: rotate(180deg); }

.ws-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #64748b;
}
.ws-dot.live {
  background: #4ade80;
  box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5);
  animation: ws-pulse 1.8s ease-out infinite;
}
@keyframes ws-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
  100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.ws-backdrop { position: fixed; inset: 0; z-index: 40; }
.ws-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 5px);
  left: 0; right: 0;
  margin: 0; padding: 5px;
  list-style: none;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  box-shadow: 0 12px 28px rgba(2, 6, 23, 0.55);
}
.ws-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: #94a3b8;
  transition: background 0.12s, color 0.12s;
}
.ws-option:hover, .ws-option:focus-visible { background: #334155; color: #f1f5f9; outline: none; }
.ws-option:focus-visible { box-shadow: inset 0 0 0 1px #60a5fa; }
.ws-option.selected { background: #0f172a; color: #60a5fa; font-weight: 500; }
.ws-option-name { flex: 1; min-width: 0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ws-check { color: #60a5fa; font-size: 13px; }
.ws-tag {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.4);
  border-radius: 999px;
  padding: 1px 7px;
}
.ws-menu-foot { margin-top: 4px; border-top: 1px solid #334155; padding-top: 5px; }
.ws-manage {
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #60a5fa;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.ws-manage:hover { background: #334155; }

/* ── Panel de gestión: reutiliza .modal del dashboard (claro) ─────── */
.wm-modal { width: 560px; }
.wm-sub { font-size: 13px; color: #64748b; margin: 0 0 14px; }
.wm-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.wm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  transition: border-color 0.14s, background 0.14s;
}
.wm-item:hover { border-color: #cbd5e1; background: #f8fafc; }
.wm-item.active { border-color: #bfdbfe; background: #eff6ff; }
.wm-info { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.wm-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wm-name { font-weight: 600; font-size: 14px; color: #1e293b; }
.wm-id {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  color: #94a3b8;
}
.wm-badge {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 8px;
  font-weight: 600;
}
.active-badge { color: #2563eb; background: #dbeafe; }
.live-badge { color: #16a34a; background: #dcfce7; }
.wm-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.wm-footer { align-items: center; gap: 10px; }
.wm-input {
  flex: 1;
  padding: 8px 11px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #1e293b;
  font-size: 13px;
}
.wm-input::placeholder { color: #94a3b8; }
.wm-input:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18); }

@media (prefers-reduced-motion: reduce) {
  .ws-dot.live { animation: none; box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.3); }
  .ws-chevron, .ws-current { transition: none; }
}
@media (max-width: 720px) {
  .wm-item { flex-direction: column; align-items: flex-start; }
  .wm-actions { justify-content: flex-start; }
  .wm-footer { flex-direction: column; align-items: stretch; }
}
</style>
