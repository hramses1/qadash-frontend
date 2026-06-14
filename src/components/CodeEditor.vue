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

    <!-- Editor body: gutter + stacked highlight/textarea -->
    <div class="ce-body" ref="bodyEl">

      <div class="ce-gutter" ref="gutterEl" aria-hidden="true">
        <div
          v-for="n in lineCount"
          :key="n"
          class="ce-ln"
          :class="{ 'ce-ln-active': n === cursorLine }"
        >{{ n }}</div>
      </div>

      <div class="ce-area">
        <pre class="ce-highlight" ref="hlEl" aria-hidden="true" v-html="highlighted"></pre>
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
const hlEl     = ref(null)
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

// ── Syntax highlighting ───────────────────────────────────────────────────────
const KEYWORDS = new Set([
  'False','None','True','and','as','assert','async','await',
  'break','class','continue','def','del','elif','else','except',
  'finally','for','from','global','if','import','in','is','lambda',
  'nonlocal','not','or','pass','raise','return','try','while','with','yield'
])
const BUILTINS = new Set([
  'abs','all','any','bin','bool','breakpoint','bytearray','bytes','callable',
  'chr','classmethod','compile','complex','delattr','dict','dir','divmod',
  'enumerate','eval','exec','filter','float','format','frozenset','getattr',
  'globals','hasattr','hash','help','hex','id','input','int','isinstance',
  'issubclass','iter','len','list','locals','map','max','memoryview','min',
  'next','object','oct','open','ord','pow','print','property','range','repr',
  'reversed','round','set','setattr','slice','sorted','staticmethod','str',
  'sum','super','tuple','type','vars','zip','self','cls','Exception','BaseException',
  'ValueError','TypeError','KeyError','IndexError','AttributeError','RuntimeError',
  'StopIteration','OSError','IOError','FileNotFoundError','NotImplementedError',
  'AssertionError','ImportError','NameError','ZeroDivisionError'
])

// Matches tokens in priority order — strings first so keywords inside aren't highlighted
const TOKEN_RE = /([fFrRbBuU]{0,2}"""[\s\S]*?""")|([fFrRbBuU]{0,2}'''[\s\S]*?''')|([fFrRbBuU]{0,2}"(?:[^"\\\n]|\\.)*")|([fFrRbBuU]{0,2}'(?:[^'\\\n]|\\.)*')|(#[^\n]*)|(\b(?:0[xX][\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)[jJ]?\b)|(@[\w.]+)|(\b[A-Za-z_]\w*\b)/g

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(code) {
  TOKEN_RE.lastIndex = 0
  let result = ''
  let last = 0
  let afterDef = false
  let m

  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) result += escHtml(code.slice(last, m.index))
    const tok = m[0]

    if (m[1] || m[2] || m[3] || m[4]) {
      afterDef = false
      result += `<span class="hl-str">${escHtml(tok)}</span>`
    } else if (m[5]) {
      afterDef = false
      result += `<span class="hl-cmt">${escHtml(tok)}</span>`
    } else if (m[6]) {
      afterDef = false
      result += `<span class="hl-num">${escHtml(tok)}</span>`
    } else if (m[7]) {
      afterDef = false
      result += `<span class="hl-dec">${escHtml(tok)}</span>`
    } else if (m[8]) {
      if (KEYWORDS.has(tok)) {
        afterDef = tok === 'def' || tok === 'class'
        result += `<span class="hl-kw">${escHtml(tok)}</span>`
      } else if (afterDef) {
        afterDef = false
        result += `<span class="hl-fn">${escHtml(tok)}</span>`
      } else if (BUILTINS.has(tok)) {
        result += `<span class="hl-bi">${escHtml(tok)}</span>`
      } else {
        // highlight function calls: identifier immediately followed by (
        const nextChar = code[m.index + tok.length]
        if (nextChar === '(') {
          result += `<span class="hl-call">${escHtml(tok)}</span>`
        } else {
          result += escHtml(tok)
        }
      }
    } else {
      result += escHtml(tok)
    }

    last = TOKEN_RE.lastIndex
  }

  if (last < code.length) result += escHtml(code.slice(last))
  return result + '\n' // prevent last-line height collapse in <pre>
}

const highlighted = computed(() => highlight(props.modelValue))

// ── Cursor position ───────────────────────────────────────────────────────────
function onCursor() {
  const ta = taEl.value
  if (!ta) return
  const text  = ta.value.substring(0, ta.selectionStart)
  const lines = text.split('\n')
  cursorLine.value = lines.length
  cursorCol.value  = lines[lines.length - 1].length + 1
}

// ── Input ─────────────────────────────────────────────────────────────────────
function onInput(e) {
  emit('update:modelValue', e.target.value)
  dirty.value = true
  onCursor()
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
function onKeyDown(e) {
  const ta    = e.target
  const start = ta.selectionStart
  const end   = ta.selectionEnd
  const val   = ta.value

  if (e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault()
    const newVal = val.slice(0, start) + '    ' + val.slice(end)
    emit('update:modelValue', newVal)
    dirty.value = true
    nextTick(() => { ta.selectionStart = ta.selectionEnd = start + 4 })
    return
  }

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

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    emit('save')
    return
  }
}

// ── Scroll sync ───────────────────────────────────────────────────────────────
function onScroll() {
  const ta = taEl.value
  if (!ta) return
  if (gutterEl.value) gutterEl.value.scrollTop = ta.scrollTop
  if (hlEl.value) {
    hlEl.value.scrollTop  = ta.scrollTop
    hlEl.value.scrollLeft = ta.scrollLeft
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
function resetDirty() { dirty.value = false }
function focus() { nextTick(() => taEl.value?.focus()) }

defineExpose({ resetDirty, focus })
</script>

<style scoped>
.ce-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0d1117;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  font-family: 'Cascadia Code', 'Consolas', 'Fira Code', 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 21px;
}

/* ── Topbar ─────────────────────────────────────────────────────────── */
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
.ce-file-label   { color: #8b949e; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ce-topbar-right { display: flex; align-items: center; gap: 8px; }
.ce-dirty-dot    { color: #f0883e; font-size: 18px; line-height: 1; }
.ce-encoding     { color: #484f58; font-size: 11px; }

/* ── Body ───────────────────────────────────────────────────────────── */
.ce-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Gutter ─────────────────────────────────────────────────────────── */
.ce-gutter {
  flex-shrink: 0;
  width: 52px;
  overflow: hidden;
  background: #0d1117;
  border-right: 1px solid #21262d;
  user-select: none;
  padding-top: 8px;
}
.ce-ln {
  display: block;
  height: 21px;
  line-height: 21px;
  text-align: right;
  padding-right: 10px;
  font-size: 12px;
  color: #484f58;
  white-space: nowrap;
}
.ce-ln-active { color: #c9d1d9; }

/* ── Highlight + textarea stacked ───────────────────────────────────── */
.ce-area {
  position: relative;
  flex: 1;
  min-width: 0;
}

/* CRITICAL: .ce-highlight and .ce-ta must share identical font/spacing/padding
   so highlighted text aligns pixel-perfectly with the transparent textarea cursor. */
.ce-highlight,
.ce-ta {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  padding: 8px 16px;
  margin: 0;
  font-family: 'Cascadia Code', 'Consolas', 'Fira Code', 'Courier New', monospace;
  font-size: 13.5px;
  line-height: 21px;
  tab-size: 4;
  -moz-tab-size: 4;
  white-space: pre;
  overflow: auto;
  box-sizing: border-box;
  word-spacing: normal;
  letter-spacing: normal;
}

.ce-highlight {
  background: #0d1117;
  color: #c9d1d9;
  pointer-events: none;
  border: none;
  scrollbar-width: none;  /* hidden — textarea drives scrolling */
}
.ce-highlight::-webkit-scrollbar { display: none; }

.ce-ta {
  background: transparent;
  color: transparent;
  caret-color: #e6edf3;
  border: none;
  outline: none;
  resize: none;
  z-index: 1;
}
.ce-ta::selection { background: #388bfd44; }

/* ── Status bar ─────────────────────────────────────────────────────── */
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

/* ── Token colors (GitHub Dark inspired) ────────────────────────────── */
/* :deep() required — v-html content doesn't receive Vue's scoped attribute */
:deep(.hl-kw)   { color: #ff7b72; }
:deep(.hl-bi)   { color: #d2a8ff; }
:deep(.hl-str)  { color: #a5d6ff; }
:deep(.hl-cmt)  { color: #6e7681; font-style: italic; }
:deep(.hl-num)  { color: #79c0ff; }
:deep(.hl-dec)  { color: #e3b341; }
:deep(.hl-fn)   { color: #f0c18d; }
:deep(.hl-call) { color: #d2a8ff; }
</style>
