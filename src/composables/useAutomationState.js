import { ref, computed } from 'vue'

// Module-level singleton — persists across route navigation
const checks = ref(null)
const autoConfig = ref({ repoUrl: '', installPath: '' })
const installStatus = ref({
  checked: false, repoCloned: false, venvCreated: false,
  depsInstalled: false, hasRequirements: false, fullyInstalled: false
})
const installLogs = ref([])
const installDone = ref(false)
const updateDone = ref(false)
const autoError = ref('')
const updateError = ref('')
const installing = ref(false)
const pulling = ref(false)
const checking = ref(false)
const savingAuto = ref(false)
const progress = ref({ percent: 0, label: '', step: '' })
const updateProgress = ref({ percent: 0, label: '', step: '' })
const updateBranch = ref('develop')
const branches = ref([])
const branchesLoading = ref(false)

let logIdCounter = 0
let socketInitialized = false
let applyConfigCb = null

const checksOk = computed(() =>
  checks.value && checks.value.python.ok && checks.value.git.ok && checks.value.venv.ok
)
const anyBusy = computed(() => installing.value || pulling.value || checking.value)

function addLog(message, type = 'info') {
  installLogs.value.push({ id: logIdCounter++, message, type })
}

async function checkInstallStatus() {
  if (!autoConfig.value.installPath) {
    installStatus.value = { checked: false, repoCloned: false, venvCreated: false, depsInstalled: false, hasRequirements: false, fullyInstalled: false }
    return
  }
  try {
    const params = new URLSearchParams({ installPath: autoConfig.value.installPath })
    const res = await fetch(`/api/automation/install-status?${params}`)
    installStatus.value = await res.json()
  } catch {}
}

async function fetchBranches() {
  if (!autoConfig.value.installPath) return
  branchesLoading.value = true
  try {
    const params = new URLSearchParams({ installPath: autoConfig.value.installPath })
    const res = await fetch(`/api/automation/branches?${params}`)
    const data = await res.json()
    if (Array.isArray(data.branches)) {
      branches.value = data.branches
      // Si la rama seleccionada no existe en el repo, elegir una sensata
      if (branches.value.length && !branches.value.includes(updateBranch.value)) {
        updateBranch.value =
          branches.value.includes('develop') ? 'develop' :
          branches.value.includes('main')    ? 'main'    :
          branches.value[0]
      }
    }
  } catch {
    branches.value = []
  } finally {
    branchesLoading.value = false
  }
}

async function loadAutoConfig() {
  try {
    const res = await fetch('/api/automation/config')
    autoConfig.value = await res.json()
  } catch {}
}

async function checkPrereqs() {
  checking.value = true
  checks.value = null
  autoError.value = ''
  try {
    const res = await fetch('/api/automation/check')
    checks.value = await res.json()
  } catch (e) {
    autoError.value = e.message
  } finally {
    checking.value = false
  }
}

async function saveAutoConfig() {
  savingAuto.value = true
  try {
    await fetch('/api/automation/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoConfig.value)
    })
  } catch (e) {
    autoError.value = e.message
  } finally {
    savingAuto.value = false
  }
}

async function startInstall() {
  if (!autoConfig.value.repoUrl || !autoConfig.value.installPath) return
  installing.value = true
  installDone.value = false
  autoError.value = ''
  installLogs.value = []
  progress.value = { percent: 0, label: 'Iniciando...', step: 'start' }

  await saveAutoConfig()

  try {
    const res = await fetch('/api/automation/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoConfig.value)
    })
    const data = await res.json()
    if (data.error) {
      installing.value = false
      autoError.value = data.error
    }
  } catch (e) {
    installing.value = false
    autoError.value = e.message
  }
}

async function startUpdate() {
  if (!installStatus.value.repoCloned) return
  pulling.value = true
  updateDone.value = false
  updateError.value = ''
  installLogs.value = []
  updateProgress.value = { percent: 0, label: 'Iniciando actualización...', step: 'start' }

  try {
    const res = await fetch('/api/automation/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installPath: autoConfig.value.installPath, branch: updateBranch.value || 'develop' })
    })
    const data = await res.json()
    if (data.error) {
      pulling.value = false
      updateError.value = data.error
    }
  } catch (e) {
    pulling.value = false
    updateError.value = e.message
  }
}

async function applyConfig(projectPath, pytestCmd) {
  try {
    await fetch('/api/automation/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, pytestCmd })
    })
    if (applyConfigCb) applyConfigCb(projectPath, pytestCmd)
  } catch {}
}

function initSocketListeners(socket, onApplyConfig) {
  applyConfigCb = onApplyConfig
  if (socketInitialized || !socket) return
  socketInitialized = true

  socket.on('automation:log', ({ message, type }) => addLog(message, type))

  socket.on('automation:progress', ({ percent, label, step }) => {
    progress.value = { percent, label, step }
  })

  socket.on('automation:update-progress', ({ percent, label, step }) => {
    updateProgress.value = { percent, label, step }
  })

  socket.on('automation:done', async ({ projectPath, pytestCmd }) => {
    installing.value = false
    installDone.value = true
    progress.value = { percent: 100, label: '¡Instalación completada!', step: 'done' }
    await applyConfig(projectPath, pytestCmd)
    await checkInstallStatus()
  })

  socket.on('automation:update-done', async () => {
    pulling.value = false
    updateDone.value = true
    updateProgress.value = { percent: 100, label: 'Repositorio actualizado', step: 'done' }
    await checkInstallStatus()
  })

  socket.on('automation:failed', ({ error: err }) => {
    installing.value = false
    autoError.value = err
  })

  socket.on('automation:update-failed', ({ error: err }) => {
    pulling.value = false
    updateError.value = err
  })
}

export function useAutomationState() {
  return {
    checks, autoConfig, installStatus, installLogs,
    installDone, updateDone, autoError, updateError,
    installing, pulling, checking, savingAuto,
    progress, updateProgress, updateBranch,
    branches, branchesLoading,
    checksOk, anyBusy,
    loadAutoConfig, checkInstallStatus, checkPrereqs, fetchBranches,
    saveAutoConfig, startInstall, startUpdate, initSocketListeners
  }
}
