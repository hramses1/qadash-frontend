<template>
  <div class="file-group">
    <div class="file-header" @click="expanded = !expanded">
      <input
        type="checkbox"
        :checked="allSelected"
        :indeterminate.prop="someSelected"
        @change.stop="$emit('toggle-file', { name: file.name })"
        @click.stop
      />
      <span class="file-chevron" :class="{ open: expanded }">▸</span>
      <span class="file-icon">🧪</span>
      <span class="file-name">{{ file.name }}</span>
      <span class="file-count">{{ file.tests.length }}</span>
      <button
        class="btn-edit-file"
        @click.stop="$emit('edit-file', { file })"
        title="Editar archivo"
      >✏️</button>
    </div>

    <div v-show="expanded" class="file-tests">
      <div
        v-for="test in file.tests"
        :key="test.id"
        class="test-row"
        :class="rowClass(test.id)"
      >
        <input
          type="checkbox"
          :checked="test.selected"
          @change="$emit('toggle', { id: test.id })"
        />
        <span class="test-name">{{ shortName(test.id) }}</span>
        <ResultBadge
          :status="testStatuses[test.id]?.status"
          :duration="testStatuses[test.id]?.duration"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import ResultBadge from './ResultBadge.vue'

const props = defineProps({
  file: { type: Object, required: true },
  testStatuses: { type: Object, default: () => ({}) }
})

defineEmits(['toggle', 'toggle-file', 'edit-file'])

const fileExpanded = inject('fileExpanded', ref({}))

const expanded = computed({
  get: () => fileExpanded.value[props.file.name] !== false,
  set: (val) => { fileExpanded.value[props.file.name] = val }
})

const allSelected = computed(() => props.file.tests.every(t => t.selected))
const someSelected = computed(() =>
  props.file.tests.some(t => t.selected) && !allSelected.value
)

function shortName(id) {
  const parts = id.split('::')
  return parts.slice(1).join('::')
}

function rowClass(id) {
  const s = props.testStatuses[id]?.status
  return s ? `status-${s}` : ''
}
</script>
