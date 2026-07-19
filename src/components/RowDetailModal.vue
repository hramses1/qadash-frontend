<template>
  <Teleport to="body">
    <div v-if="row" class="rdm-overlay" @click.self="$emit('close')">
      <div class="rdm-card" role="dialog" aria-modal="true">
        <header class="rdm-head">
          <h2 class="rdm-title">Registro #{{ index + 1 }} <span class="rdm-total">de {{ total }}</span></h2>
          <button class="rdm-x" @click="$emit('close')" title="Cerrar (Esc)">✕</button>
        </header>

        <div class="rdm-body">
          <dl class="rdm-list">
            <template v-for="c in columns" :key="c">
              <dt class="rdm-key">{{ prettyCol(c) }}</dt>
              <dd class="rdm-val" :class="{ empty: !hasValue(row[c]) }">
                {{ hasValue(row[c]) ? row[c] : '—' }}
              </dd>
            </template>
          </dl>
        </div>

        <footer class="rdm-foot">
          <button class="rdm-nav" :disabled="index <= 0" @click="$emit('prev')" title="Anterior (←)">
            ‹ Anterior
          </button>
          <button class="rdm-copy" @click="copy">
            {{ copied ? '✓ Copiado' : 'Copiar' }}
          </button>
          <button class="rdm-nav" :disabled="index >= total - 1" @click="$emit('next')" title="Siguiente (→)">
            Siguiente ›
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  row: { type: Object, default: null },
  columns: { type: Array, default: () => [] },
  prettyCol: { type: Function, default: (c) => c },
  index: { type: Number, default: -1 },
  total: { type: Number, default: 0 }
})
const emit = defineEmits(['close', 'prev', 'next'])

const copied = ref(false)
let copyTimer = null

function hasValue(v) {
  return String(v ?? '').trim() !== ''
}

async function copy() {
  const text = props.columns
    .map((c) => `${props.prettyCol(c)}: ${props.row?.[c] ?? ''}`)
    .join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch {
    /* clipboard no disponible; ignorar */
  }
}

function onKey(e) {
  if (!props.row) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft' && props.index > 0) emit('prev')
  else if (e.key === 'ArrowRight' && props.index < props.total - 1) emit('next')
}

// Resetea el feedback de copiado al cambiar de registro.
watch(() => props.index, () => { copied.value = false })

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(copyTimer)
})
</script>

<style scoped>
.rdm-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(15, 23, 42, .55);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}
.rdm-card {
  background: var(--bg, #fff); color: inherit;
  width: 100%; max-width: 560px; max-height: 82vh;
  display: flex; flex-direction: column;
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 20px 50px rgba(15, 23, 42, .35);
}
.rdm-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--border, #e2e8f0);
}
.rdm-title { font-size: 1rem; font-weight: 700; margin: 0; }
.rdm-total { font-weight: 400; opacity: .55; font-size: .85rem; }
.rdm-x {
  border: none; background: none; cursor: pointer;
  font-size: 1rem; opacity: .55; line-height: 1; padding: .25rem;
}
.rdm-x:hover { opacity: 1; }

.rdm-body { overflow: auto; padding: .5rem 1.25rem 1rem; }
.rdm-list {
  display: grid; grid-template-columns: minmax(120px, 34%) 1fr;
  gap: 0; margin: 0;
}
.rdm-key, .rdm-val {
  padding: .55rem .25rem; border-bottom: 1px solid #f1f5f9;
}
.rdm-key {
  font-size: .72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .04em; opacity: .6;
  align-self: start;
}
.rdm-val {
  font-size: .88rem; color: #334155;
  white-space: pre-wrap; word-break: break-word;
}
.rdm-val.empty { opacity: .4; }
.rdm-list > .rdm-val:last-child,
.rdm-list > .rdm-key:nth-last-child(2) { border-bottom: none; }

.rdm-foot {
  display: flex; align-items: center; justify-content: space-between; gap: .5rem;
  padding: .85rem 1.25rem; border-top: 1px solid var(--border, #e2e8f0);
}
.rdm-nav, .rdm-copy {
  height: 36px; padding: 0 .9rem; border-radius: 8px;
  border: 1px solid var(--border, #e2e8f0); background: var(--bg, #fff);
  color: inherit; cursor: pointer; font-size: .82rem; font-weight: 500;
  transition: border-color .15s, color .15s, opacity .15s;
}
.rdm-nav:hover:not(:disabled), .rdm-copy:hover { border-color: #6366f1; color: #6366f1; }
.rdm-nav:disabled { opacity: .4; cursor: default; }
.rdm-copy { min-width: 92px; }
</style>
