# QADash Desktop (Electron)

Empaqueta `qadash-backend` + `qadash-frontend` en una app de escritorio. El
shell de Electron levanta el backend real (`qadash-backend/server.js`) en
`localhost:3001` y abre el build del frontend (`../dist`).

## Requisitos de estructura

Los dos repos deben estar como carpetas hermanas:

```
Dashboard/
├── qadash-backend/     # con node_modules instalado
└── qadash-frontend/
    ├── dist/           # build de Vite
    └── desktop/        # este shell Electron
```

## Cómo funciona la adaptación

- **`vite.config.js`**: `base: './'` → assets relativos (cargan bajo `file://`).
- **Router** (`src/main.js`): hash history cuando `window.QADASH.desktop` (lo
  expone el preload); en navegador sigue con history normal.
- **`apiFetch`/`useSocket`/`useProfiles`**: usan `window.QADASH.apiBase`
  (`http://localhost:3001`) en Electron; en web quedan relativos (proxy Vite).
- **Datos**: `main.js` fija `QADASH_DATA_DIR` a la carpeta `userData` (escribible
  en la app empaquetada); perfiles/config/reportes viven ahí.
- **Seguridad**: `contextIsolation: true`, `nodeIntegration: false`, preload
  mínimo. El frontend no accede a Node.

## Desarrollo

```bash
# 1) Instalar deps del backend (una vez)
cd ../../qadash-backend && npm install

# 2) Build del frontend
cd ../qadash-frontend && npm run build

# 3) Instalar y correr el shell
cd desktop && npm install
npm start
```

## Empaquetar instalador

```bash
cd qadash-frontend && npm run build      # regenera dist/
cd desktop && npm run dist               # .exe (Windows) / .deb (Linux) en release/
```

`electron-builder` copia `../dist` y `../../qadash-backend` (sin
`profiles/`, `reports/`, `data/`, ni tests) a los recursos de la app.

## Flujo de trabajo

1. Cambias código en backend o frontend.
2. `npm run build` en `qadash-frontend/`.
3. Pruebas con `npm start` en `desktop/`.
4. Generas instalador con `npm run dist`.
