<template>
  <div class="view-container">
    <h1 class="view-title">Configuración</h1>

    <!-- ── Rutas del Proyecto ── -->
    <div class="card">
      <button class="card-toggle" @click="showPaths = !showPaths" :aria-expanded="showPaths">
        <span class="toggle-caret" :class="{ open: showPaths }">▸</span>
        <h2 class="card-title">Rutas del Proyecto</h2>
        <span class="toggle-badge" :class="pathsReady ? 'badge-ok' : 'badge-warn'">
          {{ pathsReady ? 'Configurada' : 'Incompleta' }}
        </span>
      </button>

      <div v-show="showPaths" class="card-collapsible">

      <div class="form-group">
        <label>Ruta absoluta al proyecto de automatización</label>
        <div class="input-browse-row">
          <input v-model="form.projectPath" type="text" class="input" placeholder="C:\ruta\al\proyecto\tests" />
          <button class="btn-browse" @click="browse('folder', 'projectPath')" :disabled="browsing" title="Seleccionar carpeta">📁</button>
        </div>
      </div>

      <div class="form-group">
        <label>Ruta al archivo .env del proyecto</label>
        <div class="input-browse-row">
          <input v-model="form.envPath" type="text" class="input" placeholder="C:\ruta\al\proyecto\.env" />
          <button class="btn-browse" @click="detectEnv" :disabled="detectingEnv || !form.projectPath" title="Detectar .env automáticamente">
            {{ detectingEnv ? '⏳' : '🔎' }}
          </button>
          <button class="btn-browse" @click="browse('file', 'envPath')" :disabled="browsing" title="Seleccionar archivo">📄</button>
        </div>
        <small class="hint">
          <span v-if="envMsg" :class="envFound ? 'env-found' : 'env-miss'">{{ envMsg }}</span>
          <span v-else>Se detecta automáticamente dentro del proyecto. También puedes ingresarlo manualmente o con 📄.</span>
        </small>
      </div>

      <div class="form-group">
        <label>Comando pytest</label>
        <input v-model="form.pytestCmd" type="text" class="input" placeholder=".\venv\Scripts\pytest.exe" />
        <small class="hint">
          Siempre se usa el pytest del entorno virtual: <code>.\venv\Scripts\pytest.exe</code>
          (el venv debe llamarse <code>venv</code>).
        </small>
      </div>

      <div class="form-group">
        <label>Selenium Grid (URL remota)</label>
        <input v-model="form.seleniumRemoteUrl" type="text" class="input" placeholder="http://localhost:4444/wd/hub" />
        <small class="hint">
          Vacío → Chrome local. Con valor → los tests usan el contenedor Selenium
          (<code>webdriver.Remote</code>). Levanta el grid con <code>docker compose up -d selenium</code>.
          Vista en vivo: <code>http://localhost:7900</code>.
        </small>
      </div>

      <div class="form-group">
        <label>Carpeta de archivos .txt</label>
        <div class="input-browse-row">
          <input v-model="form.txtFolderPath" type="text" class="input" placeholder="C:\ruta\a\carpeta\con\txt" />
          <button class="btn-browse" @click="browse('folder', 'txtFolderPath')" :disabled="browsing" title="Seleccionar carpeta">📁</button>
        </div>
        <small class="hint">
          Carpeta con archivos <code>.txt</code>. Su contenido se muestra en
          <RouterLink to="/datos-txt">Datos TXT</RouterLink> y se puede descargar en Excel.
        </small>
      </div>

      <div class="form-group">
        <label>Carpeta de datos JSON (dataTest)</label>
        <div class="input-browse-row">
          <input v-model="form.jsonDataPath" type="text" class="input" placeholder="C:\ruta\al\proyecto\src\data\dataTest" />
          <button class="btn-browse" @click="browse('folder', 'jsonDataPath')" :disabled="browsing" title="Seleccionar carpeta">📁</button>
        </div>
        <small class="hint">
          Carpeta con subcarpetas (deposit, payment…) y sus archivos <code>.json</code>.
          Se editan de forma cómoda en <RouterLink to="/datos-json">Datos JSON</RouterLink>.
        </small>
      </div>

      <div class="form-group">
        <label>Carpeta de imágenes de error</label>
        <div class="input-browse-row">
          <input v-model="form.errorImagesPath" type="text" class="input" placeholder="(por defecto: proyecto\reports\errors)" />
          <button class="btn-browse" @click="browse('folder', 'errorImagesPath')" :disabled="browsing" title="Seleccionar carpeta">📁</button>
        </div>
        <small class="hint">
          Capturas de pantalla de fallos. Vacío → <code>proyecto\reports\errors</code>.
          Se ven en <RouterLink to="/imagenes-error">Imágenes de error</RouterLink>.
        </small>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" @click="validate" :disabled="validating || !form.projectPath">
          {{ validating ? 'Validando...' : '🔍 Validar ruta' }}
        </button>
        <button class="btn btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Guardando...' : '💾 Guardar' }}
        </button>
      </div>

      <div v-if="validationResult" class="alert" :class="validationResult.valid ? 'alert-success' : 'alert-error'">
        {{ validationResult.valid ? '✅ Ruta válida — pytest puede ejecutarse aquí' : '❌ ' + validationResult.reason }}
      </div>
      <div v-if="saveMsg" class="alert alert-success">✅ {{ saveMsg }}</div>
      <div v-if="error" class="alert alert-error">❌ {{ error }}</div>

      </div>
    </div>

    <!-- ── Módulos del Dashboard ── -->
    <div class="card">
      <button class="card-toggle" @click="showModules = !showModules" :aria-expanded="showModules">
        <span class="toggle-caret" :class="{ open: showModules }">▸</span>
        <h2 class="card-title">Módulos del Dashboard</h2>
      </button>

      <div v-show="showModules" class="card-collapsible">
        <p class="hint-text">
          Activa o desactiva módulos para adaptar el dashboard a esta automatización.
          Un módulo desactivado se oculta del menú y su sección queda bloqueada.
          La configuración se guarda por proyecto.
        </p>

        <div v-if="!form.projectPath" class="alert alert-warning">
          ⚠️ Configura primero la ruta del proyecto para editar sus módulos.
        </div>

        <template v-else>
          <div class="module-list">
            <label v-for="f in FEATURE_MAP" :key="f.key" class="module-row">
              <span class="module-info">
                <span class="module-icon">{{ f.icon }}</span>
                <span class="module-label">{{ f.label }}</span>
              </span>
              <input type="checkbox" v-model="moduleFlags[f.key]" class="module-switch" />
            </label>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" @click="saveModules" :disabled="savingModules">
              {{ savingModules ? 'Guardando...' : '💾 Guardar módulos' }}
            </button>
          </div>
          <div v-if="modulesMsg" class="alert alert-success">✅ {{ modulesMsg }}</div>
        </template>
      </div>
    </div>

    <!-- ── Entorno Virtual (Python) ── -->
    <div class="card">
      <h2 class="card-title">Entorno Virtual (Python)</h2>
      <p class="hint-text">
        Prepara el entorno del proyecto configurado: instala <code>virtualenv</code> si falta,
        crea el entorno virtual <code>venv</code> y luego instala las dependencias de
        <code>requirements.txt</code>.
      </p>
      <div class="form-actions">
        <button
          class="btn btn-primary"
          @click="openEnvModal"
          :disabled="!form.projectPath"
          title="Crear venv e instalar dependencias del proyecto"
        >
          🐍 Preparar entorno
        </button>
      </div>
      <div v-if="!form.projectPath" class="hint" style="margin-top:.5rem">
        Configura primero la ruta del proyecto.
      </div>
    </div>

    <!-- ── Instalación de Automatización ── -->
    <div class="card">
      <button class="card-toggle" @click="showInstall = !showInstall" :aria-expanded="showInstall">
        <span class="toggle-caret" :class="{ open: showInstall }">▸</span>
        <h2 class="card-title">Instalación de Automatización</h2>
        <span v-if="installStatus.checked" class="toggle-badge" :class="allReady ? 'badge-ok' : 'badge-warn'">
          {{ allReady ? 'Lista' : 'Pendiente' }}
        </span>
      </button>

      <div v-show="showInstall" class="card-collapsible">
      <p class="hint-text">
        Instala automáticamente el repositorio: clona desde GitHub,
        crea el entorno virtual e instala las dependencias.
      </p>

      <!-- Estado de instalación -->
      <div v-if="installStatus.checked" class="install-status-box" :class="allReady ? 'status-complete' : 'status-partial'">
        <div class="status-header">
          <span class="status-title">
            {{ allReady ? '✅ Automatización lista para ejecutar' : '⚠️ Estado de instalación' }}
          </span>
          <button class="btn-icon" @click="refreshReadiness" title="Actualizar estado">↺</button>
        </div>
        <div class="status-checks">
          <span :class="installStatus.repoCloned ? 'sc-ok' : 'sc-no'">
            {{ installStatus.repoCloned ? '✅' : '❌' }} Repositorio
          </span>
          <span :class="installStatus.venvCreated ? 'sc-ok' : 'sc-no'">
            {{ installStatus.venvCreated ? '✅' : '❌' }} Entorno virtual
          </span>
          <span :class="installStatus.depsInstalled ? 'sc-ok' : 'sc-no'">
            {{ installStatus.depsInstalled ? '✅' : '❌' }} Dependencias
          </span>
          <span :class="dockerReady ? 'sc-ok' : 'sc-no'">
            {{ dockerReady ? '✅' : (checks?.docker?.installed ? '⚠️' : '❌') }} Docker
          </span>
        </div>
        <div v-if="installStatus.fullyInstalled && dockerNeedsStart" class="status-docker-hint">
          Repo listo, pero Docker Desktop está apagado.
          <button class="btn btn-sm btn-secondary" @click="startDocker" :disabled="startingDocker || anyBusy">
            {{ startingDocker ? '⏳ Arrancando…' : '▶️ Iniciar Docker' }}
          </button>
        </div>
      </div>

      <!-- Paso 1 -->
      <div class="form-group" style="margin-top: 1.25rem">
        <label class="step-label">Paso 1 — Verificar requisitos del sistema</label>
        <div class="form-actions">
          <button class="btn btn-secondary" @click="checkPrereqs" :disabled="checking || anyBusy">
            {{ checking ? 'Verificando...' : '🔍 Verificar requisitos' }}
          </button>
        </div>
      </div>

      <div v-if="checks" class="checks-list">
        <div class="check-item" :class="checks.python.ok ? 'check-ok' : 'check-fail'">
          <span>{{ checks.python.ok ? '✅' : '❌' }}</span>
          <span class="check-name">Python</span>
          <span class="check-detail">{{ checks.python.ok ? checks.python.version : checks.python.error }}</span>
        </div>
        <div class="check-item" :class="checks.git.ok ? 'check-ok' : 'check-fail'">
          <span>{{ checks.git.ok ? '✅' : '❌' }}</span>
          <span class="check-name">Git</span>
          <span class="check-detail">{{ checks.git.ok ? checks.git.version : checks.git.error }}</span>
        </div>
        <div class="check-item" :class="checks.venv.ok ? 'check-ok' : 'check-fail'">
          <span>{{ checks.venv.ok ? '✅' : '❌' }}</span>
          <span class="check-name">virtualenv</span>
          <span class="check-detail">{{ checks.venv.ok ? checks.venv.type : checks.venv.error }}</span>
        </div>
        <div class="check-item" :class="checks.docker?.ok ? 'check-ok' : (checks.docker?.installed ? 'check-warn' : 'check-fail')">
          <span>{{ checks.docker?.ok ? '✅' : (checks.docker?.installed ? '⚠️' : '❌') }}</span>
          <span class="check-name">Docker</span>
          <span class="check-detail">
            {{ checks.docker?.ok ? `Docker ${checks.docker.version} (engine activo)` : checks.docker?.error }}
          </span>
          <button
            v-if="dockerNeedsStart"
            class="btn btn-sm btn-secondary check-action"
            @click="startDocker"
            :disabled="startingDocker || anyBusy"
          >
            {{ startingDocker ? '⏳ Arrancando…' : '▶️ Iniciar Docker Desktop' }}
          </button>
        </div>
      </div>

      <div v-if="checks && checksOk && dockerReady"  class="alert alert-success" style="margin-top:.75rem">✅ Todos los requisitos disponibles (incluido Docker).</div>
      <div v-if="checks && checksOk && !dockerReady" class="alert alert-warning" style="margin-top:.75rem">⚠️ Puedes instalar el repo, pero Docker no está listo: los tests con grid Selenium no correrán hasta arrancarlo.</div>
      <div v-if="checks && !checksOk" class="alert alert-error"   style="margin-top:.75rem">❌ Faltan requisitos. Instálalos antes de continuar.</div>

      <!-- Paso 2 -->
      <template v-if="checksOk">
        <div class="step-divider">
          <label class="step-label">Paso 2 — Configurar repositorio</label>
        </div>

        <div class="form-group">
          <label>URL del repositorio de GitHub</label>
          <input v-model="autoConfig.repoUrl" type="text" class="input"
            placeholder="https://github.com/usuario/repo.git" :disabled="anyBusy" />
        </div>

        <div class="form-group">
          <label>Ruta de instalación</label>
          <div class="input-browse-row">
            <input v-model="autoConfig.installPath" type="text" class="input" :disabled="anyBusy" />
            <button class="btn-browse" @click="browse('folder', 'installPath')" :disabled="anyBusy || browsing" title="Seleccionar carpeta">📁</button>
          </div>
          <small class="hint">Carpeta donde se clonará el repositorio</small>
        </div>

        <div class="form-actions">
          <button class="btn btn-secondary" @click="saveAutoConfig" :disabled="savingAuto || anyBusy">
            {{ savingAuto ? 'Guardando...' : '💾 Guardar configuración' }}
          </button>
          <button
            class="btn btn-primary"
            @click="openModal('install')"
            :disabled="anyBusy || !autoConfig.repoUrl || !autoConfig.installPath"
          >
            {{ installStatus.fullyInstalled ? '🔁 Reinstalar' : '⬇️ Instalar automatización' }}
          </button>
          <button
            class="btn btn-secondary"
            @click="openModal('update')"
            :disabled="anyBusy || !installStatus.repoCloned"
            title="Ejecuta git pull para actualizar el repositorio"
          >
            🔄 Actualizar repo
          </button>
        </div>

        <div v-if="!installStatus.repoCloned && installStatus.checked" class="hint" style="margin-top:.5rem">
          "Actualizar repo" disponible solo después de instalar.
        </div>
      </template>

      <div v-if="autoError"   class="alert alert-error" style="margin-top:1rem">❌ {{ autoError }}</div>
      <div v-if="updateError" class="alert alert-error" style="margin-top:1rem">❌ {{ updateError }}</div>

      </div>
    </div>

    <!-- ── Acerca de ── -->
    <div class="card">
      <h2 class="card-title">Acerca de</h2>
      <p class="hint-text">
        Este dashboard ejecuta los tests <strong>secuencialmente</strong> (uno a la vez)
        para evitar conflictos con la sesión del usuario de automatización.
      </p>
      <p class="hint-text">Los reportes se guardan en <code>backend/reports/</code> con timestamp.</p>
    </div>

    <!-- ── Modal Unificado ── -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-box">

          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">
              <template v-if="modalPhase === 'confirm'">
                {{ operation === 'install' ? '⬇️ Instalar automatización' : '🔄 Actualizar repositorio' }}
              </template>
              <template v-else-if="modalPhase === 'running'">
                {{ operation === 'install' ? '⚙️ Instalando...' : '⚙️ Actualizando...' }}
              </template>
              <template v-else-if="modalPhase === 'done'">✅ Completado</template>
              <template v-else-if="modalPhase === 'error'">❌ Error</template>
            </h3>
            <button class="btn-icon" @click="closeModal" :disabled="modalPhase === 'running'">✕</button>
          </div>

          <!-- Confirm -->
          <div v-if="modalPhase === 'confirm'" class="modal-body">
            <div class="confirm-ready">
              <div class="confirm-icon">✅</div>
              <div class="confirm-text">
                {{ operation === 'install' ? 'Todo listo para la instalación' : 'Todo listo para actualizar' }}
              </div>
            </div>

            <div class="confirm-details">
              <template v-if="operation === 'install'">
                <div class="detail-row">
                  <span class="detail-label">Python</span>
                  <span class="detail-value">{{ checks?.python?.version }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Git</span>
                  <span class="detail-value">{{ checks?.git?.version }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">virtualenv</span>
                  <span class="detail-value">{{ checks?.venv?.type }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Docker</span>
                  <span class="detail-value">{{ checks?.docker?.ok ? `${checks.docker.version} (activo)` : (checks?.docker?.installed ? 'instalado (apagado)' : 'no instalado') }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Repositorio</span>
                  <span class="detail-value detail-url">{{ autoConfig.repoUrl }}</span>
                </div>
              </template>
              <div class="detail-row">
                <span class="detail-label">Destino</span>
                <span class="detail-value">{{ autoConfig.installPath }}</span>
              </div>
            </div>

            <div v-if="operation === 'install' && installStatus.repoCloned" class="modal-info-note">
              ℹ️ Directorio ya existe — se usará sin re-clonar.
            </div>

            <!-- Branch selector (solo update) -->
            <div v-if="operation === 'update'" class="branch-selector">
              <label class="branch-label">Rama a actualizar</label>
              <div class="branch-input-row">
                <input
                  v-model="updateBranch"
                  type="text"
                  class="input branch-input"
                  placeholder="develop"
                />
                <div class="branch-chips">
                  <span v-if="branchesLoading" class="branch-loading">Cargando ramas…</span>
                  <button
                    v-for="b in branches"
                    :key="b"
                    class="branch-chip"
                    :class="{ 'branch-chip-active': updateBranch === b }"
                    @click="updateBranch = b"
                    type="button"
                  >{{ b }}</button>
                  <span v-if="!branchesLoading && branches.length === 0" class="branch-loading">
                    No se detectaron ramas — escribe el nombre manualmente
                  </span>
                </div>
              </div>
              <small class="hint">Se ejecutará: <code>git pull origin {{ updateBranch || 'develop' }}</code></small>
            </div>
          </div>

          <!-- Running / Done / Error -->
          <div v-else class="modal-body">
            <!-- Progress bar -->
            <div class="progress-section">
              <div class="progress-label">
                <span>{{ activeProgress.label }}</span>
                <span class="progress-pct">{{ activeProgress.percent }}%</span>
              </div>
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :class="{
                    'progress-active': modalPhase === 'running',
                    'progress-done':   modalPhase === 'done',
                    'progress-error':  modalPhase === 'error'
                  }"
                  :style="{ width: activeProgress.percent + '%' }"
                ></div>
              </div>
            </div>

            <!-- Steps -->
            <div class="steps-row">
              <template v-if="operation === 'install'">
                <div class="step-pill" :class="installStepClass('clone')">📦 Clonar</div>
                <div class="step-arrow">→</div>
                <div class="step-pill" :class="installStepClass('venv')">🐍 Entorno</div>
                <div class="step-arrow">→</div>
                <div class="step-pill" :class="installStepClass('deps')">📚 Deps</div>
              </template>
              <template v-else>
                <div class="step-pill" :class="updateStepClass('connect')">🔗 Conectar</div>
                <div class="step-arrow">→</div>
                <div class="step-pill" :class="updateStepClass('download')">📥 Descargar</div>
                <div class="step-arrow">→</div>
                <div class="step-pill" :class="updateStepClass('apply')">✅ Aplicar</div>
              </template>
            </div>

            <!-- Log -->
            <div class="install-log" ref="logContainer">
              <div
                v-for="log in installLogs"
                :key="log.id"
                :class="['log-line', 'log-' + log.type]"
              >{{ log.message }}</div>
              <div v-if="installLogs.length === 0" class="log-line log-info">Iniciando...</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <template v-if="modalPhase === 'confirm'">
              <button class="btn btn-secondary" @click="closeModal">Cancelar</button>
              <button class="btn btn-primary" @click="confirmAction">
                {{ operation === 'install' ? '✅ Confirmar instalación' : '✅ Confirmar actualización' }}
              </button>
            </template>
            <template v-else>
              <button class="btn btn-primary" @click="closeModal" :disabled="modalPhase === 'running'">
                {{ modalPhase === 'running' ? (operation === 'install' ? 'Instalando...' : 'Actualizando...') : 'Cerrar' }}
              </button>
            </template>
          </div>

        </div>
      </div>
    </Teleport>

    <!-- ── Modal: Preparar Entorno Virtual ── -->
    <Teleport to="body">
      <div v-if="showEnvModal" class="modal-overlay" @click.self="closeEnvModal">
        <div class="modal-box">

          <div class="modal-header">
            <h3 class="modal-title">
              <template v-if="envPhase === 'intro'">🐍 Preparar entorno virtual</template>
              <template v-else-if="envPhase === 'venv-running'">⚙️ Creando entorno...</template>
              <template v-else-if="envPhase === 'venv-done'">✅ Entorno creado</template>
              <template v-else-if="envPhase === 'deps-running'">⚙️ Instalando dependencias...</template>
              <template v-else-if="envPhase === 'done'">✅ Entorno listo</template>
              <template v-else-if="envPhase === 'error'">❌ Error</template>
            </h3>
            <button class="btn-icon" @click="closeEnvModal" :disabled="envRunning">✕</button>
          </div>

          <div class="modal-body">
            <!-- Intro -->
            <template v-if="envPhase === 'intro'">
              <div class="confirm-details">
                <div class="detail-row">
                  <span class="detail-label">Proyecto</span>
                  <span class="detail-value">{{ form.projectPath }}</span>
                </div>
              </div>
              <p class="hint-text">
                Paso 1 — se instalará <code>virtualenv</code> (si falta) y se creará el
                entorno <code>venv</code>. Luego podrás instalar las dependencias.
              </p>
            </template>

            <!-- Running / done / error -->
            <template v-else>
              <div class="progress-section">
                <div class="progress-label">
                  <span>{{ envProgress.label }}</span>
                  <span class="progress-pct">{{ envProgress.percent }}%</span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :class="{
                      'progress-active': envRunning,
                      'progress-done': envPhase === 'done' || envPhase === 'venv-done',
                      'progress-error': envPhase === 'error'
                    }"
                    :style="{ width: envProgress.percent + '%' }"
                  ></div>
                </div>
              </div>

              <div class="steps-row">
                <div class="step-pill" :class="envStepClass('venv')">🐍 Entorno</div>
                <div class="step-arrow">→</div>
                <div class="step-pill" :class="envStepClass('deps')">📚 Dependencias</div>
              </div>

              <div v-if="envPhase === 'venv-done'" class="modal-info-note">
                ✅ Entorno virtual listo. Continúa para instalar las dependencias de
                <code>requirements.txt</code>.
              </div>

              <div class="install-log" ref="envLogContainer">
                <div
                  v-for="log in envLogs"
                  :key="log.id"
                  :class="['log-line', 'log-' + log.type]"
                >{{ log.message }}</div>
                <div v-if="envLogs.length === 0" class="log-line log-info">Iniciando...</div>
              </div>
            </template>
          </div>

          <div class="modal-footer">
            <template v-if="envPhase === 'intro'">
              <button class="btn btn-secondary" @click="closeEnvModal">Cancelar</button>
              <button class="btn btn-primary" @click="startCreateVenv">✅ Crear entorno virtual</button>
            </template>
            <template v-else-if="envPhase === 'venv-done'">
              <button class="btn btn-secondary" @click="closeEnvModal">Cerrar</button>
              <button class="btn btn-primary" @click="startInstallDeps">📚 Instalar dependencias</button>
            </template>
            <template v-else>
              <button class="btn btn-primary" @click="closeEnvModal" :disabled="envRunning">
                {{ envRunning ? 'Procesando...' : 'Cerrar' }}
              </button>
            </template>
          </div>

        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { apiFetch } from '../composables/apiFetch.js'
import { useSocket } from '../composables/useSocket'
import { useAutomationState } from '../composables/useAutomationState'
import { FEATURE_MAP } from '../composables/featureMap'
import { useFeatures } from '../composables/useFeatures'

// ── Config principal ──
const form = ref({ projectPath: '', envPath: '', pytestCmd: 'pytest', txtFolderPath: '', seleniumRemoteUrl: '', errorImagesPath: '', jsonDataPath: '' })
const saving = ref(false)
const validating = ref(false)
const browsing = ref(false)
const validationResult = ref(null)
const saveMsg = ref('')
const error = ref('')

// Colapsables
const showPaths = ref(true)
const showInstall = ref(false)

// ── Módulos del Dashboard ──
const showModules = ref(false)
const savingModules = ref(false)
const modulesMsg = ref('')
const { flags: featureFlags, loadFeatures, saveFeatures } = useFeatures()
// Copia local editable (para no mutar el estado global hasta guardar).
const moduleFlags = ref({})

async function loadModules() {
  await loadFeatures()
  moduleFlags.value = { ...featureFlags.value }
}

async function saveModules() {
  savingModules.value = true
  modulesMsg.value = ''
  try {
    await saveFeatures({ ...moduleFlags.value })
    moduleFlags.value = { ...featureFlags.value }
    modulesMsg.value = 'Módulos guardados. El menú se actualizó.'
  } catch (e) {
    error.value = e.message
  } finally {
    savingModules.value = false
  }
}

// Estado de rutas: completa si proyecto + .env + pytest definidos
const pathsReady = computed(() =>
  !!form.value.projectPath && !!form.value.envPath && !!form.value.pytestCmd
)

// Auto-detección .env
const detectingEnv = ref(false)
const envMsg = ref('')
const envFound = ref(false)

async function detectEnv(silent = false) {
  if (!form.value.projectPath) return
  detectingEnv.value = true
  if (!silent) envMsg.value = ''
  try {
    const params = new URLSearchParams({ projectPath: form.value.projectPath })
    const res = await apiFetch(`/api/config/detect-env?${params}`)
    const data = await res.json()
    if (data.path) {
      form.value.envPath = data.path
      envFound.value = true
      envMsg.value = `✅ .env detectado: ${data.path}`
    } else {
      envFound.value = false
      if (!silent) envMsg.value = '⚠️ No se encontró .env en el proyecto. Ingrésalo manualmente.'
    }
  } catch (e) {
    envFound.value = false
    if (!silent) envMsg.value = `Error al detectar: ${e.message}`
  } finally {
    detectingEnv.value = false
  }
}

async function browse(type, target) {
  browsing.value = true
  try {
    const currentVal = target === 'projectPath' ? form.value.projectPath
      : target === 'envPath' ? form.value.envPath
      : target === 'txtFolderPath' ? form.value.txtFolderPath
      : target === 'errorImagesPath' ? form.value.errorImagesPath
      : target === 'jsonDataPath' ? form.value.jsonDataPath
      : autoConfig.value.installPath
    const params = new URLSearchParams({ type })
    if (currentVal) params.set('startPath', currentVal)
    const res = await apiFetch(`/api/config/browse?${params}`)
    const data = await res.json()
    if (data.path) {
      if (target === 'projectPath') form.value.projectPath = data.path
      else if (target === 'envPath') form.value.envPath = data.path
      else if (target === 'txtFolderPath') form.value.txtFolderPath = data.path
      else if (target === 'errorImagesPath') form.value.errorImagesPath = data.path
      else if (target === 'jsonDataPath') form.value.jsonDataPath = data.path
      else if (target === 'installPath') autoConfig.value.installPath = data.path
    }
  } catch (e) {
    error.value = `Error al abrir selector: ${e.message}`
  } finally {
    browsing.value = false
  }
}

onMounted(async () => {
  try {
    const res = await apiFetch('/api/config')
    const data = await res.json()
    form.value = {
      projectPath: data.projectPath || '',
      envPath: data.envPath || '',
      pytestCmd: data.pytestCmd || '.\\venv\\Scripts\\pytest.exe',
      txtFolderPath: data.txtFolderPath || '',
      seleniumRemoteUrl: data.seleniumRemoteUrl || '',
      errorImagesPath: data.errorImagesPath || '',
      jsonDataPath: data.jsonDataPath || ''
    }
    // Auto-detecta .env si hay proyecto pero no ruta .env guardada
    if (form.value.projectPath && !form.value.envPath) detectEnv(true)
  } catch {
    error.value = 'No se pudo cargar la configuración'
  }

  // Al cambiar el proyecto, intenta autodetectar .env si el campo está vacío
  watch(() => form.value.projectPath, () => {
    if (form.value.projectPath && !form.value.envPath) detectEnv(true)
  })

  if (!autoConfig.value.installPath) await loadAutoConfig()
  if (!installStatus.value.checked) await checkInstallStatus()
  // Verifica requisitos (incl. Docker) al entrar para mostrar readiness real.
  if (!checks.value) checkPrereqs()

  const { socket } = useSocket()
  initSocketListeners(socket, (projectPath, pytestCmd) => {
    form.value.projectPath = projectPath
    form.value.pytestCmd = pytestCmd
  })

  loadModules()
})

async function validate() {
  validating.value = true
  validationResult.value = null
  try {
    const res = await apiFetch('/api/config/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: form.value.projectPath })
    })
    validationResult.value = await res.json()
  } catch (e) {
    validationResult.value = { valid: false, reason: e.message }
  } finally {
    validating.value = false
  }
}

async function save() {
  saving.value = true
  saveMsg.value = ''
  error.value = ''
  try {
    const res = await apiFetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    const data = await res.json()
    if (data.error) error.value = data.error
    else if (data.projectChanged && data.reset) {
      const n = data.reset.removedReports || 0
      saveMsg.value = `Configuración guardada. Proyecto cambiado: analítica reiniciada (${n} reporte${n !== 1 ? 's' : ''} eliminado${n !== 1 ? 's' : ''}).`
    } else {
      saveMsg.value = 'Configuración guardada correctamente'
    }
    if (!data.error) await loadModules()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

// ── Automatización ──
const {
  checks, autoConfig, installStatus, installLogs,
  installDone, updateDone, autoError, updateError,
  installing, pulling, checking, savingAuto, startingDocker,
  progress, updateProgress, updateBranch,
  branches, branchesLoading,
  checksOk, dockerReady, dockerNeedsStart, allReady, anyBusy,
  loadAutoConfig, checkInstallStatus, checkPrereqs, fetchBranches,
  saveAutoConfig, startInstall, startUpdate, startDocker, initSocketListeners
} = useAutomationState()

// Refresca estado de instalación + requisitos (Docker incluido) en un clic.
async function refreshReadiness() {
  await Promise.all([checkInstallStatus(), checkPrereqs()])
}

// ── Modal ──
const showModal = ref(false)
const modalPhase = ref('idle')   // 'confirm' | 'running' | 'done' | 'error'
const operation  = ref('install') // 'install' | 'update'
const logContainer = ref(null)

const activeProgress = computed(() =>
  operation.value === 'install' ? progress.value : updateProgress.value
)

// Auto-scroll log
watch(installLogs, () => {
  nextTick(() => {
    if (logContainer.value) logContainer.value.scrollTop = logContainer.value.scrollHeight
  })
}, { deep: true })

// Phase transitions
watch(installing, val => { if (val && operation.value === 'install') modalPhase.value = 'running' })
watch(pulling,    val => { if (val && operation.value === 'update')  modalPhase.value = 'running' })
watch(installDone, val => { if (val && operation.value === 'install') modalPhase.value = 'done' })
watch(updateDone,  val => { if (val && operation.value === 'update')  modalPhase.value = 'done' })
watch(autoError,   val => { if (val && showModal.value && operation.value === 'install') modalPhase.value = 'error' })
watch(updateError, val => { if (val && showModal.value && operation.value === 'update')  modalPhase.value = 'error' })

// Re-check status when installPath changes
watch(() => autoConfig.value.installPath, () => checkInstallStatus())

function openModal(op) {
  operation.value = op
  modalPhase.value = 'confirm'
  showModal.value = true
  if (op === 'update') fetchBranches()
}

function closeModal() {
  if (modalPhase.value === 'running') return
  showModal.value = false
}

function confirmAction() {
  modalPhase.value = 'running'
  if (operation.value === 'install') startInstall()
  else startUpdate()
}

function installStepClass(key) {
  const step = progress.value.step || ''
  if (progress.value.percent === 100) return 'step-done'
  if (step.startsWith(key + '-done') || step.startsWith(key + '-skip')) return 'step-done'
  if (step.startsWith(key)) return 'step-active'
  const order = ['clone', 'venv', 'deps']
  const cur = order.findIndex(s => step.startsWith(s))
  const idx = order.indexOf(key)
  return idx < cur ? 'step-done' : 'step-pending'
}

function updateStepClass(key) {
  const step = updateProgress.value.step || ''
  if (updateProgress.value.percent === 100) return 'step-done'
  if (step === 'done') return 'step-done'
  if (step === key) return 'step-active'
  const order = ['connect', 'download', 'apply']
  const cur = order.findIndex(s => step.startsWith(s))
  const idx = order.indexOf(key)
  if (cur === -1) return 'step-pending'
  return idx < cur ? 'step-done' : idx === cur ? 'step-active' : 'step-pending'
}

// ── Modal Entorno Virtual ──
const showEnvModal = ref(false)
const envPhase = ref('intro')  // intro | venv-running | venv-done | deps-running | done | error
const envLogs = ref([])
const envProgress = ref({ percent: 0, label: '' })
const envError = ref('')
const envLogContainer = ref(null)
let envLogId = 0

const envRunning = computed(() => envPhase.value === 'venv-running' || envPhase.value === 'deps-running')

function envStepClass(key) {
  if (key === 'venv') {
    if (envPhase.value === 'venv-running') return 'step-active'
    if (['venv-done', 'deps-running', 'done'].includes(envPhase.value)) return 'step-done'
    return 'step-pending'
  }
  // deps
  if (envPhase.value === 'deps-running') return 'step-active'
  if (envPhase.value === 'done') return 'step-done'
  return 'step-pending'
}

function openEnvModal() {
  envPhase.value = 'intro'
  envLogs.value = []
  envProgress.value = { percent: 0, label: '' }
  envError.value = ''
  showEnvModal.value = true
}

function closeEnvModal() {
  if (envRunning.value) return
  showEnvModal.value = false
}

async function startCreateVenv() {
  envPhase.value = 'venv-running'
  envLogs.value = []
  envProgress.value = { percent: 0, label: 'Iniciando...' }
  envError.value = ''
  try {
    const res = await apiFetch('/api/automation/setup-venv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: form.value.projectPath })
    })
    const data = await res.json()
    if (data.error) { envError.value = data.error; envPhase.value = 'error' }
  } catch (e) {
    envError.value = e.message; envPhase.value = 'error'
  }
}

async function startInstallDeps() {
  envPhase.value = 'deps-running'
  envLogs.value = []
  envProgress.value = { percent: 0, label: 'Iniciando...' }
  envError.value = ''
  try {
    const res = await apiFetch('/api/automation/setup-deps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: form.value.projectPath })
    })
    const data = await res.json()
    if (data.error) { envError.value = data.error; envPhase.value = 'error' }
  } catch (e) {
    envError.value = e.message; envPhase.value = 'error'
  }
}

// Auto-scroll del log de entorno
watch(envLogs, () => {
  nextTick(() => {
    if (envLogContainer.value) envLogContainer.value.scrollTop = envLogContainer.value.scrollHeight
  })
}, { deep: true })

// Listeners de socket para el flujo de entorno virtual
const { socket: envSocket } = useSocket()
envSocket.on('env:log', ({ message, type }) => {
  envLogs.value.push({ id: envLogId++, message, type: type || 'info' })
})
envSocket.on('env:progress', ({ percent, label }) => {
  envProgress.value = { percent, label }
})
envSocket.on('env:venv-done', () => {
  if (envPhase.value === 'venv-running') envPhase.value = 'venv-done'
  checkInstallStatus()
})
envSocket.on('env:deps-done', () => {
  if (envPhase.value === 'deps-running') envPhase.value = 'done'
  checkInstallStatus()
})
envSocket.on('env:failed', ({ error: err }) => {
  envError.value = err
  envPhase.value = 'error'
})
</script>

<style scoped>
.step-label { font-weight: 600; font-size: 0.95rem; }

/* Cabecera colapsable */
.card-toggle {
  display: flex; align-items: center; gap: .6rem;
  width: 100%; background: none; border: none; cursor: pointer;
  padding: 0; margin: 0; color: inherit; text-align: left;
}
.card-toggle .card-title { margin: 0; }
.toggle-caret {
  font-size: .9rem; opacity: .6; transition: transform .2s; display: inline-block;
}
.toggle-caret.open { transform: rotate(90deg); }
.toggle-badge {
  margin-left: auto; font-size: .72rem; font-weight: 600;
  padding: .15rem .55rem; border-radius: 99px;
}
.badge-ok   { background: rgba(34,197,94,.15); color: #16a34a; }
.badge-warn { background: rgba(234,179,8,.15); color: #b45309; }
.card-collapsible { margin-top: 1rem; }

.env-found { color: #16a34a; }
.env-miss  { color: #b45309; }

.step-divider {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border, #e2e8f0);
  margin-bottom: 1rem;
}

.install-status-box { border-radius: 8px; padding: .85rem 1rem; margin-bottom: .25rem; }
.status-complete { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.35); }
.status-partial  { background: rgba(234,179,8,.08);  border: 1px solid rgba(234,179,8,.35); }
.status-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .6rem; }
.status-title  { font-weight: 600; font-size: .9rem; }
.btn-icon { background: none; border: none; cursor: pointer; font-size: 1rem; opacity: .6; padding: 0 .25rem; color: inherit; }
.btn-icon:hover { opacity: 1; }
.btn-icon:disabled { opacity: .3; cursor: not-allowed; }
.status-checks { display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: .85rem; }
.sc-ok { opacity: .9; } .sc-no { opacity: .65; }

.checks-list { display: flex; flex-direction: column; gap: .5rem; margin-top: .75rem; }
.check-item { display: flex; align-items: center; gap: .75rem; padding: .6rem .9rem; border-radius: 6px; font-size: .9rem; }
.check-ok   { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.3); }
.check-fail { background: rgba(239,68,68,.08);  border: 1px solid rgba(239,68,68,.3); }
.check-warn { background: rgba(234,179,8,.08);  border: 1px solid rgba(234,179,8,.35); }
.check-name { font-weight: 600; min-width: 60px; }
.check-detail { opacity: .75; font-size: .82rem; }
.check-action { margin-left: auto; white-space: nowrap; }

.status-docker-hint {
  display: flex; align-items: center; gap: .6rem; flex-wrap: wrap;
  margin-top: .7rem; padding-top: .6rem;
  border-top: 1px dashed var(--border, #e2e8f0);
  font-size: .83rem; opacity: .9;
}

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.65);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.modal-box {
  background: var(--bg, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  width: 100%; max-width: 580px;
  display: flex; flex-direction: column;
  max-height: 90vh; overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,.4);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.1rem 1.25rem .9rem;
  border-bottom: 1px solid var(--border, #e2e8f0);
}
.modal-title { font-size: 1.05rem; font-weight: 600; margin: 0; }
.modal-body { padding: 1.25rem; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border, #e2e8f0);
  display: flex; justify-content: flex-end; gap: .75rem;
}

/* Confirm phase */
.confirm-ready { display: flex; align-items: center; gap: .75rem; font-size: 1.1rem; font-weight: 600; margin-bottom: 1.25rem; }
.confirm-icon  { font-size: 1.6rem; }
.confirm-details {
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 8px; padding: .75rem 1rem; margin-bottom: 1rem;
}
.detail-row { display: flex; gap: .75rem; padding: .3rem 0; font-size: .88rem; }
.detail-label { font-weight: 600; min-width: 90px; opacity: .7; }
.detail-value { word-break: break-all; }
.detail-url { opacity: .8; font-size: .82rem; }
.modal-info-note {
  background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.3);
  border-radius: 6px; padding: .6rem .9rem; font-size: .88rem;
}

/* Progress */
.progress-section { margin-bottom: 1rem; }
.progress-label { display: flex; justify-content: space-between; font-size: .88rem; font-weight: 500; margin-bottom: .4rem; }
.progress-pct { font-weight: 700; }
.progress-track { height: 10px; border-radius: 99px; background: rgba(128,128,128,.2); overflow: hidden; }
.progress-fill  { height: 100%; border-radius: 99px; transition: width .35s ease; }
.progress-active { background: linear-gradient(90deg,#6366f1,#8b5cf6); }
.progress-done   { background: #22c55e; }
.progress-error  { background: #ef4444; }

/* Steps */
.steps-row { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; }
.step-pill {
  padding: .3rem .7rem; border-radius: 99px; font-size: .8rem; font-weight: 500;
  border: 1px solid var(--border, #e2e8f0); transition: all .3s;
}
.step-pending { opacity: .35; }
.step-active  { background: rgba(99,102,241,.15); border-color: #6366f1; color: #6366f1; opacity: 1; }
.step-done    { background: rgba(34,197,94,.12);  border-color: #22c55e; color: #16a34a; opacity: 1; }
.step-arrow   { opacity: .3; font-size: .85rem; }

/* Log — colores explícitos para visibilidad garantizada */
.install-log {
  background: #111827;
  color: #d1d5db;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: .75rem 1rem;
  max-height: 220px; min-height: 80px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: .82rem;
}
.log-line    { padding: 1px 0; line-height: 1.55; color: #d1d5db; }
.log-info    { color: #9ca3af; }
.log-success { color: #34d399; font-weight: 600; }
.log-error   { color: #f87171; font-weight: 600; }

/* Branch selector */
.branch-selector {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border, #e2e8f0);
}
.branch-label { display: block; font-weight: 600; font-size: .9rem; margin-bottom: .5rem; }
.branch-input-row { display: flex; flex-direction: column; gap: .5rem; }
.branch-input { font-family: monospace; }
.branch-chips { display: flex; gap: .4rem; flex-wrap: wrap; }
.branch-chip {
  padding: .25rem .65rem; border-radius: 99px; font-size: .78rem; font-weight: 500;
  border: 1px solid var(--border, #e2e8f0);
  background: none; cursor: pointer; color: inherit;
  transition: all .15s;
}
.branch-chip:hover { border-color: #6366f1; color: #6366f1; }
.branch-chip-active { background: rgba(99,102,241,.15); border-color: #6366f1; color: #6366f1; }
.branch-loading { font-size: .8rem; opacity: .65; align-self: center; }

.module-list { display: flex; flex-direction: column; gap: .25rem; margin: .5rem 0 1rem; }
.module-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: .6rem .9rem; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border, #e2e8f0);
}
.module-row:hover { background: var(--bg-secondary, #f8fafc); }
.module-info { display: flex; align-items: center; gap: .6rem; font-size: .92rem; }
.module-icon { font-size: 1.1rem; }
.module-label { font-weight: 500; }
.module-switch { width: 18px; height: 18px; cursor: pointer; }
</style>
