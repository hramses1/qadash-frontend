<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  container: { type: [Object, Array], required: true },
  propKey: { required: true },
  isArrayItem: { type: Boolean, default: false },
  isRoot: { type: Boolean, default: false },
  depth: { type: Number, default: 0 }
})

const open = ref(true)

const value = computed(() => props.container[props.propKey])

function valueType(v) {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v // 'object' | 'string' | 'number' | 'boolean'
}

const vtype = computed(() => valueType(value.value))
const isBranch = computed(() => vtype.value === 'object' || vtype.value === 'array')

const childKeys = computed(() => {
  const v = value.value
  if (vtype.value === 'array') return v.map((_, i) => i)
  if (vtype.value === 'object') return Object.keys(v)
  return []
})

const proxy = computed({
  get: () => props.container[props.propKey],
  set: (val) => { props.container[props.propKey] = val }
})

function changeType(t) {
  const cur = value.value
  let nv
  switch (t) {
    case 'string':  nv = (cur == null || typeof cur === 'object') ? '' : String(cur); break
    case 'number':  nv = Number(cur) || 0; break
    case 'boolean': nv = Boolean(cur); break
    case 'null':    nv = null; break
    case 'object':  nv = {}; break
    case 'array':   nv = []; break
  }
  props.container[props.propKey] = nv
  open.value = true
}

function renameKey() {
  const input = window.prompt('Nuevo nombre del campo:', props.propKey)
  if (input == null) return
  const nk = input.trim()
  if (!nk || nk === props.propKey) return
  const obj = props.container
  if (nk in obj) { window.alert('Ya existe un campo con ese nombre.'); return }
  const entries = Object.entries(obj)
  Object.keys(obj).forEach(k => delete obj[k])
  entries.forEach(([k, v]) => { obj[k === props.propKey ? nk : k] = v })
}

function removeSelf() {
  if (Array.isArray(props.container)) props.container.splice(props.propKey, 1)
  else delete props.container[props.propKey]
}

function addChild() {
  const v = value.value
  if (vtype.value === 'array') {
    v.push('')
  } else {
    const input = window.prompt('Nombre del nuevo campo:')
    if (input == null) return
    const nk = input.trim()
    if (!nk) return
    if (nk in v) { window.alert('Ya existe un campo con ese nombre.'); return }
    v[nk] = ''
  }
}
</script>

<template>
  <!-- Hoja: valor primitivo -->
  <div v-if="!isRoot && !isBranch" class="jn-leaf" :class="'t-' + vtype">
    <span class="jn-key" :class="{ 'jn-idx': isArrayItem }">{{ isArrayItem ? '#' + propKey : propKey }}</span>

    <div class="jn-val">
      <input v-if="vtype === 'string'" v-model="proxy" class="jn-input" placeholder="(vacío)" />
      <input v-else-if="vtype === 'number'" type="number" v-model.number="proxy" class="jn-input jn-num" />
      <label v-else-if="vtype === 'boolean'" class="jn-switch" :class="{ on: proxy }">
        <input type="checkbox" v-model="proxy" />
        <span class="jn-switch-track"><span class="jn-switch-thumb"></span></span>
        <span class="jn-switch-txt">{{ proxy ? 'Sí' : 'No' }}</span>
      </label>
      <span v-else class="jn-null">null</span>
    </div>

    <div class="jn-tools">
      <select class="jn-type" :value="vtype" @change="changeType($event.target.value)" title="Tipo de dato">
        <option value="string">Texto</option>
        <option value="number">Número</option>
        <option value="boolean">Sí/No</option>
        <option value="null">Vacío</option>
        <option value="object">Grupo</option>
        <option value="array">Lista</option>
      </select>
      <button v-if="!isArrayItem" class="jn-ic" @click="renameKey" title="Renombrar campo">✎</button>
      <button class="jn-ic jn-del" @click="removeSelf" title="Eliminar">✕</button>
    </div>
  </div>

  <!-- Rama: objeto / arreglo -->
  <div v-else class="jn-block" :class="['t-' + vtype, { 'jn-block-root': isRoot }]">
    <div v-if="!isRoot" class="jn-head" @click="open = !open">
      <button class="jn-caret" :class="{ open }" @click.stop="open = !open">▸</button>
      <span class="jn-icon">{{ vtype === 'array' ? '≣' : '❏' }}</span>
      <span class="jn-key" :class="{ 'jn-idx': isArrayItem }">{{ isArrayItem ? '#' + propKey : propKey }}</span>
      <span class="jn-badge">{{ vtype === 'array' ? 'lista' : 'grupo' }} · {{ childKeys.length }}</span>
      <span class="jn-spacer"></span>
      <div class="jn-tools" @click.stop>
        <select class="jn-type" :value="vtype" @change="changeType($event.target.value)" title="Tipo de dato">
          <option value="string">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Sí/No</option>
          <option value="null">Vacío</option>
          <option value="object">Grupo</option>
          <option value="array">Lista</option>
        </select>
        <button v-if="!isArrayItem" class="jn-ic" @click="renameKey" title="Renombrar">✎</button>
        <button class="jn-ic jn-del" @click="removeSelf" title="Eliminar">✕</button>
      </div>
    </div>

    <div v-show="open || isRoot" class="jn-body" :class="{ 'jn-body-root': isRoot }">
      <div v-if="childKeys.length === 0" class="jn-empty">Sin elementos todavía</div>
      <JsonNode
        v-for="k in childKeys"
        :key="k"
        :container="value"
        :prop-key="k"
        :is-array-item="vtype === 'array'"
        :depth="depth + 1"
      />
      <button class="jn-add" @click="addChild">＋ {{ vtype === 'array' ? 'Agregar ítem' : 'Agregar campo' }}</button>
    </div>
  </div>
</template>

<style scoped>
/* ── Acentos por tipo ── */
.t-object { --accent: #6366f1; --accent-soft: rgba(99, 102, 241, .09); }
.t-array  { --accent: #0ea5e9; --accent-soft: rgba(14, 165, 233, .10); }

/* ── Hoja (valor primitivo) ── */
.jn-leaf {
  display: flex; align-items: center; gap: .6rem;
  padding: .35rem .5rem; border-radius: 9px;
  transition: background .12s;
}
.jn-leaf:hover { background: rgba(99, 102, 241, .06); }

.jn-key {
  font-weight: 600; font-size: .82rem; color: #334155;
  flex-shrink: 0; min-width: 90px;
}
.jn-idx {
  color: #0284c7; font-family: ui-monospace, monospace;
  min-width: 34px; opacity: .8;
}

.jn-val { flex: 1; min-width: 0; display: flex; align-items: center; }
.jn-input {
  height: 32px; padding: 0 .6rem; font-size: .84rem; width: 100%;
  border: 1px solid #e2e8f0; border-radius: 7px;
  background: #fff; color: #0f172a; transition: border-color .12s, box-shadow .12s;
}
.jn-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, .15); }
.jn-num { max-width: 150px; font-variant-numeric: tabular-nums; }
.jn-null { font-style: italic; color: #94a3b8; font-size: .82rem; }

/* Interruptor Sí/No */
.jn-switch { display: inline-flex; align-items: center; gap: .5rem; cursor: pointer; user-select: none; }
.jn-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.jn-switch-track {
  width: 40px; height: 22px; border-radius: 99px; background: #cbd5e1;
  position: relative; transition: background .18s;
}
.jn-switch-thumb {
  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25);
  transition: transform .18s;
}
.jn-switch.on .jn-switch-track { background: #22c55e; }
.jn-switch.on .jn-switch-thumb { transform: translateX(18px); }
.jn-switch-txt { font-size: .8rem; font-weight: 600; color: #475569; }

/* Herramientas (tipo, renombrar, borrar) */
.jn-tools { display: flex; align-items: center; gap: .2rem; flex-shrink: 0; opacity: .35; transition: opacity .12s; }
.jn-leaf:hover .jn-tools, .jn-head:hover .jn-tools { opacity: 1; }
.jn-type {
  height: 28px; font-size: .74rem; padding: 0 .3rem; color: #475569;
  border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; cursor: pointer;
}
.jn-ic {
  background: none; border: none; cursor: pointer; font-size: .82rem;
  width: 24px; height: 24px; border-radius: 6px; color: #64748b; line-height: 1;
}
.jn-ic:hover { background: #eef2ff; color: #4338ca; }
.jn-del:hover { background: #fee2e2; color: #dc2626; }

/* ── Rama (objeto / arreglo) ── */
.jn-block {
  border: 1px solid #e6e8f0; border-radius: 11px;
  margin: .4rem 0; background: #fff; overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
.jn-block-root { border: none; border-radius: 0; margin: 0; box-shadow: none; background: transparent; }

.jn-head {
  display: flex; align-items: center; gap: .5rem;
  padding: .45rem .6rem; cursor: pointer;
  background: var(--accent-soft); border-left: 3px solid var(--accent);
}
.jn-head:hover { filter: brightness(.98); }
.jn-caret {
  background: none; border: none; cursor: pointer; color: var(--accent);
  font-size: .8rem; width: 16px; padding: 0; transition: transform .15s;
}
.jn-caret.open { transform: rotate(90deg); }
.jn-icon { font-size: .9rem; color: var(--accent); }
.jn-badge {
  font-size: .7rem; font-weight: 700; color: var(--accent);
  background: #fff; border: 1px solid var(--accent-soft);
  padding: .08rem .45rem; border-radius: 99px; text-transform: uppercase; letter-spacing: .03em;
}
.jn-spacer { flex: 1; }

.jn-body {
  padding: .3rem .6rem .55rem; margin-left: .9rem;
  border-left: 2px dashed #e9ecf5;
}
.jn-body-root { margin-left: 0; padding: 0; border-left: none; }
.jn-empty { font-size: .8rem; color: #94a3b8; font-style: italic; padding: .35rem .5rem; }

.jn-add {
  margin: .35rem 0 .15rem; padding: .28rem .7rem;
  font-size: .76rem; font-weight: 600; color: var(--accent, #6366f1);
  border: 1px dashed currentColor; border-radius: 7px;
  background: none; cursor: pointer; opacity: .7; transition: opacity .12s, background .12s;
}
.jn-add:hover { opacity: 1; background: var(--accent-soft, rgba(99, 102, 241, .06)); }
</style>
