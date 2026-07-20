<template>
  <div class="view-container">
    <h1 class="view-title">Docker — Automatización Selenium</h1>

    <!-- Estado Docker -->
    <div class="card">
      <div class="status-header">
        <h2 class="card-title">Estado</h2>
        <button class="btn-icon" @click="refreshAll" title="Actualizar estado">↺</button>
      </div>

      <div v-if="dockerCheck" class="docker-status" :class="dockerCheck.ok ? 'ds-ok' : 'ds-fail'">
        <span>{{ dockerCheck.ok ? '✅' : '❌' }}</span>
        <span class="ds-text">
          {{ dockerCheck.ok ? `Docker listo — ${dockerCheck.version}` : dockerCheck.error }}
        </span>
      </div>
      <div v-else class="hint">Verificando Docker...</div>

      <div v-if="gridUp" class="docker-status ds-ok grid-status">
        <span>🟢</span>
        <span class="ds-text">
          Selenium activo en Docker —
          <a href="http://localhost:7900" target="_blank" rel="noopener">ver navegador en vivo</a>
        </span>
        <button class="btn btn-danger btn-sm grid-down-btn" :disabled="running" @click="runAction('down')">
          ⏹️ Bajar Docker
        </button>
      </div>

      <div class="project-row">
        <span class="detail-label">Proyecto</span>
        <span class="detail-value">{{ projectPath || '— sin configurar (ve a Configuración) —' }}</span>
      </div>
      <div class="project-row">
        <span class="detail-label">Contenedores</span>
        <span class="detail-value">
          {{ projectUp > 0 ? `${projectUp} activo${projectUp !== 1 ? 's' : ''} en el proyecto` : 'ninguno activo' }}
        </span>
      </div>
      <div v-if="running" class="alert running-banner">
        ⚙️ Ejecutando: <strong>{{ actionLabel(currentAction) }}</strong>
      </div>
    </div>

    <!-- Acciones -->
    <div class="card">
      <h2 class="card-title">Acciones</h2>
      <div class="actions-grid">
        <button class="btn btn-primary" :disabled="!canRun" @click="runAction('up-build')">
          ▶️ Ejecutar tests <small>up --build</small>
        </button>
        <button class="btn btn-secondary" :disabled="!canRun" @click="runAction('up-selenium')">
          🌐 Solo Selenium <small>up -d selenium</small>
        </button>
        <button class="btn btn-secondary" :disabled="!canRun" @click="runAction('rebuild')">
          🔁 Rebuild forzado <small>up --build --force-recreate</small>
        </button>
        <button class="btn btn-secondary" :disabled="!canRun" @click="runAction('down')">
          🧹 Limpiar <small>compose down</small>
        </button>
        <button class="btn btn-danger" :disabled="!canStop" @click="stopOrDown">
          {{ running ? '⏹️ Detener proceso' : '⏹️ Bajar Docker (down)' }}
        </button>
      </div>

      <div class="links-row">
        <a class="link-pill" href="http://localhost:7900" target="_blank" rel="noopener">
          👀 Ver navegador en vivo (pass: secret)
        </a>
        <a class="link-pill" :class="{ disabled: !hasReport }" :href="apiUrl('/api/docker/report')" target="_blank" rel="noopener">
          📄 Ver reporte HTML
        </a>
      </div>

      <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
      <div v-if="lastExit" class="alert" :class="lastExit.code === 0 ? 'alert-success' : 'alert-error'">
        {{ lastExit.code === 0 ? '✅' : '❌' }}
        {{ actionLabel(lastExit.action) }} terminó con código {{ lastExit.code }}
      </div>
    </div>

    <!-- Contenedores levantados -->
    <div class="card">
      <div class="status-header">
        <h2 class="card-title">Contenedores levantados</h2>
        <div class="ct-actions">
          <button class="btn btn-secondary btn-sm" :disabled="inspecting" @click="inspectContainers">
            {{ inspecting ? '⏳ Analizando...' : '🔍 Analizar contenedores' }}
          </button>
          <button
            class="btn btn-danger btn-sm"
            :disabled="!canRun || projectUp === 0"
            @click="runAction('down-all')"
            :title="projectUp === 0 ? 'No hay contenedores del proyecto activos' : 'compose down --remove-orphans'"
          >
            🧹 Bajar todos del proyecto{{ projectUp > 0 ? ` (${projectUp})` : '' }}
          </button>
        </div>
      </div>

      <div v-if="containersError" class="alert alert-error">❌ {{ containersError }}</div>

      <table v-if="containers.length" class="containers-table">
        <thead>
          <tr><th>Nombre</th><th>Imagen</th><th>Estado</th><th>Puertos</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in containers" :key="c.name">
            <td class="ct-name">{{ c.name }}</td>
            <td>{{ c.image }}</td>
            <td><span class="ct-status">{{ c.status }}</span></td>
            <td class="ct-ports">{{ c.ports || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else-if="containersChecked && !containersError" class="hint">
        No hay contenedores en ejecución.
      </div>
      <div v-else-if="!containersChecked" class="hint">
        Pulsa "Analizar contenedores" para ver lo que está corriendo en Docker.
      </div>
    </div>

    <!-- Log -->
    <div class="card">
      <div class="status-header">
        <h2 class="card-title">Salida</h2>
        <button class="btn-icon" @click="clearLogs" title="Limpiar log">🗑️</button>
      </div>
      <div class="docker-log" ref="logContainer">
        <div v-for="log in logs" :key="log.id" :class="['log-line', 'log-' + log.type]">{{ log.message }}</div>
        <div v-if="logs.length === 0" class="log-line log-info">Sin salida todavía. Lanza una acción.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch, nextTick, ref } from 'vue'
import { useDockerState } from '../composables/useDockerState'
import { apiUrl } from '../composables/apiFetch.js'

defineOptions({ name: 'Docker' })

const {
  dockerCheck, logs, running, currentAction, lastExit,
  hasReport, gridUp, projectUp, projectPath, error,
  containers, inspecting, containersError, containersChecked,
  checkDocker, refreshStatus, runAction, stopAction, inspectContainers,
  clearLogs, initSocketListeners
} = useDockerState()

const logContainer = ref(null)

const canRun = computed(() => !running.value && dockerCheck.value?.ok)
// Detener: hay un proceso adjunto (running) o el grid quedó levantado (gridUp).
const canStop = computed(() => running.value || gridUp.value)

function stopOrDown() {
  if (running.value) stopAction()
  else runAction('down')   // baja el grid detached (compose down)
}

const LABELS = {
  'up-build': 'Ejecutar tests (up --build)',
  'up-selenium': 'Solo Selenium',
  'rebuild': 'Rebuild forzado',
  'down': 'Limpiar (down)',
  'down-all': 'Bajar proyecto (down --remove-orphans)'
}
function actionLabel(a) { return LABELS[a] || a }

async function refreshAll() {
  await Promise.all([checkDocker(), refreshStatus()])
}

watch(logs, () => {
  nextTick(() => {
    if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
  })
}, { deep: true })

let pollTimer = null

onMounted(() => {
  initSocketListeners()
  refreshAll()
  // Refresca estado del grid periódicamente (se levanta/baja en segundo plano).
  pollTimer = setInterval(refreshStatus, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.status-header { display: flex; align-items: center; justify-content: space-between; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1.05rem; opacity: .6; padding: 0 .25rem; color: inherit; }
.btn-icon:hover { opacity: 1; }

.docker-status { display: flex; align-items: center; gap: .6rem; padding: .65rem .9rem; border-radius: 6px; font-size: .9rem; margin-bottom: .75rem; }
.ds-ok   { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.3); }
.ds-fail { background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.3); }
.ds-text { font-weight: 500; }
.grid-status { gap: .6rem; }
.grid-status .ds-text { flex: 1; }
.grid-status a { color: #16a34a; font-weight: 600; }
.grid-down-btn { margin-left: auto; }
.btn-sm { padding: .25rem .6rem; font-size: .78rem; }

.project-row { display: flex; gap: .75rem; font-size: .86rem; padding-top: .25rem; }
.detail-label { font-weight: 600; min-width: 70px; opacity: .7; }
.detail-value { word-break: break-all; opacity: .85; }
.running-banner { margin-top: .75rem; background: rgba(99,102,241,.1); border: 1px solid rgba(99,102,241,.35); }

.actions-grid { display: flex; flex-wrap: wrap; gap: .6rem; margin-bottom: 1rem; }
.actions-grid .btn { display: flex; flex-direction: column; align-items: flex-start; gap: .15rem; }
.actions-grid .btn small { font-family: monospace; font-size: .7rem; opacity: .7; }
.btn-danger { background: #ef4444; color: #fff; border: 1px solid #ef4444; }
.btn-danger:disabled { opacity: .4; cursor: not-allowed; }

.links-row { display: flex; gap: .6rem; flex-wrap: wrap; margin-bottom: .75rem; }
.link-pill {
  padding: .4rem .85rem; border-radius: 99px; font-size: .82rem; font-weight: 500;
  border: 1px solid var(--border, #e2e8f0); text-decoration: none; color: inherit;
  transition: all .15s;
}
.link-pill:hover { border-color: #6366f1; color: #6366f1; }
.link-pill.disabled { opacity: .4; pointer-events: none; }

.ct-actions { display: flex; gap: .5rem; flex-wrap: wrap; }

.containers-table {
  width: 100%; border-collapse: collapse; font-size: .82rem; margin-top: .5rem;
}
.containers-table th, .containers-table td {
  text-align: left; padding: .45rem .6rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
  white-space: nowrap;
}
.containers-table th { font-weight: 600; opacity: .7; font-size: .76rem; text-transform: uppercase; letter-spacing: .03em; }
.ct-name { font-weight: 600; }
.ct-status { color: #16a34a; }
.ct-ports { font-family: monospace; font-size: .76rem; opacity: .85; white-space: normal; word-break: break-word; }

.docker-log {
  background: #111827; color: #d1d5db;
  border: 1px solid #374151; border-radius: 8px;
  padding: .75rem 1rem;
  max-height: 420px; min-height: 120px; overflow-y: auto;
  font-family: 'Courier New', monospace; font-size: .8rem;
}
.log-line    { padding: 1px 0; line-height: 1.55; color: #d1d5db; white-space: pre-wrap; word-break: break-word; }
.log-info    { color: #9ca3af; }
.log-cmd     { color: #60a5fa; font-weight: 600; }
.log-success { color: #34d399; font-weight: 600; }
.log-error   { color: #f87171; font-weight: 600; }
</style>
