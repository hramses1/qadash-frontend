import { ref } from 'vue'
import { apiFetch } from './apiFetch.js';

// Singleton de módulo: persiste al navegar entre rutas.
const schedules = ref([])
const loading = ref(false)
const error = ref('')

async function fetchSchedules() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch('/api/schedules')
    const data = await res.json()
    schedules.value = data.schedules || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function createSchedule(payload) {
  const res = await apiFetch('/api/schedules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  await fetchSchedules()
  return data.schedule
}

async function updateSchedule(id, payload) {
  const res = await apiFetch(`/api/schedules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  await fetchSchedules()
  return data.schedule
}

async function toggleSchedule(id) {
  await apiFetch(`/api/schedules/${id}/toggle`, { method: 'PATCH' })
  await fetchSchedules()
}

async function deleteSchedule(id) {
  await apiFetch(`/api/schedules/${id}`, { method: 'DELETE' })
  await fetchSchedules()
}

async function runNow(id) {
  const res = await apiFetch(`/api/schedules/${id}/run`, { method: 'POST' })
  const data = await res.json()
  if (data.error) throw new Error(data.error === 'busy' ? 'Ya hay una ejecución en curso' : data.error)
  return true
}

export function useSchedules() {
  return {
    schedules, loading, error,
    fetchSchedules, createSchedule, updateSchedule, toggleSchedule, deleteSchedule, runNow
  }
}
