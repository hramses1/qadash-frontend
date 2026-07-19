import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FEATURE_MAP, pathToFeature } from './featureMap'
import { useFeatures } from './useFeatures'

describe('featureMap', () => {
  it('tiene 7 features toggleables', () => {
    expect(FEATURE_MAP.map(f => f.key).sort()).toEqual(
      ['docker', 'errorImages', 'jsonData', 'reports', 'schedules', 'txtData', 'variables'].sort()
    )
  })
  it('pathToFeature mapea rutas', () => {
    expect(pathToFeature('/docker')).toBe('docker')
    expect(pathToFeature('/dashboard')).toBe(null)
    expect(pathToFeature('/settings')).toBe(null)
  })
})

describe('useFeatures', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  it('isEnabled: tests/config siempre true', () => {
    const { isEnabled } = useFeatures()
    expect(isEnabled('tests')).toBe(true)
    expect(isEnabled('config')).toBe(true)
  })
  it('loadFeatures pinta flags desde la API', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({
      variables: true, reports: true, txtData: true, jsonData: true,
      errorImages: true, docker: false, schedules: true
    }) })
    const { loadFeatures, isEnabled } = useFeatures()
    await loadFeatures()
    expect(isEnabled('docker')).toBe(false)
    expect(isEnabled('reports')).toBe(true)
  })
  it('saveFeatures hace POST y actualiza flags', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({
      variables: false, reports: true, txtData: true, jsonData: true,
      errorImages: true, docker: true, schedules: true
    }) })
    const { saveFeatures, isEnabled } = useFeatures()
    await saveFeatures({ variables: false })
    expect(global.fetch).toHaveBeenCalledWith('/api/features', expect.objectContaining({ method: 'POST' }))
    expect(isEnabled('variables')).toBe(false)
  })
})
