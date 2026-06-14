<template>
  <div class="ce-root" @keydown.ctrl.s.prevent="$emit('save')" @keydown.meta.s.prevent="$emit('save')">

    <!-- Topbar -->
    <div class="ce-topbar">
      <span class="ce-lang-badge">🐍 Python</span>
      <span class="ce-file-label" :title="filePath">{{ shortPath }}</span>
      <div class="ce-topbar-right">
        <span v-if="dirty" class="ce-dirty-dot" title="Cambios sin guardar">●</span>
        <span class="ce-encoding">UTF-8</span>
      </div>
    </div>

    <!-- Editor body: gutter + textarea -->
    <div class="ce-body" ref="bodyEl">

      <div class="ce-gutter" ref="gutterEl" aria-hidden="true">
        <div
          v-for="n in lineCount"
          :key="n"
          class="ce-ln"
          :class="{ 'ce-ln-active': n === cursorLine }"
        >{{ n }}</div>
      </div>

      <textarea
        ref="taEl"
        class="ce-ta"
        :value="modelValue"
        @input="onInput"
        @keydown="onKeyDown"
        @click="onCursor"
        @keyup="onCursor"
        @scroll="onScroll"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
      ></textarea>

    </div>

    <!-- Status bar -->
    <div class="ce-statusbar">
      <span>Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
      <span>{{ lineCount }} líneas</span>
      <span v-if="dirty" class="ce-status-unsaved">Sin guardar · Ctrl+S</span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  filePath:   { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'save'])

const taEl     = ref(null)
const gutterEl = ref(null)
const bodyEl   = ref(null)

const cursorLine = ref(1)
const cursorCol  = ref(1)
const dirty      = ref(false)

const shortPath = computed(() => {
  if (!props.filePath) return ''
  return props.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
})

const lineCount = computed(() => {
  const m = props.modelValue.match(/\n/g)
  return m ? m.length + 1 : 1
})

// ── Cursor position ──────────────────────────────────────────────────────────
function onCursor() {
  const ta = taEl.value
  if (!ta) return
  const text  = ta.value.substring(0, ta.selectionStart)
  const lines = text.split('\n')
  cursorLine.value = lines.length
  cursorCol.value  = lines[lines.length - 1].length + 1
}

// ── Input ────────────────────────────────────────────────────────────────────
function onInput(e) {
  emit('update:modelValue', e.target.value)
  dirty.value = true
  onCursor()
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  const ta    = e.target
  const start = ta.selectionStart
  const end   = ta.selectionEnd
  const val   = ta.value

  // Tab → 4 spaces
  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    const newVal = val.slice(0, start) + '    ' + val.slice(end)
    emit('update:modelValue', newVal)
    dirty.value = true
    nextTick(() => { ta.selectionStart = ta.selectionEnd = start + 4 })
    return
  }

  // Shift+Tab → remove up to 4 leading spaces
  if (e.key === 'Tab' && e.shiftKey) {
    e.preventDefault()
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    const indent    = val.slice(lineStart).match(/^( {1,4})/)
    if (indent) {
      const remove = indent[1].length
      const newVal = val.slice(0, lineStart) + val.slice(lineStart + remove)
      emit('update:modelValue', newVal)
      dirty.value = true
      nextTick(() => { ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - remove) })
    }
    return
  }

  // Enter → auto-indent (+ extra indent after colon)
  if (e.key === 'Enter') {
    e.preventDefault()
    const lineStart   = val.lastIndexOf('\n', start - 1) + 1
    const lineText    = val.slice(lineStart, start)
    const indentMatch = lineText.match(/^(\s*)/)
    let   indent      = indentMatch ? indentMatch[1] : ''
    if (/:\s*$/.test(lineText.trimEnd())) indent += '    '
    const newVal = val.slice(0, start) + '\n' + indent + val.slice(end)
    emit('update:modelValue', newVal)
    dirty.value = true
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 1 + indent.length
      onCursor()
    })
    return
  }

  // Ctrl/Cmd + S → save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    emit('save')
    return
  }
}

// ── Scroll sync (gutter follows textarea) ────────────────────────────────────
function onScroll() {
  if (gutterEl.value && taEl.value) {
    gutterEl.value.scrollTop = taEl.value.scrollTop
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
function resetDirty() { dirty.value = false }
function focus() { nextTick(() => taEl.value?.focus()) }

defineExpose({ resetDirty, focus })
</script>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────────── */
.ce-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d1117;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  font-family: 'Cascadia Code', 'Consolas', 'Fira Code', 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 21px; /* fixed px — gutter rows must match exactly */
}

/* ── Topbar ───────────────────────────────────────────────────────── */
.ce-topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 14px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  font-size: 12px;
  flex-shrink: 0;
}
.ce-lang-badge {
  background: #1f6feb22;
  border: 1px solid #1f6feb66;
  color: #58a6ff;
  padding: 1px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}
.ce-file-label    { color: #8b949e; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ce-topbar-right  { display: flex; align-items: center; gap: 8px; }
.ce-dirty-dot     { color: #f0883e; font-size: 18px; line-height: 1; }
.ce-encoding      { color: #484f58; font-size: 11px; }

/* ── Body ─────────────────────────────────────────────────────────── */
.ce-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Gutter ───────────────────────────────────────────────────────── */
.ce-gutter {
  flex-shrink: 0;
  width: 52px;
  overflow: hidden;          /* scrolled via JS — no scrollbar */
  background: #0d1117;
  border-right: 1px solid #21262d;
  user-select: none;
  padding-top: 8px;          /* must match textarea padding-top */
}
.ce-ln {
  display: block;
  height: 21px;              /* must equal line-height */
  line-height: 21px;
  text-align: right;
  padding-right: 10px;
  font-size: 12px;
  color: #484f58;
  white-space: nowrap;
}
.ce-ln-active { color: #c9d1d9; }

/* ── Textarea ─────────────────────────────────────────────────────── */
.ce-ta {
  flex: 1;
  min-width: 0;
  padding: 8px 16px;
  background: #0d1117;
  color: #c9d1d9;
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: inherit;
  line-height: 21px;         /* must equal gutter row height */
  tab-size: 4;
  -moz-tab-size: 4;
  white-space: pre;          /* no wrap — horizontal scroll for long lines */
  overflow: auto;
  caret-color: #e6edf3;
  box-sizing: border-box;
}
.ce-ta::selection { background: #388bfd44; }

/* ── Status bar ───────────────────────────────────────────────────── */
.ce-statusbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 4px 14px;
  background: #161b22;
  border-top: 1px solid #21262d;
  font-size: 11px;
  color: #8b949e;
  flex-shrink: 0;
}
.ce-status-unsaved { color: #f0883e; margin-left: auto; }
</style>
