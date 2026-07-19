import { ref, computed } from 'vue'
import { apiFetch } from './apiFetch.js';
import { useSocket } from './useSocket'

// Singleton a nivel de módulo — persiste al navegar entre rutas.
const dockerCheck = ref(null)          // { ok, version, error }
const logs = ref([])
const running = ref(false)
const currentAction = ref(null)
const lastExit = ref(null)             // { action, code }
const hasReport = ref(false)
const gridUp = ref(false)              // contenedor selenium levantado
const projectUp = ref(0)               // nº de contenedores del proyecto activos
const projectPath = ref('')
const error = ref('')

const containers = ref([])             // contenedores en ejecución (docker ps)
const inspecting = ref(false)
const containersError = ref('')
const containersChecked = ref(false)

let logId = 0
let socketInitialized = false

const busy = computed(() => running.value)

function addLog(message, type = 'info') {
  logs.value.push({ id: logId++, message, type })
  // Cota dura: no dejar crecer el log sin límite en runs largos.
  if (logs.value.length > 2000) logs.value.splice(0, logs.value.length - 2000)
}

function clearLogs() {
  logs.value = []
  lastExit.value = null
}

async function checkDocker() {
  try {
    const res = await apiFetch('/api/docker/check')
    dockerCheck.value = await res.json()
  } catch (e) {
    dockerCheck.value = { ok: false, error: e.message }
  }
}

async function refreshStatus() {
  try {
    const res = await apiFetch('/api/docker/status')
    const data = await res.json()
    running.value = data.running
    currentAction.value = data.action
    hasReport.value = data.hasReport
    gridUp.value = !!data.gridUp
    projectUp.value = data.projectUp || 0
    projectPath.value = data.projectPath
  } catch {}
}

async function runAction(action) {
  if (running.value) return
  error.value = ''
  lastExit.value = null
  // No limpiar logs en 'down' para conservar el contexto del run anterior.
  if (action !== 'down') clearLogs()
  running.value = true
  currentAction.value = action
  try {
    const res = await apiFetch('/api/docker/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
    const data = await res.json()
    if (data.error) { error.value = data.error; running.value = false }
  } catch (e) {
    error.value = e.message
    running.value = false
  }
}

async function inspectContainers() {
  inspecting.value = true
  containersError.value = ''
  try {
    const res = await apiFetch('/api/docker/containers')
    const data = await res.json()
    if (data.ok) containers.value = data.containers
    else { containers.value = []; containersError.value = data.error || 'No se pudo listar contenedores' }
  } catch (e) {
    containersError.value = e.message
  } finally {
    inspecting.value = false
    containersChecked.value = true
  }
}

async function stopAction() {
  try {
    await apiFetch('/api/docker/stop', { method: 'POST' })
  } catch (e) {
    error.value = e.message
  }
}

function initSocketListeners() {
  if (socketInitialized) return
  const { socket } = useSocket()
  if (!socket) return
  socketInitialized = true

  socket.on('docker:started', ({ action }) => {
    running.value = true
    currentAction.value = action
  })
  socket.on('docker:log', ({ message, type }) => addLog(message, type))
  socket.on('docker:exit', async ({ action, code }) => {
    running.value = false
    currentAction.value = null
    lastExit.value = { action, code }
    addLog(
      code === 0 ? `✔ Finalizado (${action}) — código 0` : `✖ Finalizado (${action}) — código ${code}`,
      code === 0 ? 'success' : 'error'
    )
    await refreshStatus()
    if (containersChecked.value) inspectContainers()
  })
}

export function useDockerState() {
  return {
    dockerCheck, logs, running, currentAction, lastExit,
    hasReport, gridUp, projectUp, projectPath, error, busy,
    containers, inspecting, containersError, containersChecked,
    checkDocker, refreshStatus, runAction, stopAction, inspectContainers,
    clearLogs, initSocketListeners
  }
}
