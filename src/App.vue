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
        <li>
          <RouterLink to="/env" class="nav-link">
            <span class="nav-icon">⚙️</span>
            <span>Variables</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/reports" class="nav-link">
            <span class="nav-icon">📊</span>
            <span>Reportes</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/datos-txt" class="nav-link">
            <span class="nav-icon">📄</span>
            <span>Datos TXT</span>
          </RouterLink>
        </li>
        <li>
          <RouterLink to="/docker" class="nav-link">
            <span class="nav-icon">🐳</span>
            <span>Docker</span>
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
import { useSocket } from './composables/useSocket'
const { connected } = useSocket()
</script>
