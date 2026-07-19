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

async function loadProfiles() {
  const res = await fetch('/api/profile-admin');
  const data = await res.json();
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
  await fetch(`/api/profile-admin/${id}/activate`, { method: 'PATCH' });
  activeProfileId.value = id;
  setActiveProfileId(id);
}

async function createProfile(name) {
  const res = await fetch('/api/profile-admin', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Error creando perfil');
  const entry = await res.json();
  await loadProfiles();
  return entry;
}

async function renameProfile(id, name) {
  const res = await fetch(`/api/profile-admin/${id}/rename`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Error renombrando');
  await loadProfiles();
}

async function duplicateProfile(id, name) {
  const res = await fetch(`/api/profile-admin/${id}/duplicate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Error duplicando');
  const entry = await res.json();
  await loadProfiles();
  return entry;
}

async function deleteProfile(id) {
  const res = await fetch(`/api/profile-admin/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Error borrando');
  await loadProfiles();
}

export function useProfiles() {
  return {
    profiles, activeProfileId, runningIds,
    loadProfiles, setActive, createProfile, renameProfile, duplicateProfile, deleteProfile,
    setRunning,
  };
}
