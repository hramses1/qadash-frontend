<template>
  <div class="progress-container">
    <div class="progress-header">
      <span class="progress-label">{{ done ? 'Ejecución completada' : 'Ejecutando tests...' }}</span>
      <span class="progress-count">{{ current }} / {{ total }} ({{ percentage }}%)</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :class="{ done }" :style="{ width: percentage + '%' }"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  percentage: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  done: { type: Boolean, default: false }
})
</script>
