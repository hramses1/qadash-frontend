<template>
  <div class="ce-root">

    <!-- Topbar -->
    <div class="ce-topbar">
      <span class="ce-lang-badge">🐍 Python</span>
      <span class="ce-file-label" :title="filePath">{{ shortPath }}</span>
      <div class="ce-topbar-right">
        <span v-if="dirty" class="ce-dirty-dot" title="Cambios sin guardar">●</span>
        <span class="ce-encoding">UTF-8</span>
      </div>
    </div>

    <!-- CodeMirror mounts here -->
    <div class="ce-host" ref="hostEl"></div>

    <!-- Status bar -->
    <div class="ce-statusbar">
      <span>Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
      <span>{{ lineCount }} líneas</span>
      <span v-if="dirty" class="ce-status-unsaved">Sin guardar · Ctrl+S</span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection, rectangularSelection,
  crosshairCursor, highlightSpecialChars
} from '@codemirror/view'
import {
  defaultKeymap, history, historyKeymap, indentWithTab
} from '@codemirror/commands'
import {
  indentOnInput, bracketMatching, foldGutter, foldKeymap,
  syntaxHighlighting, defaultHighlightStyle
} from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' },
  filePath:   { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue', 'save'])

const hostEl     = ref(null)
const cursorLine = ref(1)
const cursorCol  = ref(1)
const lineCount  = ref(1)
const dirty      = ref(false)

let view = null

const shortPath = computed(() => {
  if (!props.filePath) return ''
  return props.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
})

// ── Editor theme tweaks layered on top of oneDark ───────────────────────────────
const editorTheme = EditorView.theme({
  '&':                 { height: '100%', fontSize: '13.5px', backgroundColor: '#0d1117' },
  '.cm-scroller':      {
    fontFamily: "'Cascadia Code','Consolas','Fira Code','Courier New',monospace",
    lineHeight: '1.55',
    overflow: 'auto'
  },
  '.cm-content':       { paddingBottom: '40vh' },   // generous tail — last line always reachable
  '.cm-gutters':       { backgroundColor: '#0d1117', borderRight: '1px solid #21262d', color: '#484f58' },
  '.cm-activeLineGutter': { backgroundColor: '#161b22', color: '#c9d1d9' },
  '.cm-activeLine':    { backgroundColor: '#161b2255' },
  '&.cm-focused':      { outline: 'none' },
  '.cm-cursor':        { borderLeftColor: '#e6edf3' }
})

// Recomputed status (line/col/lineCount) on every selection or doc change
function syncStatus() {
  if (!view) return
  const state = view.state
  lineCount.value = state.doc.lines
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  cursorLine.value = line.number
  cursorCol.value  = head - line.from + 1
}

const updateListener = EditorView.updateListener.of((u) => {
  if (u.docChanged) {
    const text = u.state.doc.toString()
    emit('update:modelValue', text)
    dirty.value = true
  }
  if (u.docChanged || u.selectionSet) syncStatus()
})

function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      python(),
      oneDark,
      editorTheme,
      keymap.of([
        // Ctrl/Cmd+S → save
        { key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true } },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap
      ]),
      updateListener,
      EditorView.lineWrapping
    ]
  })
}

onMounted(() => {
  view = new EditorView({
    state: createState(props.modelValue),
    parent: hostEl.value
  })
  syncStatus()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

// External modelValue changes (e.g. loading a different file) → replace document
watch(() => props.modelValue, (val) => {
  if (!view) return
  const current = view.state.doc.toString()
  if (val === current) return
  // Full document swap, reset history for the new file
  view.setState(createState(val))
  dirty.value = false
  syncStatus()
})

// ── Public API (unchanged contract with Dashboard.vue) ──────────────────────────
function resetDirty() { dirty.value = false }
function focus() { nextTick(() => view?.focus()) }

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

/* ── CodeMirror host ────────────────────────────────────────────────── */
.ce-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.ce-host :deep(.cm-editor) { height: 100%; }

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
</style>
