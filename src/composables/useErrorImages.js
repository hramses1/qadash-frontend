import { ref } from 'vue'
import { apiFetch, apiUrl } from './apiFetch.js';

const images = ref([])      // [{ name, mtime, size }]
const folder = ref('')
const configured = ref(true)
const missing = ref(false)
const loading = ref(false)
const error = ref('')

async function fetchImages() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch('/api/errors/images')
    const data = await res.json()
    if (data.error) { error.value = data.error; images.value = []; return }
    configured.value = data.configured !== false
    missing.value = !!data.missing
    folder.value = data.folder || ''
    images.value = data.images || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function imageUrl(name) {
  return apiUrl(`/api/errors/image?name=${encodeURIComponent(name)}`)
}

export function useErrorImages() {
  return { images, folder, configured, missing, loading, error, fetchImages, imageUrl }
}
