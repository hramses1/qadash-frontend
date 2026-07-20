import { ref } from 'vue'
import { io } from 'socket.io-client'
import { getActiveProfileId, onProfileChange, apiBase } from './apiFetch.js'
import { useProfiles } from './useProfiles.js'

let instance = null

export function useSocket() {
  if (!instance) {
    // En web: mismo origen ('/'). En Electron: origen HTTP del backend.
    const socket = io(apiBase() || '/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    })
    const connected = ref(false)
    let joinedRoom = null

    // Une el socket a la sala del perfil activo. Sin esto no llegan los logs de
    // ejecución (el backend emite a salas profile:<id>, no en broadcast).
    function joinActive() {
      const id = getActiveProfileId()
      if (!id) return
      if (joinedRoom && joinedRoom !== id) socket.emit('profile:leave', joinedRoom)
      socket.emit('profile:join', id)
      joinedRoom = id
    }

    socket.on('connect', () => { connected.value = true; joinActive() })
    socket.on('disconnect', () => { connected.value = false })

    // Badges "corriendo": el canal global lista los perfiles activos.
    const { setRunning } = useProfiles()
    socket.on('profiles:status', (list) => setRunning(list))

    // Al cambiar de perfil, re-unir a la nueva sala sin recargar la página.
    onProfileChange(() => joinActive())

    instance = { socket, connected, joinActive }
  }
  return instance
}
