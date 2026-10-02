# AGENTS.md — Contexto completo del proyecto Lexometra

> Documento de contexto para agentes de IA. Sirve para que cualquier agente
> (o desarrollador) entienda el proyecto sin tener que releer todo el código.
> Si algo no está aquí, revisa el código fuente antes de asumir.

---

## 1. ¿Qué es Lexometra?

**Lexometra** es un sistema web (SaaS) de gestión jurídica y comercial en español
(Colombia). Ayuda a un despacho/empresa de servicios legales a gestionar todo el
ciclo de vida de sus clientes y procesos:

1. **Comercial** — registro de clientes, prospección, contratos, recaudos, reportes negativos (datacrédito/transUnion).
2. **Jurídico** — casos jurídicos, procesos internos (tutela, derecho de petición, demanda, etc.), actuaciones, documentos, entidades.
3. **Tesoreria** — facturación electrónica (integrada con Factus → DIAN), pagos, egresos, notas crédito/débito, cartera.
4. **Referidos** — gestión de referidores y comisiones automáticas.

Cada rol de usuario ve un dashboard adaptado a su perfil.

**Stack:** Python 3.13 / Django 5.1 / PostgreSQL (sqlite en dev) / Gunicorn + Nginx.

---

## 2. Estructura de directorios

```
lexometra/                          # Raíz del proyecto (repo)
├── AGENTS.md                       # Este archivo
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore
├── deploy.sh                       # Script de deploy en VPS (bash)
├── gunicorn.conf.py                # Config de Gunicorn
├── gunicorn.service                # Unit de systemd (copiar a /etc/systemd/system/)
├── nginx_lexometra.conf            # Config de sitio Nginx (copiar a sites-available/)
├── manage.py                       # Entry point CLI de Django
├── requirements.txt
└── lexometra/                      # Paquete de Django
    ├── db.sqlite3                  # BD local (dev, ignorada por git)
    ├── logs/                       # Logs de Django (django.log)
    ├── media/                      # Archivos subidos (documentos, logos)
    ├── staticfiles/                # Collección de estáticos (prod)
    ├── templates/                  # Templates globales
    ├── lexometra_proj/             # Proyecto (settings, urls, wsgi, asgi)
    ├── usuarios/                   # App: usuarios y autenticación
    ├── comercial/                  # App: clientes, procesos comerciales, recaudos
    ├── procesos/                   # App: casos jurídicos, procesos internos, documentos
    ├── referidos/                  # App: referidores y comisiones
    └── tesoreria/                  # App: facturación, pagos, egresos, Factus
```

---

## 3. Punto de entrada y configuración

### `manage.py`
Carga `.env` con `python-dotenv` y usa `DJANGO_SETTINGS_MODULE=lexometra.lexometra_proj.settings`.

**Comandos útiles:**
```bash
python manage.py migrate
python manage.py collectstatic --noinput --clear
python manage.py createsuperuser
python manage.py runserver
```

### `lexometra_proj/settings.py`
- Lee toda la configuración desde variables de entorno (con defaults de dev).
- `BASE_DIR` = `lexometra/lexometra/` (el paquete interno, no la raíz del repo).
- **DB:** por defecto sqlite3 (`db.sqlite3`); en prod se usa PostgreSQL vía env.
- **Apps instaladas:** admin, auth, contenttypes, sessions, messages, staticfiles, humanize + las 5 apps propias (`usuarios`, `procesos`, `comercial`, `referidos`, `tesoreria`).
- `AUTH_USER_MODEL = 'usuarios.Usuario'`.
- `LOGIN_URL = '/login/'`, `LOGIN_REDIRECT_URL = '/'`.
- Idioma `es-co`, zona horaria `America/Bogota`.
- `TEMPLATES.DIRS = [BASE_DIR / 'templates']` (templates globales).
- `STATIC_URL='static/'`, `STATIC_ROOT=BASE_DIR/'staticfiles'`.
- `MEDIA_URL='/media/'`, `MEDIA_ROOT=BASE_DIR/'media'`.
- Seguridad HTTPS y SMTP (email) leídos de env (ver `.env.example`).
- Logging a `logs/django.log` (rotativo, nivel ERROR).

### Variables de entorno clave (`.env.example`)
| Variable | Uso |
|---|---|
| `DJANGO_SECRET_KEY` | Clave secreta |
| `DJANGO_DEBUG` | `True`/`False` |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos (csv) |
| `DB_ENGINE/DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT` | PostgreSQL |
| `EMAIL_*` / `DEFAULT_FROM_EMAIL` | SMTP (recuperación, notificaciones) |
| `CSRF_COOKIE_SECURE`, `SESSION_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_*` | Seguridad HTTPS |

> ⚠️ **Nunca** commits `.env` (está en `.gitignore`).

### `lexometra_proj/urls.py` (rutas raíz)
```
admin/           → admin de Django
''               → redirect a 'login'
'' + usuarios/urls.py
'' + comercial/urls.py
'' + procesos/urls.py
'' + referidos/urls.py
'' + tesoreria/urls.py
```
En DEBUG se sirven los archivos de `MEDIA`.

---

## 4. Aplicaciones (apps) y sus modelos

### 4.1 `usuarios`
Modelo de usuario personalizado con roles.

**Modelo `Usuario(AbstractUser)`:**
- Campo extra: `role` (choices): `ADMIN`, `COMERCIAL`, `COLABORADOR`, `ABOGADO`.
- Properties: `is_admin`, `is_comercial`, `is_colaborador`, `is_abogado`.

**Views:**
- `login_view` — POST autentica y redirige a dashboard.
- `logout_view`.
- `dashboard_view` — renderiza dashboard según rol:
  - `ADMIN` → `dashboard/admin.html` (métricas globales, gráficos, vencimientos, financiero).
  - `COMERCIAL` → `dashboard/comercial.html`.
  - `ABOGADO` → `dashboard/colaborador.html`.
  - `COLABORADOR` → `dashboard/colaborador.html`.

**URLs:** `/login/`, `/logout/`, `/dashboard/`.

**Mixin útil:** `RoleRequiredMixin` (`usuarios/mixins.py`) — restringe acceso por `allowed_roles`.

### 4.2 `comercial`
Gestión comercial de clientes y procesos.

**Modelos:**
- `PerfilEmpresa` — datos de la empresa (razón social, NIT, datos bancarios, logo). Se usa en el contrato. Datos por defecto de "Diego Andrés Viloria Carpintero" (Barranquilla).
- `Cliente` — datos personales, condiciones especiales (victima conflicto, indígena, adulto mayor, etc.), FK `comercial` (usuario COMERCIAL) y `referidor`. Campos extra: `canal_origen` (choices: TELECOMERCIAL/REFERIDO/VISITA/RED_SOCIAL/PORTAL/OTRO) y `fecha_contrato`. Genera `id_comercial` automático con formato `AAAAMM###` (año-mes-secuencia) en `save()`.
- `Recaudo` — cobros a clientes (FK cliente, concepto, valor, fecha, `es_anticipo`). Dispara señal de comisión.
- `ReporteNegativo` — reportes en centrales de riesgo (entidad, obligación, gestión: PENDIENTE/GESTIONADO/ACUERDO/ELIMINADO, saldo, permiso negativa hasta, `obligation_status`). Constante módulo `ESTADOS_SIN_SALDO` (p.ej. saldo debe ser 0 y gestión SALDADO). TextChoices no puede contener una constante dentro de su cuerpo (error de metaclase) → `ESTADOS_SIN_SALDO` vive a nivel de módulo.
- `Actividad` — **novedad manual** por cliente (FK cliente, `fecha`, `descripcion`, `usuario`); se une al historial de actividades junto con los eventos automáticos.

**Views (todas requieren login):** lista de procesos comerciales (`comercial/lista.html`), ficha de cliente (`comercial/ficha.html`), creación de cliente+proceso, AJAX para servicios/estados, recaudos, actuaciones, edición de centrales de riesgo y estructura de cobro, reportes negativos (CRUD), subir documentos, y **generación de contrato** (`generar_contrato`) con vista HTML o PDF (WeasyPrint, opcional).
- `lista_comercial_view` — filtros `cliente__isnull=False` (evita orphans tras borrar cliente con FK SET_NULL).
- `_armar_historial(cliente)` / `historial_actividad_view` — unifican el historial: cambios de estado, recaudos, reportes, documentos y novedades manuales (`Actividad`), ordenados por fecha desc. La ficha muestra los recientes y el botón "Ver todas" abre la página expandida.
- `agregar_actividad_manual` — POST; solo ADMIN/COMERCIAL; registra una novedad en el historial del cliente.
- `generar_factura_cobro` — Req 8: al completar el cobro mixto crea una factura **BORRADOR** (NO emite a DIAN, preserva Factus). Guarda CUFE/estado solo cuando sí se emite.
- `recalcular_anticipo_y_saldo` — cronograma de cuotas del anticipo (modelo `AnticipoCuota`) y recalculo de saldo al registrar recaudos.
- `lista_contratos` — **lista global de contratos** (URL `/contratos/`, template `comercial/lista_contratos.html`), con búsqueda por cliente/cédula, paginación y enlaces Ver/PDF.
- `historial_actividad_view` — página "Ver todas" del historial, con formulario para agregar novedades manuales.

**`utils.py`:** `numero_a_letras()` — convierte números a letras en español (para montos en contrato).

**Management commands:**
- `seed_full` — crea datos de prueba completos (usuarios, referidores, entidades, clientes, reportes, procesos, casos, internos, facturas, pagos, recaudos, egresos).
- `seed_perfil_empresa` — crea el `PerfilEmpresa` por defecto (PK=1).

**URLs:** prefijo `/comercial/...` (ver `comercial/urls.py`). Roles que acceden: ADMIN, COMERCIAL (solo sus clientes), ABOGADO (solo lectura).
- Rutas destacadas: `comercial_lista`, `comercial_detalle_cliente` (`/comercial/cliente/<pk>/`), `comercial_nuevo`, `comercial_generar_contrato`, `comercial_historial` (`/comercial/cliente/<pk>/actividad/`), `comercial_agregar_actividad` (`.../actividad/agregar/`), `comercial_facturar_cobro`, `comercial_contratos` (`/contratos/`), `comercial_editar_centrales`, `comercial_editar_cobro`, `comercial_eliminar_documento`.

**Tests:** `comercial/tests.py` — `FlujoCompletoTest` con 11 casos que cubren Req 1–17 (id_comercial/canal, sync de valor_pactado, cronograma de cuotas, comisión de referidor, estados sin saldo, observación obligatoria, no volver a NUEVO, CONTRATO_FIRMADO→fecha+auto-caso, generación de factura BORRADOR). Todos pasan (`python manage.py test comercial`).

### 4.3 `procesos`
Módulo jurídico: casos, procesos internos, documentos, entidades, calendario.

**Modelos:**
- `EstadoProceso` — estados comerciales personalizables (dinámicos, con `activo` y `orden`).
- `Servicio` — servicios ofrecidos (dinámicos).
- `Proceso` — vínculo comercial↔jurídico. Campos clave: `estado_comercial` (string libre/EstadoProceso), `estado_legal` (ACTIVO/SUSPENDIDO/TERMINADO/ARCHIVADO), `tipo_servicio`, `servicio` (FK), `referidor`, `cliente` (FK), `colaborador` (FK COLABORADOR), credenciales datacrédito/transUnion, estructura de cobro (`valor_pactado`, `saldo_pendiente`, `valor_expectativa_total`, `porcentaje_anticipo`, `cantidad_reportes`, `cuotas_anticipo`), datos de competencia (departamento/ciudad juzgado), fechas. Properties: `dias_restantes`, `dias_ingreso`, `tipo_servicio_display`.
- `Actuacion` — registro de actuaciones por proceso (fecha, descripción, quién registró).
- `CasoJuridico` — caso legal vinculado a un `Proceso`. FK `abogado_asignado` (ABOGADO), `tipo_proceso`, `estado`, `prioridad`, partes (demandante/demandado), `proximo_vencimiento`, `habilitado_modulo_juridico`, etc. En `save()` copia el cliente desde el proceso si falta.
- `ProcesoInterno` — sub-proceso dentro de un caso (tipo: TUTELA, DERECHO_PETICION, DEMANDA, RECURSO, CONCILIACION, PRUEBA, NOTIFICACION, OTRO; estado: ACTIVO/EN_PROCESO/RESUELTO/ARCHIVADO/APELACION). Genera `codigo_interno` `PI-AAAAMM-####`. Tiene `precio` (facturable).
- `Entidad` — directorio de entidades (razón social, NIT, complejidad, emails, notas, y `archivo` adjunto descargable).
- `Documento` — archivos adjuntos (valida extensiones: pdf, doc, xls, imágenes, txt, msg, zip, etc.), vinculados a `CasoJuridico` o `ProcesoInterno` (y a `Cliente` vía ficha). Subida a `media/documentos/AAA/MM/`.

**Signals (`signals.py`):** al guardar un `Proceso`, si `estado_comercial == 'CONTRATO_FIRMADO'` y no existe un `CasoJuridico` para ese proceso, lo **auto-crea** asignando el abogado menos cargado (`get_least_loaded_lawyer()`).

**Helper:** `get_least_loaded_lawyer()` — devuelve el abogado activo con menos casos (para asignación automática).

**Views (todas requieren login):**
- `lista_casos_view` — lista de casos jurídicos (`procesos/lista_casos.html`).
- `detalle_caso_view`, `editar_caso_view`, `crear_caso_juridico`.
- `crear_proceso_interno`, `cambiar_estado_interno`, `subir_documento`, `eliminar_documento`.
- `calendario_view` — calendario mensual con eventos de vencimientos (casos, procesos, internos, facturas) y actuaciones (`procesos/calendario.html`).
- `directorio_entidades`, `crear_entidad`, `editar_entidad`, `eliminar_entidad`.
- `lista_procesos_internos`, `detalle_proceso_interno`, `editar_proceso_interno`.
- `crear_servicio_desde_proceso` — crea un ProcesoInterno desde un Proceso, auto-creando el CasoJuridico si hace falta.
- `servicios_listos_para_facturar` — ProcesosInternos RESUELTOS aún no facturados (para tesorería).

**URLs:** `/procesos/...`, `/servicios/proceso/...`, `/calendario/`, `/entidades/...`, `/procesos-internos/...`.

### 4.4 `referidos`
Gestión de referidores y comisiones.

**Modelos:**
- `Referidor` — nombre, cédula (única), teléfono, correo, `comision` (% por defecto 10), datos bancarios (banco/cuenta/tipo), `estado` (ACTIVO/INACTIVO).
- `Comision` — comisión generada (FK referidor, FK cliente, `monto_base`, `porcentaje`, `monto_comision`, `pagada`, fechas).

**Signals (`signals.py`):**
- Al crear un `Recaudo` → genera comisión si el cliente tiene referidor activo.
- Al crear un `Pago` → genera comisión si la factura tiene cliente con referidor activo.
- `generar_comision_para_cliente()` calcula `monto * (porcentaje/100)`.

**Views (requieren login):**
- `panel_referidos_view` — panel con totales por referidor (`referidos/panel_referidos.html`). Muestra por cada referidor su **enlace público** de captura (URL `/registro/?ref=<pk>`) con botones copiar/abrir, y el botón "Crear cliente manualmente".
- `comisiones_view` — listado de comisiones con pestañas (pendientes/pagadas) y agregación por referidor.
- `marcar_comision_pagada` — solo ADMIN marca una comisión como pagada.
- `crear_referidor_view`.

**Enlace público de referido (NO requiere login):**
- `registro_referido_publico` — view pública (`referidos/views.py`), URL `registro_referido` (`/registro/`), template `referidos/registro_referido.html`. Muestra el nombre del referidor y un formulario de prospecto (nombre, cédula, teléfono obligatorios + email, ciudad, servicio, notas). Al enviar crea (o re-vincula) un `Cliente` con `canal_origen='REFERIDO'` y un `Proceso` en estado NUEVO. "Enlace no válido" si el referidor no existe/está inactivo. Responsive del tipo landing.

**URLs:** `/referidos/`, `/referidos/nuevo/`, `/referidos/comisiones/`, `/referidos/comisiones/<pk>/pagar/`, `/registro/`.

### 4.5 `tesoreria`
Facturación electrónica (DIAN vía **Factus**), pagos, egresos, notas.

**Modelos:**
- `ProveedorFacturacion` — proveedor de facturación (ej. "Factus Sandbox") con `activo`, `api_url`, `api_key`, `configuracion` (JSON con tokens, credenciales, rangos). Guarda tokens.
- `Factura` — estados: BORRADOR/PENDIENTE/EMITIDA/RECHAZADA/PAGO_PARCIAL/PAGADA/VENCIDA/ANULADA. Término de pago: CONTADO/15_DIAS/30_DIAS/45_DIAS/60_DIAS. Número auto `FAC-AAAAMM-####`. En `save()` recalcula `saldo_pendiente` y el estado según pagos/fechas.
- `FacturaItem` — ítem de factura (descripcion, cantidad, valor_unitario, IVA). En `save()` calcula subtotal e IVA.
- `Pago` — pago asociado a factura (método: EFECTIVO/TRANSFERENCIA/PSE/CONSIGNACION/TARJETA). En `save()` actualiza `valor_pagado` de la factura.
- `Egreso` — gasto (categoría: NOMINA/PROVEEDORES/SERVICIOS/GASTOS_ADMIN/OTRO).
- `NotaCreditoDebito` — nota crédito/débito asociada a factura.

**Service `services/factus.py`:** integración con **Factus** (sandbox) para facturación electrónica:
- `get_access_token` — OAuth2 (refresh token → password grant fallback), cachea token en `configuracion`.
- `build_invoice_payload` — construye el payload de la factura según API Factus v2.
- `emitir_factura` — valida/emite factura ante DIAN; actualiza estado (EMITIDA/RECHAZADA), guarda CUFE, número, QR, respuesta.
- `consultar_estado`, `eliminar_en_factus`, `descargar_pdf`, `descargar_xml`, `listar_facturas`.
- URLs de sandbox: `https://api-sandbox.factus.com.co/oauth/token` y `/v2`.

**Views (requieren login):** panel de facturación/cartera/tesorería/reportes/notas (todos renderizan `tesoreria/panel_tesoreria.html` con `seccion_activa`), creación/edición/anulación/emisión de factura, consulta DIAN, descarga XML/PDF Factus, listado Factus, registrar pago, crear egreso, crear nota, exportar PDF (WeasyPrint opcional), APIs JSON (clientes/procesos/casos para autocompletar), y `generar_borrador_desde_pi_view` (genera factura borrador desde procesos internos RESUELTOS no facturados).

**Management commands:**
- `setup_factus` — crea/actualiza el `ProveedorFacturacion` "Factus Sandbox" con credenciales de prueba y obtiene token. ⚠️ Contiene credenciales hardcodeadas de sandbox (no son de producción).
- `test_flow_factus` — flujo completo de prueba: cliente → proceso → caso → recaudo → factura → pago → emisión en Factus.

**URLs:** `/tesoreria/...` (ver `tesoreria/urls.py`).

---

## 5. Templates

Templates globales en `lexometra/lexometra/templates/`:
```
base.html
_pagination.html
dashboard/    (admin.html, comercial.html, colaborador.html)
comercial/    (lista.html, ficha.html, contrato.html, recaudo_form.html, actuacion_form.html, lista_contratos.html, historial_actividad.html)
procesos/     (lista_casos.html, detalle_caso.html, editar_caso.html, calendario.html, directorio_entidades.html, lista_internos.html, detalle_interno.html)
referidos/    (panel_referidos.html, comisiones.html, registro_referido.html)
tesoreria/    (panel_tesoreria.html, factura_pdf.html)
usuarios/     (login.html)
```
- **`base.html`** usa **solo topbar** (sin sidebar): agrupa marca, tabs de navegación (Indicadores, Comercial, Contratos, Casos, Internos, Entidades, Tesorería, Referidos, Calendario, Nuevo) y usuario/logout.
- La **ficha de cliente** (`comercial/ficha.html`) es la pantalla clave: banner con `id_comercial` + canal de origen, secciones I Contacto, II Cobro Mixto (anticipo/cronograma de cuotas/Facturar BORRADOR), III Reportes Negativos, IV Documentos, V Datos jurídicos, VI Historial de Actividades (con botón "Agregar actividad" + modal de novedad manual).
- `dashboard/admin.html` **no** muestra tarjetas resumen; solo los reportes/gráficos.

Los templates de tesorería usan un único `panel_tesoreria.html` que muestra distintas secciones según la variable `seccion_activa` del contexto. Los templates de `comercial` usan `_pagination.html` para la paginación.

---

## 6. Roles y permisos

| Rol | Acceso principal |
|---|---|
| `ADMIN` | Todo. Dashboard global. Marca comisiones como pagadas. |
| `COMERCIAL` | Sus clientes/procesos/recaudos. No ve ni edita todo (solo lo asignado). |
| `ABOGADO` | Casos asignados, procesos internos. Lectura en comercial. |
| `COLABORADOR` | Procesos asignados, actuaciones. Dashboard básico. |

El control se hace en cada view (no hay decoradores centralizados salvo `RoleRequiredMixin`). Se usa `@login_required` en todas las views.

---

## 7. Deploy (producción)

Arquitectura: **Nginx → Gunicorn (socket unix) → Django/WSGI → PostgreSQL**.

### Archivos de deploy
- **`deploy.sh`** — script idempotente para VPS (Ubuntu 22.04+, Python 3.13, PostgreSQL 16+). Pasos: instala dependencias del sistema, crea usuario `lexometra`, venv, instala requirements, copia `.env`, collectstatic, migrate, crea superuser, copia `gunicorn.service` y `nginx_lexometra.conf`, reinicia servicios. Requiere llenar `.env` antes de la 2ª ejecución.
- **`gunicorn.conf.py`** — workers = `cpu*2+1`, socket `unix:/run/lexometra.sock`, pidfile `/run/lexometra.pid`, logs en `/var/log/lexometra/`. Configurable vía env (`GUNICORN_BIND/WORKERS/THREADS/LOG_LEVEL`).
- **`gunicorn.service`** — unit de systemd: usuario `lexometra`, `WorkingDirectory=/home/lexometra/lexometra`, `ExecStart` con gunicorn y settings `lexometra_proj.settings`, `Restart=on-failure`, hardening (PrivateTmp, ProtectSystem=full, NoNewPrivileges).
- **`nginx_lexometra.conf`** — upstream por socket unix, HTTP→HTTPS redirect, SSL (Let's Encrypt/certbot), headers de seguridad, servir `/static/` y `/media/` desde `/home/lexometra/lexometra/`, proxy a la app, WebSocket soporte, `client_max_body_size 50M`.

### Rutas del servidor (producción)
```
/home/lexometra/lexometra/        # repo
/home/lexometra/.venv/            # virtualenv
/run/lexometra.sock               # socket gunicorn
/var/log/lexometra/               # logs gunicorn (access.log, error.log)
/var/log/nginx/                   # logs nginx
/etc/systemd/system/lexometra.service
/etc/nginx/sites-available/lexometra  (symlink en sites-enabled)
```

### Flujo de deploy
```bash
sudo bash deploy.sh   # 1ª vez: instala todo y copia .env.example → .env
# editar /home/lexometra/lexometra/.env con valores reales
sudo bash deploy.sh   # 2ª vez: completa el despliegue
sudo certbot --nginx -d <dominio>   # SSL (paso manual)
journalctl -u lexometra -f          # ver logs del servicio
```

---

## 8. Dependencias (`requirements.txt`)
- `Django>=5.1.2,<5.2`
- `gunicorn>=23.0.0`
- `psycopg2-binary>=2.9.9` (PostgreSQL)
- `python-dotenv>=1.0.0`
- `requests>=2.31.0` (integración Factus)
- `weasyprint>=60` (opcional, para PDF; requiere libpango/libcairo/libffi en el SO)

---

## 9. Convenciones y notas importantes para agentes

- **Idioma del código:** comentarios y textos de UI en español; nombres de modelos/choices en inglés/MAYÚSCULAS.
- **Roles:** valores en MAYÚSCULAS (`ADMIN`, `COMERCIAL`, `ABOGADO`, `COLABORADOR`).
- **Estados legales:** `ACTIVO`, `SUSPENDIDO`, `TERMINADO`, `ARCHIVADO`.
- **IDs autogenerados:** `Cliente.id_comercial` = `AAAAMM###`; `ProcesoInterno.codigo_interno` = `PI-AAAAMM-####`; `Factura.numero` = `FAC-AAAAMM-####`.
- **Signals activas:** `procesos/signals.py` (auto-crear caso) y `referidos/signals.py` (comisiones). Se registran en el `ready()` de sus `apps.py`.
- **Factus:** los endpoints en `factus.py` apuntan a **sandbox**. Las credenciales de sandbox están hardcodeadas en `setup_factus.py` (NO son producción). Para producción hay que cambiar URLs y credenciales.
- **WeasyPrint** es opcional: si no está instalado, los generadores de PDF (`generar_contrato`, `exportar_pdf_view`) degradan a una vista HTML.
- **Base de datos:** dev usa sqlite3 (`db.sqlite3`); producción usa PostgreSQL. Los settings detectan el engine por env.
- **No commits de:** `.env`, `db.sqlite3`, `media/`, `staticfiles/`, logs, y las copias locales `nginx_lexometra.conf`/`gunicorn.service` (ver `.gitignore`).
- **Paginación:** las listas usan `Paginator` (50 por página) y el partial `_pagination.html`.
- **ESTADOS_SIN_SALDO** (`comercial/models.py`): constantes a nivel de módulo (no dentro de TextChoices, por error de metaclase). En `save()` de `ReporteNegativo` fuerza saldo=0 y gestión SALDADO si el estado lo exige.

---

## 10. Estado actual / próximos pasos (referencia)
- El proyecto tiene apps funcionales de usuarios, comercial, procesos, referidos y tesorería.
- Facturación electrónica integrada con Factus sandbox.
- Ampliaciones implementadas: navbar unificada (solo topbar), lista global de contratos (`/contratos/`), enlace público de captura por referidor (`/registro/?ref=<pk>`), historial de actividades con novedades manuales (`Actividad`), carga de `archivo` en Entidades, dashboards admin/comercial/colaborador sin tarjetas KPI de resumen (gráficos, vencimientos y listados), y los 18 requisitos del prototipo portados a la ficha/lista comercial.
- Cédula y nombre en la lista comercial (y contratos) abren la ficha completa del cliente.
- Revisión visual/integración opcional de las pantallas nuevas.
- (Este documento debe actualizarse cuando cambie el alcance del proyecto.)
