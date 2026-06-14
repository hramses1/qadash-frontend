<template>
  <span v-if="status" class="result-badge" :class="`badge-${status}`">
    <span v-if="status === 'pending'" class="badge-icon">⏸</span>
    <span v-else-if="status === 'running'" class="badge-icon spinner">⟳</span>
    <span v-else-if="status === 'passed'" class="badge-icon">✅</span>
    <span v-else-if="status === 'failed'" class="badge-icon">❌</span>
    <span v-else-if="status === 'error'" class="badge-icon">⚠️</span>
    <span v-if="duration && status !== 'running' && status !== 'pending'" class="duration">
      {{ duration.toFixed(2) }}s
    </span>
  </span>
</template>

<script setup>
defineProps({
  status: { type: String, default: null },
  duration: { type: Number, default: null }
})
</script>
