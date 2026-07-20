// Cliente fetch central: inyecta el header X-Profile-Id del perfil activo en
// toda llamada a la API para que el backend enrute al workspace correcto.
const STORAGE_KEY = 'qadash.activeProfileId';

// Acceso a localStorage tolerante a entornos sin DOM (tests en node, SSR).
const store = (typeof localStorage !== 'undefined') ? localStorage : {
  _m: {}, getItem(k) { return this._m[k] ?? null; },
  setItem(k, v) { this._m[k] = String(v); }, removeItem(k) { delete this._m[k]; },
};

// Base de la API. En web = '' (rutas relativas vía proxy de Vite / mismo
// origen). En Electron el preload expone window.QADASH.apiBase
// ('http://localhost:3001') porque bajo file:// no hay proxy ni origen HTTP.
export function apiBase() {
  if (typeof window !== 'undefined' && window.QADASH && window.QADASH.apiBase) {
    return window.QADASH.apiBase;
  }
  return '';
}

// Convierte una ruta '/api/...' en URL absoluta cuando hace falta (Electron).
// Sirve para fetch y también para href/src de <a>/<img> en templates.
export function apiUrl(path) {
  const base = apiBase();
  if (!base) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

let activeProfileId = store.getItem(STORAGE_KEY) || null;

// Suscriptores notificados al cambiar de perfil (para recargar estado scoped).
const listeners = new Set();

export function getActiveProfileId() { return activeProfileId; }

export function setActiveProfileId(id) {
  activeProfileId = id;
  if (id) store.setItem(STORAGE_KEY, id);
  else store.removeItem(STORAGE_KEY);
  listeners.forEach(fn => { try { fn(id); } catch {} });
}

export function onProfileChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (activeProfileId) headers['X-Profile-Id'] = activeProfileId;
  return fetch(apiUrl(url), { ...options, headers });
}
