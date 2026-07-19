import { ref } from 'vue';
import { getActiveProfileId, setActiveProfileId } from './apiFetch.js';

// Estado singleton de perfiles (workspaces). El CRUD pega a /api/profile-admin,
// que NO pasa por el middleware de perfil (gestiona perfiles en sí).
const profiles = ref([]);
const activeProfileId = ref(getActiveProfileId());
// Ids de perfiles corriendo (badge). Alimentado por el canal socket profiles:status.
const runningIds = ref(new Set());

function setRunning(list) {
  runningIds.value = new Set((list || []).filter(p => p.running).map(p => p.id));
}

// Parseo tolerante: nunca llama res.json() a ciegas. Si el body está vacío o no
// es JSON (backend viejo, 404, proxy), da un error claro en vez de crashear con
// "Unexpected end of JSON input".
async function jreq(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('No se pudo contactar el servidor. ¿Backend corriendo?');
  }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { /* no-JSON */ } }
  if (!res.ok) {
    throw new Error((data && data.error) || `El servidor respondió ${res.status}. Reinicia el backend (v2.1).`);
  }
  return data || {};
}

async function loadProfiles() {
  const data = await jreq('/api/profile-admin');
  profiles.value = data.profiles || [];
  const valid = profiles.value.some(p => p.id === activeProfileId.value);
  const next = valid ? activeProfileId.value : data.activeProfileId;
  if (next && next !== activeProfileId.value) {
    activeProfileId.value = next;
    setActiveProfileId(next);
  } else if (next && !getActiveProfileId()) {
    setActiveProfileId(next);
  }
  return profiles.value;
}

async function setActive(id) {
  await jreq(`/api/profile-admin/${id}/activate`, { method: 'PATCH' });
  activeProfileId.value = id;
  setActiveProfileId(id);
}

async function createProfile(name) {
  const entry = await jreq('/api/profile-admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  await loadProfiles();
  return entry;
}

async function renameProfile(id, name) {
  await jreq(`/api/profile-admin/${id}/rename`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  await loadProfiles();
}

async function duplicateProfile(id, name) {
  const entry = await jreq(`/api/profile-admin/${id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  await loadProfiles();
  return entry;
}

async function deleteProfile(id) {
  await jreq(`/api/profile-admin/${id}`, { method: 'DELETE' });
  await loadProfiles();
}

export function useProfiles() {
  return {
    profiles, activeProfileId, runningIds,
    loadProfiles, setActive, createProfile, renameProfile, duplicateProfile, deleteProfile,
    setRunning,
  };
}
