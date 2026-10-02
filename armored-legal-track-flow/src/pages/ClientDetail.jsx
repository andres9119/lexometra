import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Edit, Plus, Trash2, MessageSquare, Phone, Mail, FileText,
  CheckCircle2, AlertCircle, CreditCard, User, Landmark, Scale, TrendingUp,
  TrendingDown, ChevronRight, Receipt, Save, ShieldAlert, MapPin, Pencil, X,
  History, ArrowRight, Check, XCircle, Eye, EyeOff, Copy, ClipboardCheck, Settings, Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ClientForm from "@/components/ClientForm";
import NegativeReportForm from "@/components/NegativeReportForm";
import CreditAgreementForm from "@/components/CreditAgreementForm";
import ProcessAdvanceForm from "@/components/ProcessAdvanceForm";
import CondicionesEspeciales from "@/components/CondicionesEspeciales";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useObligationStatuses } from "@/hooks/useObligationStatuses";
import FichaTab from "@/components/FichaTab";
import ClientResumenModal from "@/components/ClientResumenModal";

const fmt = (n) => n != null ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n) : "—";
const fmtDate = (d) => { try { return format(new Date(d), "dd MMM yyyy", { locale: es }); } catch { return d || "—"; } };
const fmtDateTime = (d) => { try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: es }); } catch { return d; } };

const STATUS_CONFIG = {
  prospecto:         { label: "Prospecto",         color: "bg-slate-100 text-slate-600",    semaphore: "bg-slate-400" },
  contactado:        { label: "Contactado",         color: "bg-sky-100 text-sky-700",        semaphore: "bg-sky-400" },
  contrato_firmado:  { label: "Contrato Firmado",   color: "bg-violet-100 text-violet-700",  semaphore: "bg-emerald-500" },
  peticion_radicada: { label: "Petición Radicada",  color: "bg-amber-100 text-amber-700",    semaphore: "bg-amber-400" },
  en_tramite:        { label: "En Trámite",          color: "bg-orange-100 text-orange-700",  semaphore: "bg-orange-400" },
  finalizado:        { label: "Finalizado",          color: "bg-emerald-100 text-emerald-700",semaphore: "bg-emerald-500" },
  perdido:           { label: "Perdido",             color: "bg-red-100 text-red-600",        semaphore: "bg-red-500" },
};

const OBLIGATION_STATUS_LABELS = {
  MORA: "Mora", DUDOSO_RECAUDO: "Dudoso recaudo", CARTERA_CASTIGADA: "Cartera castigada",
  SALDADO: "Saldado", INACTIVA: "Inactiva", CAN_MAL_MANEJO: "Can. mal manejo",
  PAGO_VOL: "Pago vol.", PAGO_VOL_MX: "Pago vol. mx-xx", PAGO_JUR: "Pago jur.",
  LIQ_PAT: "Liq pat", CAN_PRESCR: "Can prescr", CAN_VOL: "Can vol.",
  CAN_VOL_MM: "Can vol. -mm-mx-xx", T_EXTRAVIADA: "T.extraviada", NO_ENTREG: "No entreg.",
  TARJETA_NO_RENOVADA: "Tarjeta no renovada", T_ROBADA: "T. robada",
  REESTRUCTURADA: "Reestructurada", REFINANCIADA: "Refinanciada",
  TRANSF_PRODUCTO: "Transf.producto", NORMAL: "Normal", COMPRADA: "Comprada", OTRO: "Otro",
};

const OBLIGATION_STATUS_COLOR = {
  MORA: "bg-red-100 text-red-700", DUDOSO_RECAUDO: "bg-orange-100 text-orange-700",
  CARTERA_CASTIGADA: "bg-rose-100 text-rose-700", SALDADO: "bg-emerald-100 text-emerald-700",
  INACTIVA: "bg-slate-100 text-slate-500", NORMAL: "bg-sky-100 text-sky-700",
  PAGO_VOL: "bg-teal-100 text-teal-700", PAGO_JUR: "bg-teal-100 text-teal-700",
  REESTRUCTURADA: "bg-amber-100 text-amber-700", REFINANCIADA: "bg-amber-100 text-amber-700",
};

const PROGRESS_CONFIG = {
  pendiente:   { label: "Pendiente",   color: "bg-slate-100 text-slate-600",    dot: "bg-slate-400" },
  en_gestion:  { label: "En Gestión",  color: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
  eliminado:   { label: "Eliminado",   color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  actualizado: { label: "Actualizado", color: "bg-sky-100 text-sky-700",         dot: "bg-sky-500" },
};

const SERVICE_LABELS = {
  eliminacion_reportes: "Eliminación de Reportes",
  tutela: "Acción de Tutela", sic: "Proceso SIC", cartera: "Gestión de Cartera", otro: "Otro",
};
const ACTIVITY_ICONS = { comentario: MessageSquare, llamada: Phone, correo: Mail, documento: FileText, pago: CheckCircle2, estado: AlertCircle, reunion: MessageSquare };
const INV_STATUS = {
  pendiente: { label: "Pendiente",    color: "bg-amber-100 text-amber-700" },
  parcial:   { label: "Pago Parcial", color: "bg-orange-100 text-orange-700" },
  pagada:    { label: "Pagada",       color: "bg-emerald-100 text-emerald-700" },
  vencida:   { label: "Vencida",      color: "bg-red-100 text-red-700" },
  anulada:   { label: "Anulada",      color: "bg-slate-100 text-slate-500" },
};
const PROCESS_STATUS = {
  activo:     { label: "Activo",     color: "bg-blue-100 text-blue-700" },
  en_tramite: { label: "En Trámite", color: "bg-amber-100 text-amber-700" },
  finalizado: { label: "Finalizado", color: "bg-emerald-100 text-emerald-700" },
  archivado:  { label: "Archivado",  color: "bg-slate-100 text-slate-500" },
};
const AG_STATUS_COLOR = { activo: "bg-emerald-100 text-emerald-700", completado: "bg-blue-100 text-blue-700" };
const YNA_COLORS = { si: "text-emerald-600 font-semibold", no: "text-rose-500", na: "text-slate-400" };

export default function ClientDetail() {
  const { id } = useParams();
  const { getLabel: getObligationLabel } = useObligationStatuses();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const [tab, setTab] = useState(urlParams.get("tab") || "ficha");
  const [showEdit, setShowEdit] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [editingReportId, setEditingReportId] = useState(null);
  const [editingFinancial, setEditingFinancial] = useState(false); // starts in read mode
  const [scoreEdits, setScoreEdits] = useState({});
  const [keyEdits, setKeyEdits] = useState({});
  const [condEdits, setCondEdits] = useState({});
  const [editingCobro, setEditingCobro] = useState(false);
  const [cobroForm, setCobroForm] = useState({});
  const [visibleKeys, setVisibleKeys] = useState({});
  const [copiedKeys, setCopiedKeys] = useState({});
  const [creditType, setCreditType] = useState("acuerdo_pago");
  const [newComment, setNewComment] = useState("");
  const [activityType, setActivityType] = useState("comentario");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [expandedReports, setExpandedReports] = useState({});
  const [visitedTabs, setVisitedTabs] = useState(new Set(["ficha"]));


  const handleTabChange = (tabId) => {
    setTab(tabId);
    setVisitedTabs(prev => new Set([...prev, tabId]));
  };

  const { data: currentUser } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === "admin";
  const { data: client, isLoading } = useQuery({ queryKey: ["client", id], queryFn: () => base44.entities.Client.get(id) });
  const { data: reports = [] } = useQuery({ queryKey: ["reports", id], queryFn: () => base44.entities.ClientNegativeReport.filter({ client_id: id }) });

  // Auto-expand terminal status reports when they load
  useEffect(() => {
    if (reports.length > 0) {
      setExpandedReports(prev => {
        const next = { ...prev };
        reports.forEach(r => {
          if ((r.status === "eliminado_exito" || r.status === "inviable") && !(r.id in prev)) {
            next[r.id] = true;
          }
        });
        return next;
      });
    }
  }, [reports]);

  const { data: activities = [] } = useQuery({ queryKey: ["activities", id], queryFn: () => base44.entities.ClientActivity.filter({ client_id: id }, "-created_date") });
  const { data: allInvoices = [], isLoading: loadingInvoices } = useQuery({ queryKey: ["invoices_all"], queryFn: () => base44.entities.Invoice.list("-created_date"), enabled: visitedTabs.has("cartera") });
  const { data: allProcesses = [], isLoading: loadingProcesses } = useQuery({ queryKey: ["processes_all"], queryFn: () => base44.entities.Process.list("-created_date"), enabled: visitedTabs.has("procesos") });
  const { data: allAgreements = [], isLoading: loadingAgreements } = useQuery({ queryKey: ["agreements_all"], queryFn: () => base44.entities.CreditAgreement.list("-created_date"), enabled: visitedTabs.has("acuerdos") });
  const { data: allTransactions = [], isLoading: loadingTransactions } = useQuery({ queryKey: ["treasury_tx"], queryFn: () => base44.entities.TreasuryTransaction.list("-date"), enabled: visitedTabs.has("tesoreria") });
  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({ queryKey: ["audit", id], queryFn: () => base44.entities.ClientAuditLog.filter({ client_id: id }, "-created_date", 200), enabled: visitedTabs.has("bitacora") });
  const { data: processStates = [] } = useQuery({ queryKey: ["process_states"], queryFn: () => base44.functions.invoke('getActiveProcessStates', {}).then(res => res.data.states || []) });

  const addActivity = useMutation({
    mutationFn: (d) => base44.entities.ClientActivity.create({ ...d, client_id: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities", id] }); setNewComment(""); toast.success("Actividad registrada"); },
  });
  const deleteReport = useMutation({
    mutationFn: (rid) => base44.entities.ClientNegativeReport.delete(rid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports", id] }),
  });
  const updateReport = useMutation({
    mutationFn: ({ rid, data }) => base44.entities.ClientNegativeReport.update(rid, data),
    onSuccess: (_, { data }) => {
      qc.invalidateQueries({ queryKey: ["reports", id] });
      setEditingReportId(null);
      if (data.status === "eliminado" || data.status === "actualizado") {
        toast.success("✅ Reporte " + (data.status === "eliminado" ? "eliminado" : "actualizado") + " — Solicitud enviada al área de facturación");
        base44.entities.ClientActivity.create({ client_id: id, comment: "Reporte marcado como " + data.status + " — Se generó solicitud de facturación proporcional", activity_type: "estado" });
        qc.invalidateQueries({ queryKey: ["activities", id] });
      } else {
        toast.success("Avance actualizado");
      }
    },
  });
  const updateClientField = useMutation({
    mutationFn: async ({ fields, oldValues }) => {
      const result = await base44.entities.Client.update(id, { ...fields });
      // Log each changed field
      if (oldValues && currentUser) {
        for (const [key, newVal] of Object.entries(fields)) {
          const FIELD_LABELS_LOCAL = {
            phone: "Celular", full_name: "Nombre", email: "Correo", cc: "Cédula",
            address: "Dirección", neighborhood: "Barrio", city: "Ciudad",
            department: "Departamento", vereda: "Vereda", jurisdiction: "Jurisdicción",
            agreed_value: "Valor pactado", pending_balance: "Saldo pendiente",
            datacredito_key: "Clave DataCrédito", transunion_key: "Clave TransUnion",
            score_data: "Score DataCrédito", score_transunion: "Score TransUnion",
            notes: "Observaciones", contract_date: "Fecha contrato",
            victim_conflict: "Víctima del conflicto", indigenous: "Indígena",
            elderly: "Adulto mayor", psychological_impact: "Afectación psicológica",
            single_mother: "Madre cabeza de familia",
          };
          const label = FIELD_LABELS_LOCAL[key] || key;
          const oldVal = oldValues[key] ?? "—";
          const newValStr = newVal ?? "—";
          base44.entities.ClientAuditLog.create({
            client_id: id,
            entity_type: "Client",
            entity_id: id,
            action: "update",
            field_name: key,
            field_label: label,
            old_value: String(oldVal),
            new_value: String(newValStr),
            user_name: currentUser.full_name || currentUser.email || "Usuario",
            user_id: currentUser.id,
            summary: `Perfil › ${label}: ${oldVal} ——→ ${newValStr}`,
          });
        }
        qc.invalidateQueries({ queryKey: ["audit", id] });
      }
      return result;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Guardado");
      if (variables?.closeCobroOnSuccess) setEditingCobro(false);
    },
  });
  const updateStatus = useMutation({
    mutationFn: async (status) => {
      const result = await base44.entities.Client.update(id, { status, is_new: false });
      if (currentUser && client) {
        base44.entities.ClientAuditLog.create({
          client_id: id, entity_type: "Client", entity_id: id, action: "update",
          field_name: "status", field_label: "Estado",
          old_value: client.status, new_value: status,
          user_name: currentUser.full_name || currentUser.email || "Usuario",
          user_id: currentUser.id,
          summary: `Estado cambiado: ${client.status} ——→ ${status}`,
        });
        qc.invalidateQueries({ queryKey: ["audit", id] });
      }
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["client", id] }); qc.invalidateQueries({ queryKey: ["clients"] }); toast.success("Estado actualizado"); },
  });
  const deleteClient = useMutation({
    mutationFn: () => base44.entities.Client.delete(id),
    onSuccess: () => { toast.success("Cliente eliminado"); navigate("/commercial"); },
  });
  const reverseReport = useMutation({
    mutationFn: r => base44.entities.ClientNegativeReport.update(r.id, { status: "pendiente" }),
    onSuccess: () => { toast.success("Estado revertido a pendiente"); qc.invalidateQueries({ queryKey: ["reports", id] }); }
  });

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>;
  if (!client) return <div className="p-8 text-center text-muted-foreground">Cliente no encontrado</div>;

  const st = STATUS_CONFIG[client.status] || STATUS_CONFIG.prospecto;
  const cc = client.cc?.trim();
  const nombre = client.full_name?.toLowerCase().trim();

  const clientInvoices = allInvoices.filter(inv =>
    (cc && inv.client_cc?.trim() === cc) ||
    inv.client_id === id ||
    inv.client_name?.toLowerCase().trim() === nombre
  );
  const clientProcesses = allProcesses.filter(p =>
    p.plaintiff?.toLowerCase().includes(nombre) ||
    p.defendant?.toLowerCase().includes(nombre)
  );
  const clientAgreements = allAgreements.filter(ag =>
    ag.client_id === id ||
    (cc && ag.client_cc?.trim() === cc) ||
    ag.client_name?.toLowerCase().trim() === nombre
  );
  const clientTransactions = allTransactions.filter(tx =>
    tx.client_name?.toLowerCase().trim() === nombre
  );

  const totalInv = clientInvoices.filter(i => i.status !== "anulada").reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = clientInvoices.filter(i => i.status !== "anulada").reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalPending = totalInv - totalPaid;
  const activeAgreements = clientAgreements.filter(a => a.status === "activo");
  const totalAgreementValue = clientAgreements.reduce((s, a) => s + (a.total_amount || 0), 0);
  const txIn = clientTransactions.filter(t => t.type === "ingreso").reduce((s, t) => s + (t.amount || 0), 0);
  const txOut = clientTransactions.filter(t => t.type === "egreso").reduce((s, t) => s + (t.amount || 0), 0);

  const eliminatedReports = reports.filter(r => r.status === "eliminado_exito").length;
  const totalReports = reports.length;

  const TABS = [
    { id: "ficha",     label: "Ficha",                                     icon: User },
    { id: "procesos",  label: "Procesos (" + clientProcesses.length + ")", icon: Scale },
    { id: "actividad", label: "Actividad (" + activities.length + ")",     icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: "#F7F7F8" }}>
      {/* Top action bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <Link to="/commercial">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex gap-2 shrink-0 items-center">
          <Select value={client.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="h-8 text-xs w-44 bg-white border-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {processStates.length > 0 ? (() => {
                const currentState = processStates.find(s => s.name === client.status);
                const allowedTransitions = currentState?.allowed_transitions || [];
                const visibleStates = processStates.filter(s =>
                  s.name === client.status || allowedTransitions.length === 0 || allowedTransitions.includes(s.name)
                );
                return visibleStates.map(state => (
                  <SelectItem key={state.id} value={state.name} style={{ backgroundColor: state.color + '10' }}>
                    {state.display_name}
                  </SelectItem>
                ));
              })() : (
                Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)
              )}
            </SelectContent>
          </Select>
          <Link to="/admin/states" title="Configurar estados">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Button size="sm" className="h-8 text-xs text-white" style={{ background: "#141743" }} onClick={() => setShowEdit(true)}>
            <Edit className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* Client name + cédula */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <h1 className="text-[22px] font-bold leading-tight" style={{ color: "#141743" }}>{client.full_name}</h1>
        <p className="text-sm text-slate-400 mt-0.5">CC {cc} · {SERVICE_LABELS[client.service_type]}</p>
      </div>

      {/* Pill navigation */}
      <div className="px-5 pb-4 shrink-0">
        <div className="flex gap-2 flex-wrap">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={"flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap " +
                  (active ? "text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50")}
                style={active ? { background: "#141743" } : {}}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert / progress card */}
      {totalReports > 0 && (
        <div className="px-5 pb-4 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: eliminatedReports === totalReports ? "#E8F5E9" : "#FFF3E0" }}>
                <CheckCircle2 className={"h-5 w-5 " + (eliminatedReports === totalReports ? "text-emerald-600" : "text-amber-500")} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "#141743" }}>
                  {eliminatedReports} de {totalReports} reportes eliminados
                </p>
                <p className="text-xs text-slate-400">
                  {totalReports - eliminatedReports > 0 ? "Continúa gestionando los reportes restantes" : "¡Todos los reportes han sido eliminados!"}
                </p>
              </div>
            </div>
            <div className="relative h-12 w-12 shrink-0 ml-3">
              <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={eliminatedReports === totalReports ? "#27AE60" : "#F59E0B"} strokeWidth="3"
                  strokeDasharray={`${(eliminatedReports / totalReports) * 94.2} 94.2`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color: "#141743" }}>
                {eliminatedReports}/{totalReports}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-3 px-5 pb-4 shrink-0">
        {[
          { label: "Saldo Pendiente", value: visitedTabs.has("cartera") ? fmt(totalPending) : fmt(client.pending_balance), icon: TrendingDown, bg: "bg-amber-50", color: "text-amber-600" },
          { label: "Facturas", value: visitedTabs.has("cartera") ? (clientInvoices.length || 0) : 0, icon: FileText, bg: "bg-blue-50", color: "text-blue-600" },
          { label: "Acuerdos Activos", value: visitedTabs.has("acuerdos") ? (activeAgreements.length || 0) : 0, icon: CreditCard, bg: "bg-violet-50", color: "text-violet-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className={"h-7 w-7 rounded-lg flex items-center justify-center mb-2 " + s.bg}>
              <s.icon className={"h-4 w-4 " + s.color} />
            </div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: "#141743" }}>
              {typeof s.value === 'number' ? (s.value === 0 ? <span className="text-slate-300">0</span> : s.value) : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">

        {/* ===== FICHA ===== */}
        {tab === "ficha" && (
          <div className="relative">
            <div className="absolute top-3 right-3 z-10 no-print">
              <button
                onClick={() => window.open(`/client/${id}/resumen`, "_blank")}
                className="flex items-center gap-1.5 text-xs text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1 shadow-sm"
              >
                <Printer className="h-3.5 w-3.5" /> Resumen Cliente
              </button>
            </div>
          <FichaTab
            client={client}
            reports={reports}
            getObligationLabel={getObligationLabel}
            editingCobro={editingCobro}
            cobroForm={cobroForm}
            setCobroForm={setCobroForm}
            onEditCobro={() => {
              const cuotas = client.anticipo_cuotas ?? 1;
              const existingDates = client.anticipo_dates ?? [];
              setCobroForm({
                valor_expectativa_total: client.valor_expectativa_total ?? "",
                porcentaje_anticipo: client.porcentaje_anticipo ?? 0.5,
                total_reportes_objetivo: client.total_reportes_objetivo ?? "",
                anticipo_cuotas: cuotas,
                anticipo_dates: Array.from({ length: cuotas }, (_, i) => existingDates[i] || ""),
              });
              setEditingCobro(true);
            }}
            onSaveCobro={() => {
              const cuotas = parseInt(cobroForm.anticipo_cuotas) || 1;
              const dates = cobroForm.anticipo_dates || [];
              const missingDates = Array.from({ length: cuotas }, (_, i) => dates[i] || "").some(d => !d);
              if (missingDates) {
                toast.error("Completa todas las fechas de vencimiento del anticipo antes de guardar");
                return;
              }
              updateClientField.mutate({
                fields: {
                  valor_expectativa_total: parseFloat(cobroForm.valor_expectativa_total) || 0,
                  porcentaje_anticipo: parseFloat(cobroForm.porcentaje_anticipo),
                  total_reportes_objetivo: parseInt(cobroForm.total_reportes_objetivo) || 0,
                  anticipo_cuotas: cuotas,
                  anticipo_dates: Array.from({ length: cuotas }, (_, i) => dates[i] || ""),
                },
                oldValues: {
                  valor_expectativa_total: client.valor_expectativa_total,
                  porcentaje_anticipo: client.porcentaje_anticipo,
                  total_reportes_objetivo: client.total_reportes_objetivo,
                  anticipo_cuotas: client.anticipo_cuotas,
                  anticipo_dates: client.anticipo_dates,
                },
                closeCobroOnSuccess: true,
              });
            }}
            onCancelCobro={() => setEditingCobro(false)}
            isCobroPending={updateClientField.isPending}
            editingFinancial={editingFinancial}
            setEditingFinancial={setEditingFinancial}
            keyEdits={keyEdits}
            setKeyEdits={setKeyEdits}
            scoreEdits={scoreEdits}
            setScoreEdits={setScoreEdits}
            onUpdateField={(args) => updateClientField.mutate(args)}
            onAddReport={() => setShowReportForm(true)}
            onEditReport={(r) => setEditingReport(r)}
            onAdvanceReport={(r) => { setSelectedReport(r); setShowAdvanceModal(true); }}
            onDeleteReport={(rid) => deleteReport.mutate(rid)}
            onReverseReport={(r) => reverseReport.mutate(r)}
          />
          </div>
        )}

        {/* ===== PROCESOS ===== */}
        {tab === "procesos" && loadingProcesses && <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>}
        {tab === "procesos" && !loadingProcesses && (
          <div className="p-5">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Procesos Legales — CC {cc}</span>
              </div>
              {clientProcesses.length === 0 ? (
                <div className="py-14 text-center text-muted-foreground text-sm">
                  <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No se encontraron procesos asociados a este cliente
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">Radicado</th>
                        <th className="px-4 py-2.5 text-left">Título</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-left">Rol</th>
                        <th className="px-4 py-2.5 text-left">Juzgado / Entidad</th>
                        <th className="px-4 py-2.5 text-left">Estado</th>
                        <th className="px-4 py-2.5 text-left">Próx. Vencimiento</th>
                        <th className="px-4 py-2.5 text-center">Ver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientProcesses.map((p, idx) => {
                        const pSt = PROCESS_STATUS[p.status] || PROCESS_STATUS.activo;
                        const isPlaintiff = p.plaintiff?.toLowerCase().includes(nombre);
                        const overdue = p.next_deadline && differenceInDays(parseISO(p.next_deadline), new Date()) < 0;
                        const rowClass = "border-t border-border/50 hover:bg-secondary/40 transition-colors " + (idx % 2 !== 0 ? "bg-muted/10" : "");
                        const deadlineClass = "px-4 py-2.5 font-mono text-[11px] " + (overdue ? "text-red-600 font-bold" : "");
                        return (
                          <tr key={p.id} className={rowClass}>
                            <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-primary">{p.case_number || "—"}</td>
                            <td className="px-4 py-2.5 text-xs font-semibold max-w-[200px] truncate">{p.title}</td>
                            <td className="px-4 py-2.5 text-[11px] capitalize">{p.type}</td>
                            <td className="px-4 py-2.5">
                              <span className={"px-1.5 py-0.5 rounded text-[10px] font-bold " + (isPlaintiff ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700")}>
                                {isPlaintiff ? "DEMANDANTE" : "DEMANDADO"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[11px] text-muted-foreground max-w-[160px] truncate">{p.judge_entity || "—"}</td>
                            <td className="px-4 py-2.5"><span className={"px-2 py-0.5 rounded text-[11px] font-semibold " + pSt.color}>{pSt.label}</span></td>
                            <td className={deadlineClass}>{p.next_deadline ? fmtDate(p.next_deadline) : "—"}</td>
                            <td className="px-4 py-2.5 text-center">
                              <Link to={"/process/" + p.id}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><ChevronRight className="h-3.5 w-3.5" /></Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== CARTERA ===== */}
        {tab === "cartera" && loadingInvoices && <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>}
        {tab === "cartera" && !loadingInvoices && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Facturado", value: fmt(totalInv),     icon: FileText,    color: "text-slate-700" },
                { label: "Recaudado",        value: fmt(totalPaid),    icon: CheckCircle2, color: "text-emerald-600" },
                { label: "Por Cobrar",       value: fmt(totalPending), icon: TrendingDown, color: "text-amber-600" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <s.icon className={"h-5 w-5 " + s.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={"text-lg font-bold truncate " + s.color}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {totalInv > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">Avance de Recaudo</span>
                  <span className="font-bold text-emerald-600">{Math.round((totalPaid / totalInv) * 100)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: Math.min((totalPaid / totalInv) * 100, 100) + "%" }} />
                </div>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Historial de Facturas — CC {cc}</span>
              </div>
              {clientInvoices.length === 0 ? (
                <div className="py-14 text-center text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No hay facturas registradas para este cliente
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">No. Factura</th>
                        <th className="px-4 py-2.5 text-left">Concepto</th>
                        <th className="px-4 py-2.5 text-left">Emisión</th>
                        <th className="px-4 py-2.5 text-left">Vencimiento</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">Pagado</th>
                        <th className="px-4 py-2.5 text-right">Saldo</th>
                        <th className="px-4 py-2.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientInvoices.map((inv, idx) => {
                        const ist = INV_STATUS[inv.status] || INV_STATUS.pendiente;
                        const saldo = (inv.amount || 0) - (inv.amount_paid || 0);
                        const isOverdue = inv.due_date && differenceInDays(parseISO(inv.due_date), new Date()) < 0 && inv.status !== "pagada";
                        return (
                          <tr key={inv.id} className={"border-t border-border/50 hover:bg-secondary/40 transition-colors " + (idx % 2 !== 0 ? "bg-muted/10" : "")}>
                            <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-primary">{inv.invoice_number || "#" + inv.id?.slice(-5)}</td>
                            <td className="px-4 py-2.5 text-xs max-w-[180px] truncate">{inv.concept}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(inv.issue_date)}</td>
                            <td className={"px-4 py-2.5 font-mono text-[11px] " + (isOverdue ? "text-red-600 font-bold" : "")}>{inv.due_date ? fmtDate(inv.due_date) : "—"}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{fmt(inv.amount)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600">{fmt(inv.amount_paid)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-amber-600">{fmt(saldo)}</td>
                            <td className="px-4 py-2.5 text-center"><span className={"px-2 py-0.5 rounded text-[11px] font-semibold " + ist.color}>{ist.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase">Total</td>
                        <td className="px-4 py-2 text-right font-bold text-xs">{fmt(totalInv)}</td>
                        <td className="px-4 py-2 text-right font-bold text-xs text-emerald-600">{fmt(totalPaid)}</td>
                        <td className="px-4 py-2 text-right font-bold text-xs text-amber-600">{fmt(totalPending)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ACUERDOS ===== */}
        {tab === "acuerdos" && loadingAgreements && <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>}
        {tab === "acuerdos" && !loadingAgreements && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Acuerdos", value: clientAgreements.length, plain: true, color: "text-violet-600" },
                { label: "Activos",        value: activeAgreements.length, plain: true, color: "text-emerald-600" },
                { label: "Capital Total",  value: fmt(totalAgreementValue), color: "text-slate-700" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <CreditCard className={"h-5 w-5 " + s.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={"font-bold truncate " + (s.plain ? "text-2xl " : "text-lg ") + s.color}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCreditType("acuerdo_pago"); setShowCreditForm(true); }}>
                🤝 Nuevo Acuerdo de Pago
              </Button>
              <Button size="sm" className="h-7 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => { setCreditType("credito"); setShowCreditForm(true); }}>
                💳 Nuevo Crédito
              </Button>
            </div>
            <div className="space-y-3">
              {clientAgreements.length === 0 && (
                <div className="bg-card border border-border rounded-xl py-14 text-center text-muted-foreground text-sm">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Sin acuerdos ni créditos registrados
                </div>
              )}
              {clientAgreements.map(ag => {
                const agColor = AG_STATUS_COLOR[ag.status] || "bg-slate-100 text-slate-600";
                return (
                  <div key={ag.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-muted/30 flex items-center justify-between gap-4 border-b border-border">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{ag.description}</p>
                        <p className="text-[11px] text-muted-foreground">{ag.type === "credito" ? "Crédito" : "Acuerdo de Pago"} · {ag.num_installments} cuotas · Inicio: {fmtDate(ag.start_date)}</p>
                      </div>
                      <span className={"px-2 py-0.5 rounded text-xs font-bold shrink-0 " + agColor}>{ag.status}</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Capital</p>
                        <p className="font-bold text-sm">{fmt(ag.total_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Total c/ Interés</p>
                        <p className="font-bold text-sm">{fmt(ag.total_with_interest)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Cuota</p>
                        <p className="font-bold text-sm">{fmt(ag.installment_amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Interés mensual</p>
                        <p className="font-bold text-sm">{ag.interest_rate ? ag.interest_rate + "%" : "—"}</p>
                      </div>
                    </div>
                    {ag.notes && <div className="px-4 pb-3"><p className="text-xs text-muted-foreground italic">"{ag.notes}"</p></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== TESORERÍA ===== */}
        {tab === "tesoreria" && loadingTransactions && <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>}
        {tab === "tesoreria" && !loadingTransactions && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Ingresos del Cliente", value: fmt(txIn),       color: "text-emerald-600" },
                { label: "Egresos Asociados",    value: fmt(txOut),      color: "text-red-600" },
                { label: "Balance Neto",          value: fmt(txIn-txOut), color: txIn - txOut >= 0 ? "text-emerald-600" : "text-red-600" },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                    <Receipt className={"h-5 w-5 " + s.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={"text-lg font-bold truncate " + s.color}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Movimientos de Tesorería — CC {cc}</span>
              </div>
              {clientTransactions.length === 0 ? (
                <div className="py-14 text-center text-muted-foreground text-sm">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No hay movimientos de tesorería asociados a este cliente
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-left">Categoría</th>
                        <th className="px-4 py-2.5 text-left">Concepto</th>
                        <th className="px-4 py-2.5 text-left">Método</th>
                        <th className="px-4 py-2.5 text-left">Referencia</th>
                        <th className="px-4 py-2.5 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientTransactions.map((tx, idx) => {
                        const isIngreso = tx.type === "ingreso";
                        const typeClass = isIngreso ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
                        const amtClass = "px-4 py-2.5 text-right font-bold text-sm " + (isIngreso ? "text-emerald-600" : "text-red-600");
                        return (
                          <tr key={tx.id} className={"border-t border-border/50 hover:bg-secondary/40 transition-colors " + (idx % 2 !== 0 ? "bg-muted/10" : "")}>
                            <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(tx.date)}</td>
                            <td className="px-4 py-2.5">
                              <span className={"px-2 py-0.5 rounded text-[11px] font-bold " + typeClass}>
                                {isIngreso ? "INGRESO" : "EGRESO"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[11px] capitalize">{tx.category?.replace(/_/g, " ") || "—"}</td>
                            <td className="px-4 py-2.5 text-xs max-w-[180px] truncate">{tx.concept}</td>
                            <td className="px-4 py-2.5 text-[11px] capitalize">{tx.payment_method || "—"}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{tx.reference || "—"}</td>
                            <td className={amtClass}>{isIngreso ? "+" : "-"}{fmt(tx.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase">Balance neto del cliente</td>
                        <td className={"px-4 py-2 text-right font-bold text-sm " + (txIn - txOut >= 0 ? "text-emerald-600" : "text-red-600")}>{fmt(txIn - txOut)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== BITÁCORA ===== */}
        {tab === "bitacora" && loadingAudit && <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>}
        {tab === "bitacora" && !loadingAudit && (
          <div className="p-5 max-w-3xl mx-auto space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <History className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Registro automático de cambios</p>
            </div>
            {auditLogs.length === 0 && (
              <div className="bg-card border border-border rounded-xl py-14 text-center text-muted-foreground text-sm">
                <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Sin cambios registrados aún
              </div>
            )}
            {auditLogs.map(log => {
              const isCreate = log.action === "create";
              const accentColor = isCreate ? "border-l-emerald-400" : "border-l-violet-400";
              const iconBg = isCreate ? "bg-emerald-100" : "bg-violet-100";
              const iconColor = isCreate ? "text-emerald-600" : "text-violet-600";
              return (
                <div key={log.id} className={"flex gap-3 border-l-2 pl-3 " + accentColor}>
                  <div className={"h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 " + iconBg}>
                    {isCreate
                      ? <Plus className={"h-3.5 w-3.5 " + iconColor} />
                      : <Pencil className={"h-3.5 w-3.5 " + iconColor} />}
                  </div>
                  <div className="flex-1 bg-card border border-border rounded-xl px-4 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 mb-1">
                          <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 mr-1.5">{log.entity_type}</span>
                          {log.field_label || log.field_name}
                        </p>
                        {!isCreate && log.old_value && (
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <span className="font-mono bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded text-xs line-through">{log.old_value}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded text-xs font-semibold">{log.new_value}</span>
                          </div>
                        )}
                        {isCreate && (
                          <p className="text-xs text-muted-foreground">{log.new_value}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-slate-600">👤 {log.user_name || "Sistema"}</span>
                      <span>·</span>
                      <span>{fmtDateTime(log.created_date)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== ACTIVIDAD ===== */}
        {tab === "actividad" && (
          <div className="p-5 max-w-3xl mx-auto space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => window.open(`/client/${id}/actividad`, "_blank")}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                title="Abrir en nueva pestaña"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-[-45deg]" /> Expandir
              </button>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registrar Actividad</p>
              </div>
              <div className="p-4 space-y-2">
                <Textarea placeholder="Escribe un comentario o registra una actividad..." rows={3} value={newComment}
                  onChange={e => setNewComment(e.target.value)} className="text-sm resize-none" />
                <div className="flex gap-2 items-center justify-between">
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["comentario","llamada","correo","reunion","documento","pago","estado"].map(t => (
                        <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-7 text-xs" disabled={!newComment.trim() || addActivity.isPending}
                    onClick={() => addActivity.mutate({ comment: newComment, activity_type: activityType })}>
                    {addActivity.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {activities.length === 0 && <div className="text-sm text-muted-foreground text-center py-10">Sin actividad registrada aún</div>}
              {activities.map(a => {
                const Icon = ACTIVITY_ICONS[a.activity_type] || MessageSquare;
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 bg-card border border-border rounded-lg p-3">
                      <p className="text-sm">{a.comment}</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmtDateTime(a.created_date)} · <span className="capitalize">{a.activity_type}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>


      <ClientForm open={showEdit} onOpenChange={setShowEdit} client={client}
        onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ["client", id] }); qc.invalidateQueries({ queryKey: ["clients"] }); }} />
      <NegativeReportForm 
        open={showReportForm || !!editingReport} 
        onOpenChange={(open) => { 
          if (!open) {
            setShowReportForm(false);
            setEditingReport(null);
          } else {
            setShowReportForm(true);
          }
        }} 
        clientId={id} 
        editingReport={editingReport}
        onSuccess={() => { setShowReportForm(false); setEditingReport(null); qc.invalidateQueries({ queryKey: ["reports", id] }); }} 
      />
      {selectedReport && (
        <ProcessAdvanceForm
          open={showAdvanceModal}
          onOpenChange={setShowAdvanceModal}
          report={selectedReport}
          processId=""
          clientId={id}
        />
      )}
      {client && (
        <CreditAgreementForm
          open={showCreditForm} onOpenChange={setShowCreditForm} defaultType={creditType}
          prefilledClient={{ id: client.id, full_name: client.full_name, cc: client.cc, phone: client.phone, pending_balance: client.pending_balance }}
          onSuccess={() => { setShowCreditForm(false); qc.invalidateQueries({ queryKey: ["agreements_all"] }); }}
        />
      )}
    </div>
  );
}