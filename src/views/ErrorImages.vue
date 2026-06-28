<template>
  <div class="view-container">
    <div class="page-head">
      <h1 class="view-title">Imágenes de errores</h1>
      <button class="btn btn-secondary" @click="fetchImages" :disabled="loading">
        {{ loading ? 'Cargando...' : '↺ Refrescar' }}
      </button>
    </div>

    <!-- Sin configurar -->
    <div v-if="!loading && !configured" class="card empty-card">
      <p class="hint-text">
        No hay proyecto configurado. Ve a <RouterLink to="/settings">Configuración</RouterLink>.
      </p>
    </div>

    <div v-else-if="error" class="alert alert-error">❌ {{ error }}</div>

    <div v-else-if="!loading && missing" class="card empty-card">
      <p class="hint-text">
        La carpeta de imágenes no existe todavía:<br />
        <code>{{ folder }}</code><br />
        Se llena cuando un test falla y captura pantalla.
      </p>
    </div>

    <template v-else>
      <div class="meta-bar">
        <span class="meta-item">📁 <code>{{ folder }}</code></span>
        <span class="meta-item">{{ filtered.length }} de {{ images.length }} imagen{{ images.length !== 1 ? 'es' : '' }}</span>
      </div>

      <div v-if="images.length" class="card filter-card">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input v-model="search" class="filter-input" placeholder="Buscar por nombre..." />
          <button v-if="search" class="clear-x" @click="search = ''" title="Limpiar">✕</button>
        </div>
      </div>

      <div v-if="!loading && images.length === 0" class="card empty-card">
        <p class="hint-text">Aún no hay imágenes de error. 🎉</p>
      </div>

      <div v-else-if="filtered.length === 0" class="card empty-card">
        <p class="hint-text">Ninguna imagen coincide con la búsqueda.</p>
      </div>

      <div v-else class="img-grid">
        <button
          v-for="(img, i) in filtered"
          :key="img.name"
          class="img-card"
          @click="openLightbox(i)"
        >
          <div class="img-thumb">
            <img :src="imageUrl(img.name)" :alt="img.name" loading="lazy" />
          </div>
          <div class="img-info">
            <span class="img-name" :title="img.name">{{ prettyName(img.name) }}</span>
            <span class="img-date">{{ fmtDate(img) }}</span>
          </div>
        </button>
      </div>
    </template>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="lightbox >= 0" class="lb-backdrop" @click.self="lightbox = -1" tabindex="0" ref="lbRef" @keydown="onKey">
        <button class="lb-close" @click="lightbox = -1" title="Cerrar (Esc)">✕</button>
        <button class="lb-nav lb-prev" @click.stop="prev" title="Anterior (←)">‹</button>
        <div class="lb-stage" @click.self="lightbox = -1">
          <img :src="imageUrl(current.name)" :alt="current.name" class="lb-img" />
          <div class="lb-caption">
            <span class="lb-name">{{ current.name }}</span>
            <span class="lb-meta">{{ fmtDate(current) }} · {{ lightbox + 1 }}/{{ filtered.length }}</span>
            <a class="lb-open" :href="imageUrl(current.name)" target="_blank" rel="noopener">Abrir original ↗</a>
          </div>
        </div>
        <button class="lb-nav lb-next" @click.stop="next" title="Siguiente (→)">›</button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useErrorImages } from '../composables/useErrorImages'

defineOptions({ name: 'ErrorImages' })

const { images, folder, configured, missing, loading, error, fetchImages, imageUrl } = useErrorImages()

const search = ref('')
const lightbox = ref(-1)
const lbRef = ref(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return images.value
  return images.value.filter(img => img.name.toLowerCase().includes(q))
})

const current = computed(() => filtered.value[lightbox.value] || {})

// Quita el timestamp del final y subraya → espacios para el título.
function prettyName(name) {
  return name
    .replace(/\.(png|jpe?g|gif|webp|bmp)$/i, '')
    .replace(/_?\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/, '')
    .replace(/_+/g, ' ')
    .trim() || name
}

function fmtDate(img) {
  const m = img.name && img.name.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/)
  let d
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])
  else if (img.mtime) d = new Date(img.mtime)
  if (!d) return ''
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function openLightbox(i) {
  lightbox.value = i
  nextTick(() => lbRef.value && lbRef.value.focus())
}
function prev() { if (lightbox.value > 0) lightbox.value-- }
function next() { if (lightbox.value < filtered.value.length - 1) lightbox.value++ }
function onKey(e) {
  if (e.key === 'Escape') lightbox.value = -1
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

onMounted(fetchImages)
</script>

<style scoped>
.page-head {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;
}
.meta-bar { display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: .85rem; opacity: .8; margin-bottom: .75rem; }
.meta-item code { word-break: break-all; }

.filter-card { padding: .75rem 1rem; margin-bottom: 1rem; }
.search-box { position: relative; display: flex; align-items: center; }
.search-icon { position: absolute; left: .6rem; font-size: .8rem; opacity: .5; }
.filter-input {
  height: 38px; padding: 0 2rem; font-size: .85rem; width: 100%;
  border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; color: inherit;
}
.filter-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.15); }
.clear-x { position: absolute; right: .5rem; border: none; background: none; cursor: pointer; opacity: .5; }
.clear-x:hover { opacity: 1; }

.empty-card { padding: 1.5rem; }

/* Grid */
.img-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px;
}
.img-card {
  display: flex; flex-direction: column; text-align: left;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
  cursor: pointer; padding: 0; transition: border-color .15s, box-shadow .15s, transform .1s;
}
.img-card:hover { border-color: #6366f1; box-shadow: 0 6px 18px rgba(99,102,241,.15); transform: translateY(-2px); }
.img-thumb {
  height: 150px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.img-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
.img-name { font-size: .82rem; font-weight: 600; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.img-date { font-size: .72rem; color: #94a3b8; }

/* Lightbox */
.lb-backdrop {
  position: fixed; inset: 0; z-index: 1100; background: rgba(15,23,42,.92);
  display: flex; align-items: center; justify-content: center; outline: none;
}
.lb-stage { max-width: 92vw; max-height: 92vh; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.lb-img { max-width: 92vw; max-height: 80vh; object-fit: contain; border-radius: 6px; box-shadow: 0 12px 48px rgba(0,0,0,.6); }
.lb-caption { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #e2e8f0; text-align: center; }
.lb-name { font-size: .85rem; font-family: monospace; word-break: break-all; max-width: 80vw; }
.lb-meta { font-size: .78rem; color: #94a3b8; }
.lb-open { font-size: .78rem; color: #93c5fd; }
.lb-close {
  position: absolute; top: 18px; right: 22px; font-size: 24px; color: #fff;
  background: none; border: none; cursor: pointer; line-height: 1;
}
.lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  font-size: 44px; color: #fff; background: rgba(255,255,255,.08); border: none; cursor: pointer;
  width: 56px; height: 80px; border-radius: 8px;
}
.lb-nav:hover { background: rgba(255,255,255,.18); }
.lb-prev { left: 18px; } .lb-next { right: 18px; }
</style>
