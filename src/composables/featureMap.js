export const FEATURE_MAP = [
  { key: 'variables',   path: '/env',             label: 'Variables',         icon: '⚙️' },
  { key: 'reports',     path: '/reports',         label: 'Reportes',          icon: '📊' },
  { key: 'txtData',     path: '/datos-txt',       label: 'Datos TXT',         icon: '📄' },
  { key: 'jsonData',    path: '/datos-json',      label: 'Datos JSON',        icon: '🧩' },
  { key: 'errorImages', path: '/imagenes-error',  label: 'Imágenes de error', icon: '🖼️' },
  { key: 'docker',      path: '/docker',          label: 'Docker',            icon: '🐳' },
  { key: 'schedules',   path: '/calendarizacion', label: 'Calendarización',   icon: '🗓️' },
]

export function pathToFeature(path) {
  const found = FEATURE_MAP.find(f => f.path === path)
  return found ? found.key : null
}
