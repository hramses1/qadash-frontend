import { ref } from 'vue'
import { io } from 'socket.io-client'

let instance = null

export function useSocket() {
  if (!instance) {
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling']
    })
    const connected = ref(false)

    socket.on('connect', () => { connected.value = true })
    socket.on('disconnect', () => { connected.value = false })

    instance = { socket, connected }
  }
  return instance
}
