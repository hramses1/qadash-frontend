const { contextBridge } = require('electron');

// Con contextIsolation:true el frontend NO tiene Node. Solo se expone lo
// mínimo: el origen HTTP del backend embebido y un flag para saber que corre
// en escritorio (el router usa hash history y apiFetch/useSocket usan esta base
// porque bajo file:// no hay proxy de Vite ni mismo-origen).
contextBridge.exposeInMainWorld('QADASH', {
  apiBase: 'http://localhost:3001',
  desktop: true,
});
