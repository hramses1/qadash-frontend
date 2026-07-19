import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('apiFetch', () => {
  beforeEach(() => { vi.resetModules(); });

  it('inyecta X-Profile-Id desde el perfil activo', async () => {
    const mod = await import('./apiFetch.js');
    mod.setActiveProfileId('perfil-2');
    const spy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = spy;
    await mod.apiFetch('/api/config');
    expect(spy).toHaveBeenCalled();
    const opts = spy.mock.calls[0][1];
    expect(opts.headers['X-Profile-Id']).toBe('perfil-2');
  });

  it('preserva headers existentes', async () => {
    const mod = await import('./apiFetch.js');
    mod.setActiveProfileId('perfil-1');
    const spy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = spy;
    await mod.apiFetch('/api/x', { headers: { 'Content-Type': 'application/json' } });
    const opts = spy.mock.calls[0][1];
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-Profile-Id']).toBe('perfil-1');
  });

  it('sin perfil activo no agrega header', async () => {
    const mod = await import('./apiFetch.js');
    mod.setActiveProfileId(null);
    const spy = vi.fn(() => Promise.resolve({ ok: true }));
    global.fetch = spy;
    await mod.apiFetch('/api/x');
    const opts = spy.mock.calls[0][1];
    expect(opts.headers['X-Profile-Id']).toBeUndefined();
  });
});
