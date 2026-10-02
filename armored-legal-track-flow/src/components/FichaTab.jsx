/**
 * FichaTab — Clean card-based "Ficha" view.
 * White cards, subtle borders, 12px radius, semantic badges.
 */
import { useState } from "react";
import { Plus, Pencil, Copy, ClipboardCheck, Search, Download, ChevronRight, ArrowDown, Minus, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClientDocumentosTab from "@/components/ClientDocumentosTab";

const fmt = (n) =>
  n != null && n !== ""
    ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
    : "—";

const fmtDate = (d) => {
  try { return new Date(d).toLocaleDateString("es-CO"); } catch { return d || "—"; }
};

// ── Section card with header ──────────────────────────────────────────────────
const SectionCard = ({ title, action, children }) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// ── 2-column label/value grid ─────────────────────────────────────────────────
const DataGrid = ({ rows }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
    {rows.map(({ label, value, mono, valueClass, full }, i) => (
      <div key={i} className={full ? "sm:col-span-2" : ""}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
        <p className={`text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""} ${valueClass || ""}`}>
          {value ?? "—"}
        </p>
      </div>
    ))}
  </div>
);

// ── Semantic badge ────────────────────────────────────────────────────────────
const Badge = ({ children, tone = "neutral" }) => {
  const tones = {
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    coral:  "bg-orange-50 text-orange-700 border-orange-200",
    red:    "bg-red-50 text-red-600 border-red-200",
    neutral:"bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
};

// ── Status icon for report row ────────────────────────────────────────────────
const StatusIcon = ({ status }) => {
  if (status === "eliminado_exito")
    return <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#E8F5E9" }}><ArrowDown className="h-4 w-4 text-emerald-600" /></div>;
  if (status === "en_gestion")
    return <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#E3F2FD" }}><Clock className="h-4 w-4 text-blue-600" /></div>;
  if (status === "inviable")
    return <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#F5F5F5" }}><XCircle className="h-4 w-4 text-slate-400" /></div>;
  return <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: "#F5F5F5" }}><Minus className="h-4 w-4 text-slate-400" /></div>;
};

// ── Reportes table (Bold style with filter bar) ──────────────────────────────
const ReportesTable = ({ reports, getObligationLabel, onAdd, onEdit, onAdvance, onDelete, onReverse }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const totalSaldo = reports.reduce((s, r) => s + (r.pending_amount || 0), 0);

  const filtered = reports.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.entity_name?.toLowerCase().includes(search.toLowerCase()) && !r.obligation_number?.includes(search)) return false;
    return true;
  });

  const handleDownload = () => {
    const headers = ["Entidad", "No. Obligacion", "Estado Central", "Gestion", "Saldo", "Permanencia Negativa"];
    const rows = filtered.map(r => [
      `"${r.entity_name || ""}"`, r.obligation_number || "",
      getObligationLabel ? getObligationLabel(r.obligation_status) : (r.obligation_status || ""),
      r.status || "", r.pending_amount || 0,
      r.has_negative_permanence && r.negative_permanence_until ? r.negative_permanence_until : "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "reportes-negativos.csv";
    a.click();
  };

  return (
    <div className="-mx-4 -my-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/40 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input placeholder="Buscar entidad u obligación..." className="pl-8 h-8 text-xs bg-white border-slate-200" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2 cursor-pointer focus:outline-none">
          <option value="all">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_gestion">En Gestión</option>
          <option value="eliminado_exito">Eliminado</option>
          <option value="inviable">Inviable</option>
        </select>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-slate-200" onClick={handleDownload} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Descargar
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="px-4 py-2 text-left w-10"></th>
              <th className="px-4 py-2 text-left">Entidad / Obligación</th>
              <th className="px-4 py-2 text-left">Estado Central</th>
              <th className="px-4 py-2 text-right">Saldo</th>
              <th className="px-4 py-2 text-left">Perm. Negativa</th>
              <th className="px-4 py-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                  {reports.length === 0 ? "Sin reportes negativos registrados" : "Sin resultados para el filtro aplicado"}
                </td>
              </tr>
            ) : filtered.map((r) => {
              const isTerminal = r.status === "eliminado_exito" || r.status === "inviable";
              return (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => !isTerminal && onAdvance(r)}>
                  <td className="px-4 py-3"><StatusIcon status={r.status} /></td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 text-xs">{r.entity_name}</p>
                    {r.obligation_number && <p className="font-mono text-slate-400 text-[10px]">No. {r.obligation_number}</p>}
                    <div className="flex items-center gap-1.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isTerminal ? (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700">Editar</button>
                          <button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="text-[10px] px-2 py-0.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-600">✕</button>
                        </>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); onReverse(r); }} className="text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700">Reversar</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 font-medium">
                    {getObligationLabel ? getObligationLabel(r.obligation_status) : (r.obligation_status || "—")}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700">
                    {r.pending_amount ? fmt(r.pending_amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[10px]">
                    {r.has_negative_permanence && r.negative_permanence_until
                      ? <span className="text-red-600 font-semibold">Hasta {fmtDate(r.negative_permanence_until)}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 mx-auto" />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-100 bg-slate-50/40">
                <td colSpan={3} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Totales — {filtered.length} obligación{filtered.length !== 1 ? "es" : ""}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold text-slate-700">{fmt(totalSaldo)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ── Cobro Mixto block ─────────────────────────────────────────────────────────
const CobroMixtoBlock = ({ client, editingCobro, cobroForm, setCobroForm, onEdit, onSave, onCancel, isPending }) => {
  const cf = editingCobro ? cobroForm : {
    valor_expectativa_total: client.valor_expectativa_total ?? "",
    porcentaje_anticipo: client.porcentaje_anticipo ?? 0.5,
    total_reportes_objetivo: client.total_reportes_objetivo ?? "",
    anticipo_cuotas: client.anticipo_cuotas ?? 1,
  };
  const expectativa = parseFloat(cf.valor_expectativa_total) || 0;
  const pct = parseFloat(cf.porcentaje_anticipo) || 0.5;
  const reportes = parseInt(cf.total_reportes_objetivo) || 0;
  const cuotas = parseInt(cf.anticipo_cuotas) || 1;
  const montoAnticipo = expectativa * pct;
  const montoExito = expectativa * (1 - pct);
  const cuotaAnticipo = cuotas > 0 ? montoAnticipo / cuotas : montoAnticipo;
  const honorarioReporte = reportes > 0 ? montoExito / reportes : 0;

  const inputCls = "w-full text-sm font-medium border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50/50 font-mono";

  return (
    <SectionCard
      title="III. Estructura de Cobro Mixto"
      action={
        editingCobro ? (
          <div className="flex gap-1.5">
            <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={isPending}>
              {isPending ? "..." : "Guardar"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEdit}>
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
        )
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Expectativa Total</p>
          {editingCobro
            ? <input type="number" className={inputCls} value={cobroForm.valor_expectativa_total} onChange={e => setCobroForm(p => ({ ...p, valor_expectativa_total: e.target.value }))} placeholder="0" />
            : <p className="text-sm font-bold font-mono text-slate-800">{fmt(client.valor_expectativa_total)}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">% Anticipo</p>
          {editingCobro
            ? <select className={inputCls} value={cobroForm.porcentaje_anticipo} onChange={e => setCobroForm(p => ({ ...p, porcentaje_anticipo: parseFloat(e.target.value) }))}>
                {[0.3, 0.4, 0.5, 0.6, 0.7].map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
              </select>
            : <p className="text-sm font-bold text-slate-800">{Math.round(pct * 100)}%</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Reportes Objetivo</p>
          {editingCobro
            ? <input type="number" min="1" className={inputCls} value={cobroForm.total_reportes_objetivo} onChange={e => setCobroForm(p => ({ ...p, total_reportes_objetivo: e.target.value }))} placeholder="0" />
            : <p className="text-sm font-bold text-slate-800">{client.total_reportes_objetivo || "—"}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Cuotas Anticipo</p>
          {editingCobro
            ? <input type="number" min="1" max="12" className={inputCls} value={cobroForm.anticipo_cuotas}
                onChange={e => {
                  const n = parseInt(e.target.value) || 1;
                  const prevDates = cobroForm.anticipo_dates || [];
                  setCobroForm(p => ({ ...p, anticipo_cuotas: n, anticipo_dates: Array.from({ length: n }, (_, i) => prevDates[i] || "") }));
                }} />
            : <p className="text-sm font-bold text-slate-800">{client.anticipo_cuotas || 1}</p>}
        </div>
      </div>

      {/* Calculated values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Anticipo</p>
          <p className="text-sm font-bold font-mono text-blue-700">{fmt(montoAnticipo)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Cuota Anticipo</p>
          <p className="text-sm font-bold font-mono text-blue-700">{fmt(cuotaAnticipo)}</p>
          {cuotas > 1 && <p className="text-[10px] text-slate-400">x {cuotas} cuotas</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Éxito</p>
          <p className="text-sm font-bold font-mono text-emerald-700">{fmt(montoExito)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Honor. / Reporte</p>
          <p className="text-sm font-bold font-mono text-emerald-700">{reportes > 0 ? fmt(honorarioReporte) : "—"}</p>
        </div>
      </div>

      {/* Cronograma */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Cronograma de Anticipo</p>
        <div className="space-y-1.5">
          {Array.from({ length: cuotas }, (_, i) => {
            const fecha = editingCobro ? (cobroForm.anticipo_dates?.[i] ?? "") : (client.anticipo_dates?.[i] ?? "");
            const isMissing = editingCobro && !fecha;
            return (
              <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-slate-50/60 border border-slate-100">
                <span className="text-xs font-bold text-slate-500 w-6 text-center">{i + 1}</span>
                <span className="text-sm font-mono font-semibold text-blue-700 flex-1">{fmt(cuotaAnticipo)}</span>
                {editingCobro ? (
                  <input type="date" className={`text-sm font-mono border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isMissing ? "bg-red-50 text-red-600" : "bg-white"}`}
                    value={fecha} onChange={e => { const newDates = [...(cobroForm.anticipo_dates || [])]; newDates[i] = e.target.value; setCobroForm(p => ({ ...p, anticipo_dates: newDates })); }} />
                ) : (
                  <span className={`text-sm font-mono ${fecha ? "text-slate-700" : "text-slate-300"}`}>
                    {fecha ? new Date(fecha + "T00:00:00").toLocaleDateString("es-CO") : "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function FichaTab({
  client, reports, getObligationLabel,
  editingCobro, cobroForm, setCobroForm,
  onEditCobro, onSaveCobro, onCancelCobro, isCobroPending,
  editingFinancial, setEditingFinancial,
  keyEdits, setKeyEdits, scoreEdits, setScoreEdits,
  onUpdateField,
  onAddReport, onEditReport, onAdvanceReport, onDeleteReport, onReverseReport,
}) {
  const [copiedKeys, setCopiedKeys] = useState({});
  const [savingFinancial, setSavingFinancial] = useState(false);

  const handleSaveFinancial = async () => {
    setSavingFinancial(true);
    const fields = {};
    const oldValues = {};
    if (keyEdits["datacredito_key"] !== undefined) { fields.datacredito_key = keyEdits["datacredito_key"]; oldValues.datacredito_key = client.datacredito_key; }
    if (keyEdits["transunion_key"] !== undefined) { fields.transunion_key = keyEdits["transunion_key"]; oldValues.transunion_key = client.transunion_key; }
    const scoreData = parseInt(scoreEdits["score_data"]);
    if (!isNaN(scoreData)) { fields.score_data = scoreData; oldValues.score_data = client.score_data; }
    const scoreTu = parseInt(scoreEdits["score_transunion"]);
    if (!isNaN(scoreTu)) { fields.score_transunion = scoreTu; oldValues.score_transunion = client.score_transunion; }
    if (Object.keys(fields).length > 0) await onUpdateField({ fields, oldValues });
    setKeyEdits({}); setScoreEdits({}); setEditingFinancial(false); setSavingFinancial(false);
  };

  const condicionesActivas = [
    client.victim_conflict === "si" && "Víctima conflicto",
    client.indigenous === "si" && "Indígena",
    client.elderly === "si" && "Adulto mayor",
    client.psychological_impact === "si" && "Afect. psicológica",
    client.single_mother === "si" && "Madre cabeza de familia",
  ].filter(Boolean);

  const SERVICE_LABELS = {
    eliminacion_reportes: "Eliminación Reportes",
    tutela: "Acción de Tutela", sic: "Proceso SIC", cartera: "Gestión de Cartera", otro: "Otro",
  };

  const handleCopy = (key, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedKeys(s => ({ ...s, [key]: true }));
    setTimeout(() => setCopiedKeys(s => ({ ...s, [key]: false })), 1500);
  };

  const scoreColor = (score) => (score || 0) >= 700 ? "text-emerald-700" : (score || 0) >= 500 ? "text-amber-600" : "text-red-600";

  return (
    <div className="p-4 space-y-4">

      {/* ── I. Datos Generales ── */}
      <SectionCard title="I. Datos Generales y Domicilio">
        <DataGrid rows={[
          { label: "Nombre Completo", value: client.full_name, full: true },
          { label: "Cédula", value: client.cc, mono: true },
          { label: "Celular", value: client.phone, mono: true },
          { label: "Correo", value: client.email },
          { label: "Servicio", value: SERVICE_LABELS[client.service_type] || client.service_type },
          { label: "Ciudad / Municipio", value: client.city },
          { label: "Departamento", value: client.department },
          { label: "Dirección", value: client.address },
          { label: "Barrio", value: client.neighborhood },
          { label: "Referido por", value: client.referrer_name },
          { label: "Fecha Contrato", value: client.contract_date ? fmtDate(client.contract_date) : "—", mono: true },
        ]} />

        {/* Condiciones especiales */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Condiciones Especiales</p>
          {condicionesActivas.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {condicionesActivas.map(c => <Badge key={c} tone="coral">{c}</Badge>)}
            </div>
          ) : <p className="text-sm text-slate-300">Ninguna</p>}
        </div>

        {/* Notas */}
        {client.notes && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Observaciones</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </SectionCard>

      {/* ── II. Centrales de Riesgo ── */}
      <SectionCard
        title="II. Centrales de Riesgo"
        action={
          editingFinancial ? (
            <div className="flex gap-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={handleSaveFinancial} disabled={savingFinancial}>
                {savingFinancial ? "..." : "Guardar"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setKeyEdits({}); setScoreEdits({}); setEditingFinancial(false); }}>Cancelar</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingFinancial(true)}>
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* DataCrédito */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Clave DataCrédito</p>
              {editingFinancial ? (
                <input type="text" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50/50"
                  value={keyEdits["datacredito_key"] ?? (client.datacredito_key ?? "")}
                  onChange={e => setKeyEdits(s => ({ ...s, datacredito_key: e.target.value }))} />
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <span className="text-sm font-mono text-slate-800">{client.datacredito_key || "—"}</span>
                  {client.datacredito_key && (
                    <button onClick={() => handleCopy("datacredito_key", client.datacredito_key)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-600">
                      {copiedKeys["datacredito_key"] ? <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Score DataCrédito</p>
              {editingFinancial ? (
                <input type="text" inputMode="numeric" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50/50"
                  value={scoreEdits["score_data"] ?? (client.score_data ?? "")}
                  onChange={e => setScoreEdits(s => ({ ...s, score_data: e.target.value }))} />
              ) : (
                <p className={`text-lg font-black font-mono ${scoreColor(client.score_data)}`}>
                  {client.score_data ?? "—"} <span className="text-[10px] text-slate-300 font-normal">/ 1000</span>
                </p>
              )}
            </div>
          </div>
          {/* TransUnion */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Clave TransUnion</p>
              {editingFinancial ? (
                <input type="text" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50/50"
                  value={keyEdits["transunion_key"] ?? (client.transunion_key ?? "")}
                  onChange={e => setKeyEdits(s => ({ ...s, transunion_key: e.target.value }))} />
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <span className="text-sm font-mono text-slate-800">{client.transunion_key || "—"}</span>
                  {client.transunion_key && (
                    <button onClick={() => handleCopy("transunion_key", client.transunion_key)} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-blue-600">
                      {copiedKeys["transunion_key"] ? <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Score TransUnion</p>
              {editingFinancial ? (
                <input type="text" inputMode="numeric" className="w-full text-sm font-mono border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-amber-50/50"
                  value={scoreEdits["score_transunion"] ?? (client.score_transunion ?? "")}
                  onChange={e => setScoreEdits(s => ({ ...s, score_transunion: e.target.value }))} />
              ) : (
                <p className={`text-lg font-black font-mono ${scoreColor(client.score_transunion)}`}>
                  {client.score_transunion ?? "—"} <span className="text-[10px] text-slate-300 font-normal">/ 1000</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── III. Cobro Mixto ── */}
      <CobroMixtoBlock client={client} editingCobro={editingCobro} cobroForm={cobroForm} setCobroForm={setCobroForm}
        onEdit={onEditCobro} onSave={onSaveCobro} onCancel={onCancelCobro} isPending={isCobroPending} />

      {/* ── IV. Reportes Negativos ── */}
      <SectionCard
        title={`IV. Reportes Negativos en Centrales (${reports.length})`}
        action={
          <Button size="sm" className="h-7 text-xs" onClick={onAddReport}>
            <Plus className="h-3 w-3 mr-1" /> Agregar
          </Button>
        }
      >
        <ReportesTable reports={reports} getObligationLabel={getObligationLabel}
          onAdd={onAddReport} onEdit={onEditReport} onAdvance={onAdvanceReport}
          onDelete={onDeleteReport} onReverse={onReverseReport} />
      </SectionCard>

      {/* ── V. Documentos ── */}
      <ClientDocumentosTab clientId={client.id} />

      {/* ── VI. Proceso Ejecutivo (condicional) ── */}
      {(client.service_type === "cartera" || client.service_type === "otro") &&
        (client.ejecutivo_juzgado || client.ejecutivo_acreedor) && (
        <SectionCard title="V. Datos del Proceso Ejecutivo / Cartera">
          <DataGrid rows={[
            { label: "Juzgado", value: client.ejecutivo_juzgado, full: true },
            { label: "Acreedor", value: client.ejecutivo_acreedor },
            { label: "Deudor", value: client.ejecutivo_deudor },
            { label: "Cuantía", value: fmt(client.ejecutivo_cuantia), mono: true, valueClass: "text-red-600" },
            { label: "Título Ejecutivo", value: client.ejecutivo_titulo, full: true },
          ]} />
        </SectionCard>
      )}

    </div>
  );
}