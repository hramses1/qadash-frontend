<template>
  <div v-if="node.type === 'folder'" class="folder-group">
    <div class="folder-header" :class="`depth-${depth}`" @click="expanded = !expanded">
      <input
        type="checkbox"
        :checked="folderAllSelected"
        :indeterminate.prop="folderSomeSelected"
        @change.stop="toggleFolder"
        @click.stop
      />
      <span class="folder-chevron" :class="{ open: expanded }">▸</span>
      <span class="folder-icon">{{ expanded ? '📂' : '📁' }}</span>
      <span class="folder-name">{{ node.name }}</span>
      <span class="folder-exec-stats" v-if="hasFolderStatus">
        <span v-if="folderRunning > 0" class="fstat-running">⟳ {{ folderRunning }}</span>
        <span v-if="folderPassed > 0" class="fstat-passed">✅ {{ folderPassed }}</span>
        <span v-if="folderFailed > 0" class="fstat-failed">❌ {{ folderFailed }}</span>
      </span>
      <span class="file-count">{{ folderTotalTests }}</span>
    </div>

    <div v-show="expanded" class="folder-children">
      <FolderNode
        v-for="child in node.children"
        :key="child.type === 'folder' ? child.path : child.file.name"
        :node="child"
        :testStatuses="testStatuses"
        :depth="depth + 1"
        @toggle="$emit('toggle', $event)"
        @toggle-file="$emit('toggle-file', $event)"
          @edit-file="$emit('edit-file', $event)"
      />
    </div>
  </div>

  <div v-else class="file-node">
    <TestList
      :file="node.file"
      :fileIdx="node.fileIdx"
      :testStatuses="testStatuses"
      @toggle="$emit('toggle', $event)"
      @toggle-file="$emit('toggle-file', $event)"
      @edit-file="$emit('edit-file', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import TestList from './TestList.vue'

defineOptions({ name: 'FolderNode' })

const props = defineProps({
  node: { type: Object, required: true },
  testStatuses: { type: Object, default: () => ({}) },
  depth: { type: Number, default: 0 }
})

defineEmits(['toggle', 'toggle-file', 'edit-file'])

const folderExpanded = inject('folderExpanded', ref({}))

const expanded = computed({
  get: () => folderExpanded.value[props.node.path] !== false,
  set: (val) => { folderExpanded.value[props.node.path] = val }
})

function getAllTests(node) {
  if (node.type === 'file') return node.file.tests
  return node.children.flatMap(c => getAllTests(c))
}

const allTests = computed(() => getAllTests(props.node))
const folderTotalTests = computed(() => allTests.value.length)
const folderAllSelected = computed(() =>
  allTests.value.length > 0 && allTests.value.every(t => t.selected)
)
const folderSomeSelected = computed(() =>
  allTests.value.some(t => t.selected) && !folderAllSelected.value
)

const folderPassed = computed(() =>
  allTests.value.filter(t => props.testStatuses[t.id]?.status === 'passed').length
)
const folderFailed = computed(() =>
  allTests.value.filter(t => ['failed', 'error'].includes(props.testStatuses[t.id]?.status)).length
)
const folderRunning = computed(() =>
  allTests.value.filter(t => props.testStatuses[t.id]?.status === 'running').length
)
const hasFolderStatus = computed(() =>
  folderPassed.value > 0 || folderFailed.value > 0 || folderRunning.value > 0
)

function toggleFolder() {
  const val = !folderAllSelected.value
  allTests.value.forEach(t => { t.selected = val })
}
</script>
