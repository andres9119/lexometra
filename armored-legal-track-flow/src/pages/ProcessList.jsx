import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Briefcase, ChevronRight, Clock, CheckCircle2, Archive, LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProcessForm from "@/components/ProcessForm.jsx";
import ProcessKanbanBoard from "@/components/ProcessKanbanBoard";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

const STATUS_CONFIG = {
  all:        { label: "Todos",      color: "bg-slate-600",   light: "bg-slate-100 text-slate-700",    icon: Briefcase },
  activo:     { label: "Activo",     color: "bg-emerald-600", light: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  en_tramite: { label: "En Trámite", color: "bg-amber-600",   light: "bg-amber-100 text-amber-700",    icon: Clock },
  finalizado: { label: "Finalizado", color: "bg-blue-600",    light: "bg-blue-100 text-blue-700",      icon: CheckCircle2 },
  archivado:  { label: "Archivado",  color: "bg-slate-400",   light: "bg-slate-100 text-slate-500",    icon: Archive },
};

const TYPE_CONFIG = {
  tutela:                  { label: "Tutela",            color: "bg-violet-100 text-violet-700" },
  derecho_peticion:        { label: "D. Petición",       color: "bg-blue-100 text-blue-700" },
  recurso:                 { label: "Recurso",           color: "bg-orange-100 text-orange-700" },
  incidente_desacato:       { label: "Desacato",          color: "bg-yellow-100 text-yellow-700" },
  eliminacion_reportes:    { label: "Reportes Neg.",     color: "bg-emerald-100 text-emerald-700" },
  proteccion_consumidor:   { label: "Consumidor",        color: "bg-cyan-100 text-cyan-700" },
  superfinanciera:         { label: "Superfinanciera",   color: "bg-indigo-100 text-indigo-700" },
  sic:                     { label: "SIC",               color: "bg-blue-100 text-blue-700" },
  ejecutivo:               { label: "Ejecutivo",         color: "bg-rose-100 text-rose-700" },
  otro:                    { label: "Otro",              color: "bg-slate-100 text-slate-600" },
};

const PRIO_CONFIG = {
  alta:  { label: "ALTA",  color: "bg-red-100 text-red-700 border border-red-200" },
  media: { label: "MEDIA", color: "bg-amber-100 text-amber-700 border border-amber-200" },
  baja:  { label: "BAJA",  color: "bg-slate-100 text-slate-500 border border-slate-200" },
};

const fmtDate = (d) => { try { return format(parseISO(d), "dd/MM/yy", { locale: es }); } catch { return "—"; } };

export default function ProcessList() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusTab, setStatusTab] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  const qc = useQueryClient();

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ["processes"],
    queryFn: () => base44.entities.Process.list("-created_date"),
  });

  const counts = Object.keys(STATUS_CONFIG).reduce((acc, k) => {
    acc[k] = k === "all" ? processes.length : processes.filter(p => p.status === k).length;
    return acc;
  }, {});

  const filtered = processes.filter(p => {
    if (statusTab !== "all" && p.status !== statusTab) return false;
    if (typeF !== "all" && p.type !== typeF) return false;
    if (search && !p.title?.toLowerCase().includes(search.toLowerCase()) &&
        !p.case_number?.toLowerCase().includes(search.toLowerCase()) &&
        !p.radicado_interno?.toLowerCase().includes(search.toLowerCase()) &&
        !p.plaintiff?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });


  return (
    <div className="flex flex-col h-full" style={{ background: "#F7F7F8" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
        <h1 className="text-[22px] font-bold" style={{ color: "#141743" }}>Procesos Jurídicos</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap
                ${viewMode === "list" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </button>
            <button onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap
                ${viewMode === "kanban" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>
              <LayoutGrid className="h-3.5 w-3.5" /> Tablero
            </button>
          </div>
          <Button size="sm" className="text-white gap-1.5 text-xs h-8" style={{ background: "#141743" }} onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo Proceso
          </Button>
        </div>
      </div>

      {/* Pill navigation */}
      <div className="px-5 py-3 shrink-0">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([k, v]) => {
            const active = statusTab === k;
            return (
              <button key={k} onClick={() => setStatusTab(k)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
                  active ? "text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                }`}
                style={active ? { background: "#141743" } : {}}>
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {counts[k]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 space-y-3">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input placeholder="Buscar por título, radicado o demandante..." className="pl-8 h-8 text-xs bg-white border-slate-200" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={typeF} onChange={e => setTypeF(e.target.value)}
            className="h-8 text-xs bg-white border border-slate-200 rounded-md px-2 cursor-pointer focus:outline-none">
            <option value="all">Todos los tipos</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" />
          </div>
        ) : viewMode === "kanban" ? (
          <ProcessKanbanBoard processes={filtered} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {STATUS_CONFIG[statusTab]?.label} — {filtered.length} proceso{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left">Proceso / Título</th>
                      <th className="px-4 py-2.5 text-left">Radicado Int.</th>
                      <th className="px-4 py-2.5 text-left">Radicado Ext.</th>
                      <th className="px-4 py-2.5 text-left">Tipo</th>
                      <th className="px-4 py-2.5 text-left">Partes</th>
                      <th className="px-4 py-2.5 text-left">Juzgado / Entidad</th>
                      <th className="px-4 py-2.5 text-left">Etapa Actual</th>
                      <th className="px-4 py-2.5 text-left">Abogado</th>
                      <th className="px-4 py-2.5 text-center">Prioridad</th>
                      <th className="px-4 py-2.5 text-center">Vencimiento</th>
                      <th className="px-4 py-2.5 text-center">Estado</th>
                      <th className="px-4 py-2.5 text-center">Ver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, idx) => {
                      const st = STATUS_CONFIG[p.status];
                      const tc = TYPE_CONFIG[p.type];
                      const pc = p.priority ? PRIO_CONFIG[p.priority] : null;
                      let deadlineBadge = null;
                      if (p.next_deadline) {
                        const days = differenceInDays(parseISO(p.next_deadline), new Date());
                        deadlineBadge = days < 0
                          ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">VENCIDO</span>
                          : days === 0 ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-400 text-white">HOY</span>
                          : days <= 5 ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white">{days}d</span>
                          : <span className="text-xs text-muted-foreground font-mono">{fmtDate(p.next_deadline)}</span>;
                      }
                      return (
                        <tr key={p.id} className={`border-t border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                          <td className="px-4 py-2.5 font-semibold max-w-[200px] truncate text-xs">{p.title}</td>
                          <td className="px-4 py-2.5">
                            {p.radicado_interno
                              ? <span className="font-mono text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">{p.radicado_interno}</span>
                              : <span className="text-muted-foreground text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{p.case_number || "—"}</td>
                          <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${tc?.color}`}>{tc?.label}</span></td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground max-w-[150px]">
                            {p.plaintiff && <div className="truncate">{p.plaintiff}</div>}
                            {p.defendant && <div className="truncate text-muted-foreground/70">vs {p.defendant}</div>}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground max-w-[140px] truncate">{p.judge_entity || "—"}</td>
                          <td className="px-4 py-2.5 text-[11px] max-w-[120px] truncate">{p.current_stage || "—"}</td>
                          <td className="px-4 py-2.5 text-[11px] max-w-[120px] truncate text-muted-foreground">{p.assigned_lawyer_name || "—"}</td>
                          <td className="px-4 py-2.5 text-center">{pc ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pc.color}`}>{pc.label}</span> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-2.5 text-center">{deadlineBadge || <span className="text-muted-foreground text-[11px]">—</span>}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className={`h-7 w-7 rounded-lg flex items-center justify-center mx-auto ${st?.light}`}>
                              <st.icon className="h-4 w-4" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Link to={`/process/${p.id}`} className="inline-flex">
                              <ChevronRight className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-14">
                <Briefcase className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No se encontraron procesos</p>
                {statusTab === "all" && !search && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                    Registrar primer proceso
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ProcessForm
        open={showForm}
        onOpenChange={setShowForm}
        process={null}
        onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["processes"] }); }}
      />
    </div>
  );
}