import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Briefcase, AlertTriangle, Clock, DollarSign, Plus, ChevronRight, Scale, TrendingUp, TrendingDown, Users, Award, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import GaugeChart from "@/components/GaugeChart";

const toTitleCase = (str) => str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => {try {return format(parseISO(d), "dd/MM/yyyy", { locale: es });} catch {return d;}};
const CHART_COLORS = ["#1e3a5f", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const urgencyRow = (days) => {
  if (days < 0) return "border-l-4 border-l-red-500 bg-red-50 hover:bg-red-100";
  if (days <= 3) return "border-l-4 border-l-orange-500 bg-orange-50 hover:bg-orange-100";
  if (days <= 7) return "border-l-4 border-l-amber-400 bg-amber-50 hover:bg-amber-100";
  return "hover:bg-secondary/50";
};

const urgencyBadge = (days) => {
  if (days < 0) return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-500 text-white">VENCIDO</span>;
  if (days === 0) return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-400 text-white">HOY</span>;
  if (days <= 3) return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-500 text-white">{days}d</span>;
  if (days <= 7) return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white">{days}d</span>;
  return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">{days}d</span>;
};

const ModuleCard = ({ to, icon: Icon, label, count, sublabel, color }) =>
<Link to={to} className={`${color} rounded-xl p-4 flex items-center justify-between hover:opacity-90 transition-opacity`}>
    <div>
      <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-white font-bold text-2xl mt-0.5">{count}</p>
      {sublabel && <p className="text-white/70 text-[11px] mt-0.5">{sublabel}</p>}
    </div>
    <div className="flex flex-col items-end gap-2">
      <Icon className="h-8 w-8 text-white/30" />
      <ChevronRight className="h-4 w-4 text-white/50" />
    </div>
  </Link>;


export default function Dashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("juridico");

  // Suscripción en tiempo real a LegalActions
  useEffect(() => {
    const unsubLA = base44.entities.LegalAction.subscribe(() => {
      qc.invalidateQueries({ queryKey: ["all_legal_actions_dash"] });
    });
    return () => {unsubLA();};
  }, [qc]);

  const { data: processes = [], isLoading: lp } = useQuery({ queryKey: ["processes"], queryFn: () => base44.entities.Process.list() });
  const { data: finances = [], isLoading: lf } = useQuery({ queryKey: ["finances"], queryFn: () => base44.entities.ProcessFinance.list() });
  const { data: clients = [], isLoading: lc } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: legalActions = [], isLoading: lla } = useQuery({ queryKey: ["all_legal_actions_dash"], queryFn: () => base44.entities.LegalAction.list() });
  const { data: processStatesRaw = [], isLoading: lps } = useQuery({ queryKey: ["process_states_dash"], queryFn: () => base44.functions.invoke("getActiveProcessStates", {}).then((r) => r.data.states || []) });

  if (lp || lf || lc || lla || lps) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
    </div>);


  const activeProcesos = processes.filter((p) => ["activo", "en_tramite"].includes(p.status)).length;
  const deadlines = processes.filter((p) => p.next_deadline).
  map((p) => ({ ...p, days: differenceInDays(parseISO(p.next_deadline), new Date()) })).
  sort((a, b) => a.days - b.days);
  const overdue = deadlines.filter((p) => p.days < 0).length;
  const urgent = deadlines.filter((p) => p.days >= 0 && p.days <= 5).length;

  const totalIn = finances.filter((f) => f.type === "ingreso").reduce((s, f) => s + (f.amount || 0), 0);
  const totalOut = finances.filter((f) => f.type === "egreso").reduce((s, f) => s + (f.amount || 0), 0);

  const activeClients = clients.filter((c) => !["finalizado", "perdido"].includes(c.status)).length;
  const totalPactado = clients.reduce((s, c) => s + (c.agreed_value || 0), 0);
  const totalSaldo = clients.reduce((s, c) => s + (c.pending_balance || 0), 0);

  const statusData = Object.entries(processes.reduce((acc, p) => {acc[p.status] = (acc[p.status] || 0) + 1;return acc;}, {})).
  map(([k, v]) => ({ name: { activo: "Activo", en_tramite: "En Trámite", finalizado: "Finalizado", archivado: "Archivado" }[k] || k, value: v }));
  // Normalización: minúsculas + espacios → guión bajo
  // Comparación case-insensitive directa (los clientes guardan el name original con espacios)
  const matchStatus = (clientStatus, stageName) =>
  (clientStatus || "").trim().toLowerCase() === (stageName || "").trim().toLowerCase();

  // Métrica de fuga — clientes desistidos
  const desistidos = clients.filter((c) => matchStatus(c.status, "Desistido"));
  const desistidosCount = desistidos.length;
  const desistidosCapital = desistidos.reduce((s, c) => s + (c.agreed_value || 0), 0);

  // Pipeline: estados activos ordenados, excluyendo "Desistido" (se muestra aparte)
  const pipelineStages = processStatesRaw.
  filter((s) => !matchStatus(s.name, "Desistido")).
  sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Mapear clientes a sus etapas — siempre mostrar TODAS las etapas (0 si vacío)
  const pipelineData = pipelineStages.map((stage) => {
    const matches = clients.filter((c) => matchStatus(c.status, stage.name));
    return {
      key: stage.id,
      label: stage.display_name || stage.name,
      count: matches.length,
      capital: matches.reduce((s, c) => s + (c.agreed_value || 0), 0),
      isTerminal: !!stage.is_terminal
    };
  });

  const TYPE_LABELS = {
    tutela: "Acción de Tutela",
    peticion: "Derecho de Petición",
    recurso: "Recurso (Apelación / Reposición)",
    queja_sic: "Queja SIC",
    demanda: "Demanda Civil",
    incidente: "Incidente (Nulidad / Desacato)",
    otro: "Otro trámite"
  };
  const TYPE_COLORS = {
    tutela: "#8b5cf6",
    peticion: "#3b82f6",
    recurso: "#f59e0b",
    queja_sic: "#ef4444",
    demanda: "#10b981",
    incidente: "#f97316",
    otro: "#94a3b8"
  };
  const activos = legalActions.filter((a) => ["activo", "en_tramite"].includes(a.status));
  const byType = activos.reduce((acc, a) => {const k = a.type || "otro";acc[k] = (acc[k] || 0) + 1;return acc;}, {});
  const totalActivos = activos.length;
  const typeRows = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: TYPE_LABELS[key] || key, count, color: TYPE_COLORS[key] || "#94a3b8" }));
  const donutData = typeRows.filter((r) => r.count > 0);

  const TABS = [
  { id: "juridico", label: "JUR\xCDDICO" },
  { id: "comercial", label: "COMERCIAL" }];


  const TAB_TITLES = {
    juridico: { icon: Scale, label: "INVENTARIO JURÍDICO — COMPOSICIÓN DEL PORTAFOLIO" },
    comercial: { icon: Briefcase, label: "VISIÓN ESTRATÉGICA COMERCIAL — PIPELINE" }
  };
  const activeTabMeta = TAB_TITLES[activeTab];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab navigation — raíz superior */}
      <div className="flex items-end gap-0 px-6 bg-white border-b border-gray-300 shrink-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={
              "px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-colors border-b-2 " + (
              isActive ?
              "border-slate-800 text-slate-800" :
              "border-transparent text-gray-400 hover:text-gray-700")
              }>
              
              {tab.label}
            </button>);

        })}
      </div>

      {/* Dynamic dark header */}
      


      

      <div className="flex-1 overflow-auto p-4 md:p-5 space-y-4">

        {/* ══════════════ PESTAÑA 1: INVENTARIO JURÍDICO ══════════════ */}
        {activeTab === "juridico" &&
        <>
            {/* Trámites por Tipología */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-slate-700 flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-white">PROCESOS en Curso </span>
                
              </div>
              <div className="grid grid-cols-12">
                <div className="col-span-7 border-r border-border">
                  <table className="w-full border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-3 py-1.5 text-left font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-300">Naturaleza Jurídica</th>
                        <th className="px-3 py-1.5 text-right font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-300 tabular-nums">Volumen (Q)</th>
                        <th className="px-3 py-1.5 text-right font-bold uppercase text-[10px] text-gray-600 tracking-wide tabular-nums">Participación (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeRows.length === 0 ?
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-400 italic">Sin trámites activos</td></tr> :
                    typeRows.map((row, i) =>
                    <tr key={row.key} className={"border-b border-gray-200 " + (i % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                          <td className="px-3 py-2 border-r border-gray-200">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                              <span className="font-semibold text-gray-800">{row.label}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums border-r border-gray-200 text-gray-800">{row.count}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                            {totalActivos > 0 ? (row.count / totalActivos * 100).toFixed(1) + "%" : "—"}
                          </td>
                        </tr>
                    )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-200 border-t-2 border-gray-400">
                        <td className="px-3 py-2 font-black uppercase text-[10px] text-gray-700 border-r border-gray-300">TOTAL</td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-gray-800 border-r border-gray-300">{totalActivos}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-600">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="col-span-5 flex flex-col items-center justify-center py-2 px-2">
                  {donutData.length > 0 ?
                <>
                      <ResponsiveContainer width="100%" height={130}>
                        <PieChart>
                          <Pie data={donutData} cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="count" nameKey="label" paddingAngle={2}>
                            {donutData.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0} />)}
                          </Pie>
                          <Tooltip formatter={(v, n) => [v + " trámites", n]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                        {donutData.map((d) =>
                    <div key={d.key} className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-[10px] text-gray-600">{d.label} ({d.count})</span>
                          </div>
                    )}
                      </div>
                    </> :

                <p className="text-[11px] text-gray-400 italic">Sin datos</p>
                }
                </div>
              </div>
            </div>

            {/* Avance Procesal — ocupa ancho completo */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avance Procesal</p>
              </div>
              <div className="p-4 flex items-center justify-center">
                {statusData.length > 0 ?
              <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name">
                        {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer> :

              <p className="text-sm text-center py-8 text-muted-foreground">Sin datos</p>
              }
              </div>
            </div>
          </>
        }

        {/* ══════════════ PESTAÑA 2: EMBUDO COMERCIAL ══════════════ */}
        {activeTab === "comercial" && (() => {
          const totalClientes = clients.filter((c) => !matchStatus(c.status, "Desistido")).length;
          const totalCapital = clients.filter((c) => !matchStatus(c.status, "Desistido")).reduce((s, c) => s + (c.agreed_value || 0), 0);
          const newClients = clients.filter((c) => c.is_new).length;
          const firmados = pipelineData.find((s) => matchStatus(s.label, "Contrato Firmado")) || { count: 0, capital: 0 };
          const convRateTotal = totalClientes + newClients;
          const convRate = convRateTotal > 0 ? (firmados.count / convRateTotal * 100).toFixed(1) : "0.0";

          return (
            <div className="space-y-4">
              {/* Embudo — tabla + grid horizontal */}
              <div className="border border-gray-300 bg-white shadow-sm overflow-hidden">
                


                

                {/* Grid horizontal scrollable */}
                <div className="overflow-x-auto">
                  <div className="flex flex-nowrap w-full border-b border-gray-200">
                    {pipelineData.map((stage, idx) => {
                      const pct = totalClientes > 0 ? Math.round(stage.count / totalClientes * 100) : 0;
                      return null;


























                    })}
                  </div>
                </div>

                {/* Tabla resumen por etapa */}
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-3 py-1.5 text-left font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-200 w-6">#</th>
                      <th className="px-3 py-1.5 text-left font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-200">Etapa</th>
                      <th className="px-3 py-1.5 text-right font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-200 tabular-nums">Clientes</th>
                      <th className="px-3 py-1.5 text-right font-bold uppercase text-[10px] text-gray-600 tracking-wide border-r border-gray-200 tabular-nums">Capital Expectativa</th>
                      <th className="px-3 py-1.5 text-right font-bold uppercase text-[10px] text-gray-600 tracking-wide tabular-nums">% del Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {newClients > 0 && (
                      <tr className="border-b border-gray-100 bg-white">
                        <td className="px-3 py-1.5 text-gray-400 font-mono border-r border-gray-100 text-center">1</td>
                        <td className="px-3 py-1.5 font-semibold text-gray-800 border-r border-gray-100">
                          <span className="px-1.5 py-0.5 text-[9px] font-bold text-white rounded-sm" style={{backgroundColor:"#16a34a"}}>Nuevo</span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-800 border-r border-gray-100">{newClients}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 border-r border-gray-100">—</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{convRateTotal > 0 ? (newClients / convRateTotal * 100).toFixed(1) + "%" : "—"}</td>
                      </tr>
                    )}
                    {pipelineData.map((stage, idx) => {
                      const pct = totalClientes > 0 ? (stage.count / totalClientes * 100).toFixed(1) : "0.0";
                      return (
                        <tr key={stage.key} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${stage.isTerminal ? "bg-emerald-50" : ""}`}>
                          <td className="px-3 py-1.5 text-gray-400 font-mono border-r border-gray-100 text-center">{idx + 2}</td>
                          <td className="px-3 py-1.5 font-semibold text-gray-800 border-r border-gray-100">{stage.label}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-bold text-slate-800 border-r border-gray-100">{stage.count}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 font-semibold border-r border-gray-100">{stage.capital > 0 ? fmt(stage.capital) : "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{pct}%</td>
                        </tr>);

                    })}
                    {desistidosCount > 0 &&
                    <tr className="border-t border-gray-200 bg-white">
                        <td className="px-3 py-1.5 text-gray-400 font-mono border-r border-gray-100 text-center">{newClients > 0 ? pipelineData.length + 2 : pipelineData.length + 1}</td>
                        <td className="px-3 py-1.5 font-semibold text-gray-600 border-r border-gray-100">Desistido</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-bold text-gray-700 border-r border-gray-100">{desistidosCount}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 font-semibold border-r border-gray-100">{fmt(desistidosCapital)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-400">—</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-200 border-t-2 border-gray-400">
                      <td className="px-3 py-1.5 border-r border-gray-300" />
                      <td className="px-3 py-1.5 font-black uppercase text-[10px] text-gray-700 border-r border-gray-300">TOTAL PIPELINE</td>
                      <td className="px-3 py-1.5 text-right font-black tabular-nums text-gray-800 border-r border-gray-300">{totalClientes}</td>
                      <td className="px-3 py-1.5 text-right font-black tabular-nums text-emerald-800 border-r border-gray-300">{fmt(totalCapital)}</td>
                      <td className="px-3 py-1.5 text-right font-black tabular-nums text-gray-700">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Gauge — Tasa de Conversión */}
              <div className="border border-gray-300 bg-white shadow-sm overflow-hidden flex flex-col items-center py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Tasa de Conversión</p>
                <GaugeChart value={parseFloat(convRate)} subLabel={`${firmados.count} firmados de ${totalClientes} clientes en pipeline`} />
              </div>
            </div>);

        })()}

      </div>
    </div>);

}