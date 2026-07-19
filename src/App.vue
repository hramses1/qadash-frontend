<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo">⚡ Test Dashboard</span>
      </div>

      <!-- Switcher de workspace (perfil) -->
      <div class="ws">
        <span class="ws-eyebrow">Workspace activo</span>

        <button
          class="ws-current"
          :class="{ live: activeRunning, open: menuOpen }"
          :aria-expanded="menuOpen"
          aria-haspopup="listbox"
          @click="menuOpen = !menuOpen"
        >
          <span class="ws-status" :class="{ live: activeRunning }" aria-hidden="true"></span>
          <span class="ws-current-text">
            <span class="ws-current-name">{{ activeProfile?.name || 'Sin perfil' }}</span>
            <span class="ws-current-id">{{ activeProfile?.id || '—' }}</span>
          </span>
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
            <span class="ws-status" :class="{ live: runningIds.has(p.id) }" aria-hidden="true"></span>
            <span class="ws-option-text">
              <span class="ws-option-name">{{ p.name }}</span>
              <span class="ws-option-id">{{ p.id }}</span>
            </span>
            <span v-if="runningIds.has(p.id)" class="ws-tag">corriendo</span>
            <span v-else-if="p.id === activeProfileId" class="ws-check" aria-hidden="true">✓</span>
          </li>
          <li class="ws-menu-foot">
            <button class="ws-manage" @click="openManager">Gestionar workspaces</button>
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

    <!-- Panel de gestión de workspaces -->
    <div v-if="showManager" class="wm-overlay" @click.self="showManager = false">
      <div class="wm-panel" role="dialog" aria-label="Gestionar workspaces">
        <header class="wm-head">
          <div>
            <span class="wm-eyebrow">Workspaces</span>
            <h3 class="wm-title">Automatizaciones</h3>
          </div>
          <button class="wm-close" aria-label="Cerrar" @click="showManager = false">✕</button>
        </header>

        <p class="wm-sub">Cada workspace corre aislado. Puedes ejecutar varios a la vez sin que se interfieran.</p>
        <p v-if="pmError" class="wm-error">{{ pmError }}</p>

        <ul class="wm-list">
          <li
            v-for="p in profiles"
            :key="p.id"
            class="wm-card"
            :class="{ active: p.id === activeProfileId, live: runningIds.has(p.id) }"
          >
            <span class="wm-rail" aria-hidden="true"></span>
            <div class="wm-info">
              <div class="wm-name-row">
                <span class="ws-status" :class="{ live: runningIds.has(p.id) }" aria-hidden="true"></span>
                <span class="wm-name">{{ p.name }}</span>
                <span v-if="p.id === activeProfileId" class="wm-badge active-badge">activo</span>
                <span v-if="runningIds.has(p.id)" class="wm-badge live-badge">corriendo</span>
              </div>
              <span class="wm-id">{{ p.id }}</span>
            </div>
            <div class="wm-actions">
              <button v-if="p.id !== activeProfileId" class="wm-btn primary" @click="doActivate(p.id)">Usar</button>
              <button class="wm-btn" title="Renombrar" @click="startRename(p)">Renombrar</button>
              <button class="wm-btn" title="Duplicar" @click="doDuplicate(p)">Duplicar</button>
              <button class="wm-btn danger" :disabled="profiles.length <= 1" title="Borrar" @click="doDelete(p)">Borrar</button>
            </div>
          </li>
        </ul>

        <div class="wm-create">
          <input v-model="newName" class="wm-input" placeholder="Nombre del nuevo workspace" @keyup.enter="doCreate" />
          <button class="wm-btn primary big" @click="doCreate">+ Crear workspace</button>
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
  await setActive(id)
  window.location.reload()
}

function openManager() {
  menuOpen.value = false
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
/* ── Workspace switcher ─────────────────────────────────────────────
   Seña del producto: elegir "workspace" de automatización, con estado
   en vivo legible de un vistazo (clave para ejecución en paralelo). */
.ws {
  position: relative;
  margin: 14px 14px 6px;
  --ind-1: #6366f1;
  --ind-2: #8b5cf6;
  --ind-soft: #818cf8;
  --live: #34d399;
  --panel: #111a2e;
  --panel-hi: #1b2740;
  --line: rgba(129, 140, 248, 0.22);
  --muted: #8ea0bd;
}
.ws-eyebrow {
  display: block;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 2px 7px;
}

.ws-current {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, var(--panel-hi), var(--panel));
  color: #eaf0fb;
  cursor: pointer;
  text-align: left;
  position: relative;
  overflow: hidden;
  transition: border-color 0.16s, box-shadow 0.16s, transform 0.06s;
}
/* Riel indigo a la izquierda: firma visual del switcher. */
.ws-current::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--ind-1), var(--ind-2));
}
.ws-current:hover { border-color: var(--ind-soft); }
.ws-current.open {
  border-color: var(--ind-soft);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16);
}
.ws-current.live::before { background: linear-gradient(180deg, var(--live), #10b981); }
.ws-current:active { transform: translateY(0.5px); }

.ws-current-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ws-current-name {
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-current-id {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.66rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-chevron { color: var(--muted); flex-shrink: 0; transition: transform 0.18s; }
.ws-current.open .ws-chevron { transform: rotate(180deg); }

/* Punto de estado + pulso "en vivo". */
.ws-status {
  width: 9px; height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #475569;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
}
.ws-status.live {
  background: var(--live);
  box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.55);
  animation: ws-pulse 1.8s ease-out infinite;
}
@keyframes ws-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5); }
  70%  { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

/* Popover de opciones. */
.ws-backdrop { position: fixed; inset: 0; z-index: 40; }
.ws-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0; right: 0;
  margin: 0; padding: 6px;
  list-style: none;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.6);
  animation: ws-drop 0.14s ease-out;
}
@keyframes ws-drop {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ws-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  cursor: pointer;
  color: #dbe4f5;
  transition: background 0.12s;
}
.ws-option:hover, .ws-option:focus-visible { background: var(--panel-hi); outline: none; }
.ws-option:focus-visible { box-shadow: inset 0 0 0 1px var(--ind-soft); }
.ws-option.selected { background: rgba(99, 102, 241, 0.14); }
.ws-option-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ws-option-name { font-size: 0.86rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ws-option-id {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.62rem;
  color: var(--muted);
}
.ws-check { color: var(--ind-soft); font-size: 0.82rem; }
.ws-tag {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--live);
  border: 1px solid rgba(52, 211, 153, 0.4);
  border-radius: 999px;
  padding: 2px 7px;
}
.ws-menu-foot { margin-top: 4px; border-top: 1px solid var(--line); padding-top: 6px; }
.ws-manage {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ind-soft);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.ws-manage:hover { background: rgba(99, 102, 241, 0.12); }

/* ── Panel de gestión ───────────────────────────────────────────── */
.wm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.62);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.wm-panel {
  width: min(600px, 96vw);
  max-height: 84vh;
  overflow: auto;
  background: linear-gradient(180deg, #16213a, #0f1729);
  border: 1px solid rgba(129, 140, 248, 0.2);
  border-radius: 16px;
  padding: 22px 22px 20px;
  color: #e2e8f0;
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.6);
}
.wm-head { display: flex; justify-content: space-between; align-items: flex-start; }
.wm-eyebrow {
  display: block;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #8ea0bd;
}
.wm-title {
  margin: 3px 0 0;
  font-size: 1.32rem;
  font-weight: 650;
  background: linear-gradient(90deg, #c7d2fe, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.wm-close {
  background: none; border: none; color: #8ea0bd;
  font-size: 1.05rem; cursor: pointer; line-height: 1; padding: 4px;
  border-radius: 6px;
}
.wm-close:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); }
.wm-sub { margin: 10px 0 4px; font-size: 0.82rem; color: #9fb0cc; }
.wm-error {
  margin: 10px 0 0;
  font-size: 0.82rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.28);
  border-radius: 8px;
  padding: 8px 10px;
}

.wm-list { list-style: none; margin: 16px 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.wm-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 14px 13px 16px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}
.wm-card:hover { border-color: rgba(129, 140, 248, 0.35); }
.wm-rail {
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: rgba(148, 163, 184, 0.2);
}
.wm-card.active { border-color: rgba(99, 102, 241, 0.5); background: rgba(99, 102, 241, 0.08); }
.wm-card.active .wm-rail { background: linear-gradient(180deg, #6366f1, #8b5cf6); }
.wm-card.live .wm-rail { background: linear-gradient(180deg, #34d399, #10b981); }
.wm-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.wm-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wm-name { font-weight: 600; font-size: 0.95rem; }
.wm-id {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 0.66rem;
  color: #8ea0bd;
}
.wm-badge {
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 8px;
}
.active-badge { color: #c7d2fe; border: 1px solid rgba(129, 140, 248, 0.45); }
.live-badge { color: #34d399; border: 1px solid rgba(52, 211, 153, 0.45); }

.wm-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.wm-btn {
  padding: 6px 11px;
  font-size: 0.78rem;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(255, 255, 255, 0.04);
  color: #dbe4f5;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.wm-btn:hover { background: rgba(255, 255, 255, 0.1); border-color: rgba(129, 140, 248, 0.4); }
.wm-btn.primary {
  border: none;
  background: linear-gradient(90deg, #6366f1, #7c3aed);
  color: #fff;
}
.wm-btn.primary:hover { filter: brightness(1.08); }
.wm-btn.danger { color: #fca5a5; }
.wm-btn.danger:hover { background: rgba(239, 68, 68, 0.14); border-color: rgba(239, 68, 68, 0.5); color: #fecaca; }
.wm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.wm-btn.big { padding: 10px 16px; font-size: 0.85rem; font-weight: 600; white-space: nowrap; }

.wm-create { display: flex; gap: 10px; margin-top: 4px; }
.wm-input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(2, 6, 23, 0.5);
  color: #e2e8f0;
  font-size: 0.86rem;
}
.wm-input::placeholder { color: #64748b; }
.wm-input:focus { outline: none; border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.16); }

@media (prefers-reduced-motion: reduce) {
  .ws-status.live { animation: none; box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.35); }
  .ws-menu { animation: none; }
  .ws-chevron, .ws-current { transition: none; }
}

@media (max-width: 720px) {
  .wm-actions { justify-content: flex-start; }
  .wm-create { flex-direction: column; }
}
</style>
