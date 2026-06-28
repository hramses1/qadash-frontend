import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './assets/style.css'

import Dashboard from './views/Dashboard.vue'
import EnvEditor from './views/EnvEditor.vue'
import Reports from './views/Reports.vue'
import Settings from './views/Settings.vue'
import TxtData from './views/TxtData.vue'
import Docker from './views/Docker.vue'
import Schedules from './views/Schedules.vue'
import ErrorImages from './views/ErrorImages.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: Dashboard },
    { path: '/env', component: EnvEditor },
    { path: '/reports', component: Reports },
    { path: '/datos-txt', component: TxtData },
    { path: '/docker', component: Docker },
    { path: '/calendarizacion', component: Schedules },
    { path: '/imagenes-error', component: ErrorImages },
    { path: '/settings', component: Settings }
  ]
})

createApp(App).use(router).mount('#app')
