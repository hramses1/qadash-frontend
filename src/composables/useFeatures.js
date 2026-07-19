import { ref } from 'vue'
import { FEATURE_MAP } from './featureMap'

const ALWAYS_ON = ['tests', 'config']

function defaults() {
  return FEATURE_MAP.reduce((acc, f) => { acc[f.key] = true; return acc }, {})
}

// Estado singleton (compartido entre App, guard y Settings).
const flags = ref(defaults())

async function loadFeatures() {
  try {
    const res = await fetch('/api/features')
    const data = await res.json()
    flags.value = { ...defaults(), ...data }
  } catch {
    flags.value = defaults()
  }
}

async function saveFeatures(newFlags) {
  const res = await fetch('/api/features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newFlags)
  })
  const data = await res.json()
  flags.value = { ...defaults(), ...data }
  return flags.value
}

function isEnabled(key) {
  if (ALWAYS_ON.includes(key)) return true
  return flags.value[key] !== false
}

export function useFeatures() {
  return { flags, loadFeatures, saveFeatures, isEnabled }
}
