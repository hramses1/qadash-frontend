<template>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <span class="logo">⚡ Test Dashboard</span>
      </div>
      <ul class="nav-list">
        <li>
          <RouterLink to="/dashboard" class="nav-link">
            <span class="nav-icon">🧪</span>
            <span>Tests</span>
          </RouterLink>
        </li>
        <li v-for="f in FEATURE_MAP" :key="f.key" v-show="isEnabled(f.key)">
          <RouterLink :to="f.path" class="nav-link">
            <span class="nav-icon">{{ f.icon }}</span>
            <span>{{ f.label }}</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/settings" class="nav-link">
            <span class="nav-icon">🔧</span>
            <span>Configuración</span>
          </RouterLink>
        </li>
      </ul>
      <div class="sidebar-footer">
        <span class="connection-status" :class="connected ? 'connected' : 'disconnected'">
          {{ connected ? '● Conectado' : '● Desconectado' }}
        </span>
      </div>
    </nav>
    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <KeepAlive :include="['Dashboard', 'Docker']">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useSocket } from './composables/useSocket'
import { useFeatures } from './composables/useFeatures'
import { FEATURE_MAP } from './composables/featureMap'

const { connected } = useSocket()
const { isEnabled, loadFeatures } = useFeatures()

onMounted(loadFeatures)
</script>
