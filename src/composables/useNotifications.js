import { ref } from 'vue'

// Notificaciones de terminación de tests.
// - Toast in-app: SIEMPRE se muestra (no requiere permisos ni contexto seguro).
// - Notificación de escritorio (Web Notifications API): además, si el usuario
//   la activó y el navegador concedió permiso. Funciona con la pestaña en 2º plano.

const supported = typeof window !== 'undefined' && 'Notification' in window
const permission = ref(supported ? Notification.permission : 'denied')

// Preferencia del usuario para notif de escritorio (persistida).
const LS_KEY = 'tdb:notifications'
function loadEnabled() {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v !== null) return v === '1'
  } catch {}
  return supported && permission.value === 'granted'
}
const enabled = ref(loadEnabled())

function persist() {
  try { localStorage.setItem(LS_KEY, enabled.value ? '1' : '0') } catch {}
}

// ── Toasts in-app ──
const toasts = ref([])
let toastId = 0
function pushToast(title, body, type = 'info', ttl = 6000) {
  const id = ++toastId
  toasts.value.push({ id, title, body, type })
  setTimeout(() => dismissToast(id), ttl)
  return id
}
function dismissToast(id) {
  const i = toasts.value.findIndex(t => t.id === id)
  if (i !== -1) toasts.value.splice(i, 1)
}

async function requestPermission() {
  if (!supported) return 'denied'
  if (permission.value === 'granted') return 'granted'
  try {
    const result = await Notification.requestPermission()
    permission.value = result
    return result
  } catch {
    return permission.value
  }
}

// Alterna la preferencia de escritorio; al activar pide permiso si hace falta.
async function toggle() {
  if (!enabled.value) {
    const p = await requestPermission()
    enabled.value = p === 'granted'
    if (enabled.value) {
      pushToast('🔔 Notificaciones activadas', 'Te avisaremos cuando terminen los tests.', 'passed')
      try { new Notification('🔔 Notificaciones activadas', { body: 'QA Dashboard', icon: '/favicon.svg' }) } catch {}
    } else {
      pushToast('🔕 Permiso denegado', 'El navegador bloqueó las notificaciones de escritorio. Los avisos in-app seguirán funcionando.', 'failed')
    }
  } else {
    enabled.value = false
    pushToast('🔕 Notificaciones de escritorio desactivadas', 'Seguirás viendo avisos in-app.', 'info')
  }
  persist()
  return enabled.value
}

// Muestra un aviso: toast in-app siempre; escritorio si está activado y con permiso.
// type: 'passed' | 'failed' | 'error' | 'info' → estiliza el toast.
function notify(title, { body = '', type = 'info', tag, requireInteraction, silent } = {}) {
  pushToast(title, body, type)
  if (supported && enabled.value && permission.value === 'granted') {
    try {
      const n = new Notification(title, { body, icon: '/favicon.svg', tag, requireInteraction, silent })
      n.onclick = () => { window.focus(); n.close() }
    } catch {}
  }
}

export function useNotifications() {
  return { supported, permission, enabled, toasts, requestPermission, toggle, notify, dismissToast }
}
