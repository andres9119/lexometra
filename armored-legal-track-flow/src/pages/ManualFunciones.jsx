import { useState } from "react";
import {
  Briefcase, Users, Award, Landmark, Calendar,
  FileSignature, ClipboardList, Building2, Search, ChevronDown, ChevronRight,
  BookOpen, Layout as LayoutIcon, TrendingUp
} from "lucide-react";
import IndicadoresIcon from "@/components/IndicadoresIcon";
import { Input } from "@/components/ui/input";

const SECCIONES = [
  {
    titulo: "Navegación General",
    icon: LayoutIcon,
    descripcion: "La plataforma se compone de un menú lateral (sidebar) y una barra superior de acceso rápido. Todas las vistas requieren autenticación, excepto el formulario público de referidos.",
    vistas: [
      {
        nombre: "Barra Superior (Toolbar)",
        ruta: "—",
        icon: LayoutIcon,
        funciones: [
          "Accesos rápidos a: Indicadores, Procesos, Comercial, Referidos, Calendario.",
          "Botón destacado 'Nuevo' que abre directamente el formulario de registro de cliente.",
          "Centro de notificaciones (campana) con alertas de menciones, asignaciones y vencimientos.",
          "Indicador del módulo activo."
        ]
      },
      {
        nombre: "Menú Lateral (Sidebar)",
        ruta: "—",
        icon: LayoutIcon,
        funciones: [
          "Navegación principal con 9 módulos: Indicadores, Procesos, Comercial, Referidos, Contabilidad, Calendario, Contratos, Control & Reportes, Directorio Entidades.",
          "Botón 'Cerrar sesión' en la parte inferior.",
          "En móvil se convierte en un menú deslizable (hamburguesa)."
        ]
      }
    ]
  },
  {
    titulo: "Indicadores (Dashboard)",
    icon: IndicadoresIcon,
    descripcion: "Panel principal con métricas estratégicas dividido en dos pestañas: Jurídico y Comercial.",
    vistas: [
      {
        nombre: "Pestaña Jurídico",
        ruta: "/",
        icon: IndicadoresIcon,
        funciones: [
          "Tabla de 'Procesos en Curso' con volumen y participación porcentual por tipo de trámite jurídico (tutela, petición, recurso, etc.).",
          "Gráfico dona con distribución de trámites activos por naturaleza jurídica.",
          "Gráfico 'Avance Procesal' con distribución de expedientes por estado (activo, en trámite, finalizado, archivado).",
          "Suscripción en tiempo real a actuaciones jurídicas para actualización automática."
        ]
      },
      {
        nombre: "Pestaña Comercial",
        ruta: "/",
        icon: IndicadoresIcon,
        funciones: [
          "Tabla 'Pipeline' con clientes agrupados por etapa del proceso comercial (Nuevo, Prospecto, Contactado, Contrato Firmado, etc.).",
          "Conteo de clientes 'Nuevos' (is_new) como primera fila del pipeline.",
          "Columna de Capital Expectativa por etapa y porcentaje del pipeline.",
          "Fila de clientes 'Desistidos' con capital perdido.",
          "Medidor (Gauge) de 'Tasa de Conversión' (contratos firmados / total clientes en pipeline).",
          "Totales de pipeline con suma de clientes y capital."
        ]
      }
    ]
  },
  {
    titulo: "Procesos Jurídicos",
    icon: Briefcase,
    descripcion: "Gestión completa de expedientes jurídicos macro y sus actuaciones.",
    vistas: [
      {
        nombre: "Lista de Procesos",
        ruta: "/processes",
        icon: Briefcase,
        funciones: [
          "Tabla de expedientes con columnas: Proceso/Título, Radicado Interno, Radicado Externo, Tipo, Partes, Juzgado/Entidad, Etapa Actual, Abogado, Prioridad.",
          "Pestañas de estado: Todos, Activo, En Trámite, Finalizado, Archivado (con conteos).",
          "Filtros por tipo de proceso (Tutela, D. Petición, Recurso, Desacato, Reportes Neg., etc.).",
          "Buscador por título de expediente.",
          "Vista alternable entre Lista y Tablero Kanban.",
          "Botón 'Nuevo Proceso' para crear expedientes.",
          "Navegación al detalle de cada expediente."
        ]
      },
      {
        nombre: "Detalle del Proceso",
        ruta: "/process/:id",
        icon: Briefcase,
        funciones: [
          "Encabezado con tipo, estado, prioridad, título y radicado del expediente.",
          "Tarjeta de metadatos: Accionante, Accionado, Juzgado/Entidad, Abogado, Fecha inicio, Próximo vencimiento.",
          "Pestaña 'Actuaciones Jurídicas': lista de actuaciones activas y cerradas con acordeones expandibles.",
          "Cada actuación muestra tipo, juzgado, estado, prioridad, vencimiento, notas y gestor de etapas (ProcessStepper).",
          "Botón 'Nueva Actuación' para registrar tutelas, peticiones, recursos, etc.",
          "Tabla de actuaciones con exportación a Excel y PDF.",
          "Pestaña 'Financiero': movimientos de ingresos y egresos del expediente con totales.",
          "Columna derecha con pestañas 'Actividad' (comentarios y menciones) y 'Documentos' (gestión de archivos).",
          "Edición y eliminación del expediente.",
          "Carga y descarga de documentos del expediente."
        ]
      }
    ]
  },
  {
    titulo: "Comercial",
    icon: Users,
    descripcion: "Gestión de clientes y pipeline comercial.",
    vistas: [
      {
        nombre: "Gestión Comercial",
        ruta: "/commercial",
        icon: Users,
        funciones: [
          "Tabla de clientes con columnas: Cédula, Cliente, Servicio, Estado, Canal (referidor), Fecha de Ingreso, Tiempo transcurrido.",
          "Pestañas dinámicas de estado: Nuevo, Todos, y estados configurados desde ProcessState.",
          "Indicador de tiempo transcurrido con código de color (verde <1h, ámbar <12h, naranja <24h, rojo >72h).",
          "Buscador por nombre, cédula o celular.",
          "Filtro por tipo de servicio.",
          "Contador total de clientes y registros filtrados.",
          "Formulario de creación/edición de clientes.",
          "Navegación al detalle completo del cliente."
        ]
      },
      {
        nombre: "Ficha del Cliente",
        ruta: "/client/:id",
        icon: Users,
        funciones: [
          "Tarjetas KPI: Saldo Pendiente, Facturas, Acuerdos Activos.",
          "Pestaña 'Ficha': datos generales en cuadrícula de 2 columnas (nombre, cédula, contacto, domicilio, referidor).",
          "Sección de Condiciones Especiales con badges semánticos (víctima conflicto, adulto mayor, madre cabeza de familia, etc.).",
          "Sección de Observaciones y datos de DataCrédito/TransUnion.",
          "Botón 'Resumen Cliente' que abre vista imprimible en nueva pestaña.",
          "Pestaña 'Procesos': lista de procesos legales vinculados al cliente.",
          "Pestaña 'Cartera': historial de facturas con totales (facturado, recaudado, por cobrar).",
          "Pestaña 'Acuerdos': acuerdos de pago y créditos activos con cuotas.",
          "Pestaña 'Tesorería': movimientos financieros del cliente con balance neto.",
          "Pestaña 'Actividad': historial de comentarios y acciones del cliente.",
          "Botón 'Editar' en naranja para modificar datos del cliente."
        ]
      },
      {
        nombre: "Resumen del Cliente (Vista Imprimible)",
        ruta: "/client/:id/resumen",
        icon: Users,
        funciones: [
          "Vista standalone optimizada para impresión/PDF.",
          "Bloque I: Información del cliente (nombre, cédula, servicio).",
          "Bloque II: Tabla de reportes negativos en centrales de riesgo con entidad, obligación, estado, gestión, saldo y permanencia negativa.",
          "Bloque III: Estructura de cobro mixto (expectativa, % anticipo, cuotas, honorarios por reporte).",
          "Cronograma de pagos del anticipo cuando hay múltiples cuotas.",
          "Botón 'Imprimir / PDF' con estilos de impresión dedicados."
        ]
      },
      {
        nombre: "Actividad Expandida del Cliente",
        ruta: "/client/:id/actividad",
        icon: Users,
        funciones: [
          "Vista dedicada del historial de actividad del cliente.",
          "Formulario para registrar comentarios con tipo de actividad (comentario, llamada, correo, reunión, documento, pago, estado).",
          "Línea de tiempo cronológica de actividades con iconos por tipo.",
          "Botón de refrescar para actualizar la lista."
        ]
      }
    ]
  },
  {
    titulo: "Referidos y Comisiones",
    icon: Award,
    descripcion: "Gestión de referidores, enlaces de referido y control de comisiones.",
    vistas: [
      {
        nombre: "Referidos",
        ruta: "/referrals",
        icon: Award,
        funciones: [
          "KPIs: Referidores Activos, Total Clientes Referidos, Comisiones sobre Facturas Pagadas.",
          "Tarjetas de referidores expandibles con datos de contacto, banco y cuenta.",
          "Resumen por referidor: clientes referidos, facturado pagado, comisión causada.",
          "Lista de clientes referidos por cada referidor.",
          "Tarjeta de enlace de referido (link compartible).",
          "Botón 'Nuevo Referidor' para registrar referidores.",
          "Edición de datos del referidor.",
          "Pestaña 'Comisiones' con panel completo de pagos."
        ]
      },
      {
        nombre: "Comisiones",
        ruta: "/referrals (pestaña Comisiones)",
        icon: Award,
        funciones: [
          "KPIs globales: referidores activos, total causado, total pagado, pendiente por pagar.",
          "Alerta de referidores con comisiones pendientes.",
          "Filas expandibles por referidor con: base facturada, comisión total, ya pagado, saldo.",
          "Detalle de facturas pagadas por cliente referido con comisión calculada.",
          "Historial de pagos al referidor con método, referencia y comprobante.",
          "Registro de pagos de comisiones con formulario dedicado.",
          "Eliminación de pagos con ajuste automático del saldo.",
          "Ordenamiento prioritario de referidores con saldo pendiente."
        ]
      },
      {
        nombre: "Formulario Público de Referido",
        ruta: "/referral?ref=<id>",
        icon: Award,
        funciones: [
          "Página pública (sin autenticación) para captar clientes referidos.",
          "Formulario con: nombre, cédula, teléfono, correo, ciudad, servicio de interés, descripción del caso.",
          "Validación de campos obligatorios.",
          "Pantalla de confirmación tras envío exitoso.",
          "Detección automática del referidor desde el parámetro URL.",
          "Creación automática del cliente con estado 'Prospecto' y referidor vinculado."
        ]
      }
    ]
  },
  {
    titulo: "Contabilidad (Facturación, Cartera y Tesorería)",
    icon: Landmark,
    descripcion: "Módulo integral de gestión financiera con 5 pestañas.",
    vistas: [
      {
        nombre: "Facturación",
        ruta: "/treasury (pestaña Facturación)",
        icon: Landmark,
        funciones: [
          "KPIs: Total Facturado, Recaudado, Por Cobrar, Facturas Vencidas.",
          "Tabla de facturas con: No. Factura, Cliente, Concepto, Emisión, Vencimiento, Total, Pagado, Saldo, Estado.",
          "Filtros por estado (Borrador, Emitida, Pago Parcial, Vencida, Pagada, Anulada).",
          "Buscador por cliente o número de factura.",
          "Botón 'Cobrar Saldo' para facturas con pago parcial.",
          "Creación y edición de facturas con líneas de cobro detalladas (honorarios, cuota litis, gastos reembolsables).",
          "Eliminación de facturas.",
          "Resaltado en rojo de vencimientos vencidos."
        ]
      },
      {
        nombre: "Cartera",
        ruta: "/treasury (pestaña Cartera)",
        icon: Landmark,
        funciones: [
          "KPIs: Clientes con Saldo, Total Cartera Activa, Facturas Vencidas.",
          "Tabla de cartera vigente agrupada por cliente con saldo pendiente.",
          "Columnas: Cliente, Cédula, Servicio, Valor Pactado, Saldo Pendiente, % Recaudo, Estado, Acción.",
          "Barra de progreso visual de porcentaje recaudado por cliente.",
          "Botón 'Acuerdo' para crear acuerdos de pago desde la cartera.",
          "Estado de cuenta de cliente (modal con detalle de movimientos).",
          "Totales de cartera al pie de la tabla."
        ]
      },
      {
        nombre: "Tesorería",
        ruta: "/treasury (pestaña Tesorería)",
        icon: Landmark,
        funciones: [
          "KPIs: Total Ingresos, Total Egresos, Balance Neto, Movimientos totales.",
          "KPIs por billetera: Cuenta de la Firma (balance, ingresos/egresos) y Fondo de Terceros (recibido/entregado).",
          "Tabla de movimientos con: Fecha, Tipo (Ingreso/Egreso), Billetera, Categoría, Concepto, Cliente, Método, Referencia, Monto.",
          "Filtros por billetera (Firma, Terceros, Todas).",
          "Buscador de movimientos.",
          "Exportación a CSV de movimientos filtrados.",
          "Registro de ingresos y egresos con comprobante adjunto.",
          "Eliminación de movimientos.",
          "Balance del período al pie de la tabla."
        ]
      },
      {
        nombre: "Reportes Financieros",
        ruta: "/treasury (pestaña Reportes)",
        icon: Landmark,
        funciones: [
          "Filtro por rango de fechas (desde/hasta).",
          "KPIs del período: Facturado, Recaudado, Por Cobrar, Balance Tesorería.",
          "Gráfico de barras 'Flujo de Caja — Últimos 6 Meses' (ingresos vs egresos).",
          "Gráfico de línea 'Balance Acumulado' de 6 meses.",
          "Gráfico dona 'Efectividad — Reportes Negativos' con tasa de eliminación.",
          "Gráfico de barras horizontales 'Pipeline Comercial — Clientes por Estado'.",
          "Exportación CSV del flujo de caja."
        ]
      },
      {
        nombre: "Notas de Crédito y Débito",
        ruta: "/treasury (pestaña Notas C/D)",
        icon: Landmark,
        funciones: [
          "KPIs: Notas de Crédito emitidas, Total Créditos, Total Débitos.",
          "Tabla de notas con: Fecha, Tipo (Nota Crédito/Nota Débito), Cliente, Factura Afectada, Valor, Motivo del Ajuste, Creado por.",
          "Creación de notas de crédito (reducen deuda) y débito (aumentan deuda).",
          "Registro de motivo obligatorio del ajuste contable.",
          "Auditoría del usuario creador."
        ]
      }
    ]
  },
  {
    titulo: "Financiamiento",
    icon: Landmark,
    descripcion: "Gestión de créditos y acuerdos de pago con tablas de amortización.",
    vistas: [
      {
        nombre: "Créditos y Acuerdos de Pago",
        ruta: "/financing",
        icon: Landmark,
        funciones: [
          "Pestañas: Créditos y Acuerdos de Pago con conteos.",
          "KPIs: Total Registros, Activos, Capital Total, Intereses Totales.",
          "Tarjetas expandibles por acuerdo con: capital, tasa de interés, total con interés, cuotas, valor cuota, pagadas.",
          "Barra de progreso de pago por acuerdo.",
          "Tabla de cuotas con: No., Vencimiento, Capital, Interés, Cuota, Saldo, Estado, Acción.",
          "Botón 'Pagar' para marcar cuotas como pagadas.",
          "Generación de PDF del acuerdo de pago con tabla de amortización.",
          "Eliminación de acuerdos.",
          "Creación de nuevos créditos y acuerdos con cálculo automático de amortización."
        ]
      }
    ]
  },
  {
    titulo: "Calendario",
    icon: Calendar,
    descripcion: "Vista mensual de vencimientos y etapas procesales.",
    vistas: [
      {
        nombre: "Calendario de Vencimientos",
        ruta: "/calendar",
        icon: Calendar,
        funciones: [
          "Vista de calendario mensual con navegación entre meses.",
          "Eventos de vencimiento de procesos (next_deadline) con código de color por tipo.",
          "Eventos de etapas procesales (ProcessStage) programadas.",
          "Enlaces directos al detalle del proceso desde el calendario.",
          "Resaltado del día actual.",
          "Conteo de eventos adicionales (+N) cuando exceden el espacio visible."
        ]
      }
    ]
  },
  {
    titulo: "Contratos",
    icon: FileSignature,
    descripcion: "Gestión de plantillas, generación y almacenamiento de documentos legales.",
    vistas: [
      {
        nombre: "Documentos Generados",
        ruta: "/contracts",
        icon: FileSignature,
        funciones: [
          "Tabla de documentos generados con: Fecha, Cliente, CC, Plantilla, Estado, Acciones.",
          "Estados: Borrador, Revisado, Formalizado con badges de color.",
          "Buscador por cliente o plantilla.",
          "Vista previa de documentos en modal.",
          "Impresión/PDF de documentos generados.",
          "Eliminación de documentos.",
          "Accesos a Plantillas y Nuevo Documento."
        ]
      },
      {
        nombre: "Plantillas de Documentos",
        ruta: "/contracts/templates",
        icon: FileSignature,
        funciones: [
          "Galería de plantillas en tarjetas con nombre, tipo y estado (Activa/Inactiva).",
          "Tipos: Contrato de Servicios, Acuerdo de Pago, Tutela, SIC, Otro.",
          "Creación y edición de plantillas con editor enriquecido (ReactQuill) o modo HTML.",
          "Importación de documentos Word (.docx/.doc) con conversión automática a HTML mediante IA.",
          "Detección automática de campos variables del cliente al importar Word.",
          "Marcadores disponibles: {{NOMBRE_CLIENTE}}, {{CEDULA}}, {{TELEFONO}}, {{EMAIL}}, {{CIUDAD}}, {{VALOR_PACTADO}}, {{SALDO_PENDIENTE}}, {{FECHA_CONTRATO}}, {{SERVICIO}}, {{REFERIDO_POR}}, {{FECHA_HOY}}.",
          "Plantillas por defecto precargadas para contratos y acuerdos.",
          "Vista previa de plantillas.",
          "Eliminación de plantillas."
        ]
      },
      {
        nombre: "Generador de Documentos",
        ruta: "/contracts/new",
        icon: FileSignature,
        funciones: [
          "Flujo de 3 pasos: 1) Seleccionar plantilla, 2) Seleccionar cliente, 3) Revisar y editar.",
          "Relleno automático de marcadores con datos del cliente seleccionado.",
          "Editor HTML en línea (contentEditable) que preserva tablas y formato.",
          "Estados del documento: Borrador → Revisado → Formalizado.",
          "Botones: Vista previa, Imprimir, Revisar, Formalizar.",
          "Guardado de borradores con actualización posterior.",
          "Notas internas (no aparecen en el documento final).",
          "Panel lateral con búsqueda de cliente por nombre o cédula.",
          "Confirmación visual de cliente seleccionado."
        ]
      }
    ]
  },
  {
    titulo: "Control & Reportes",
    icon: ClipboardList,
    descripcion: "Centro de control de actuaciones jurídicas con exportación.",
    vistas: [
      {
        nombre: "Centro de Control · Reportes",
        ruta: "/reportes",
        icon: ClipboardList,
        funciones: [
          "Tabla consolidada de actuaciones jurídicas activas y en trámite.",
          "Columnas: Cliente/Expediente, Tipo Actuación, Entidad/Juzgado, Radicado, Última Etapa, Vencimiento, Abogado, Estado.",
          "Filtros: buscador de texto, abogado, tipo de actuación, rango de fechas de vencimiento.",
          "Indicadores de vencimiento con color: rojo (vencido), ámbar (<7 días), verde (vigente).",
          "Avatar con iniciales del abogado asignado.",
          "Exportación a Excel con formato profesional.",
          "Exportación a PDF con tablas paginadas.",
          "Botón 'Limpiar filtros' para resetear todos los criterios.",
          "Conteo de actuaciones mostradas al pie de la tabla."
        ]
      }
    ]
  },
  {
    titulo: "Directorio de Entidades",
    icon: Building2,
    descripcion: "Base de datos de entidades financieras y juzgados.",
    vistas: [
      {
        nombre: "Directorio de Entidades",
        ruta: "/directorio-entidades",
        icon: Building2,
        funciones: [
          "Tabla de entidades con: Razón Social, NIT, Complejidad, Correo, Notas, Fecha de Registro.",
          "Sistema de calificación de complejidad (1-5 estrellas) con etiquetas: Baja, Media-Baja, Media, Alta, Muy Alta.",
          "Lista de correos de contacto por entidad.",
          "Buscador por nombre o NIT.",
          "Creación de nuevas entidades con modal dedicado.",
          "Edición de entidades existentes.",
          "Eliminación con confirmación.",
          "Contador total de registros."
        ]
      }
    ]
  },
  {
    titulo: "Panel Administrador",
    icon: ClipboardList,
    descripcion: "Configuración avanzada de estados y automatizaciones.",
    vistas: [
      {
        nombre: "Administración de Estados",
        ruta: "/admin/states",
        icon: ClipboardList,
        funciones: [
          "Gestión CRUD de estados de proceso (ProcessState).",
          "Configuración de: nombre, nombre a mostrar, color, orden, estado terminal, estado activo.",
          "Definición de transiciones permitidas entre estados (allowed_transitions).",
          "Pestaña 'Documentación' con estructura del JSON de webhook para integraciones.",
          "Ejemplo de payload de webhook con datos de cliente, proceso y metadatos personalizados.",
          "Notas de integración para Power Automate/Zapier."
        ]
      },
      {
        nombre: "Resoluciones de Facturación",
        ruta: "/billing-resolutions",
        icon: ClipboardList,
        funciones: [
          "Gestión de resoluciones DIAN con: prefijo, rango de consecutivos, último emitido, vencimiento.",
          "Tarjetas de resolución con barra de progreso de uso de consecutivos.",
          "Alertas visuales: límite alcanzado (rojo), cerca del límite 90%+ (ámbar).",
          "Activación/desactivación de resoluciones.",
          "Alerta global si no hay resolución activa.",
          "Conteo de consecutivos disponibles.",
          "Creación y edición de resoluciones."
        ]
      }
    ]
  }
];

export default function ManualFunciones() {
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const filteredSecciones = SECCIONES.map(sec => ({
    ...sec,
    vistas: sec.vistas.filter(v =>
      !search ||
      v.nombre.toLowerCase().includes(search.toLowerCase()) ||
      v.funciones.some(f => f.toLowerCase().includes(search.toLowerCase()))
    )
  })).filter(sec =>
    !search ||
    sec.titulo.toLowerCase().includes(search.toLowerCase()) ||
    sec.vistas.length > 0
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">MANUAL DE FUNCIONES</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
        {/* Intro */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h1 className="text-xl font-bold text-slate-800 mb-1">Manual de Funciones por Vista</h1>
          <p className="text-sm text-slate-500">
            Documentación de las funciones y características de cada módulo de la plataforma de gestión jurídica.
            Usa el buscador para encontrar funciones específicas o expande cada sección para ver el detalle.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar función o vista..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Sections */}
        {filteredSecciones.map((sec, sIdx) => {
          const isExpanded = expandedSections[sIdx] || !!search;
          const Icon = sec.icon;
          return (
            <div key={sIdx} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(sIdx)}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-slate-50/60 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{sec.titulo}</h2>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{sec.descripcion}</p>
                </div>
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {sec.vistas.map((vista, vIdx) => {
                    const VIcon = vista.icon;
                    return (
                      <div key={vIdx} className="border border-slate-100 rounded-lg overflow-hidden">
                        {/* View header */}
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50/40 border-b border-slate-100">
                          <VIcon className="h-4 w-4 text-slate-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-slate-700">{vista.nombre}</h3>
                            <code className="text-[10px] text-slate-400 font-mono">{vista.ruta}</code>
                          </div>
                        </div>
                        {/* Functions list */}
                        <ul className="p-4 space-y-1.5">
                          {vista.funciones.map((func, fIdx) => (
                            <li key={fIdx} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                              <span>{func}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredSecciones.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No se encontraron resultados para "{search}"</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4">
          Sinapsis · Módulo Integral de Gestión Jurídica · Manual de Funciones
        </div>
      </div>
    </div>
  );
}