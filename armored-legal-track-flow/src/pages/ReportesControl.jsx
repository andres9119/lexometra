import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Search, Filter } from "lucide-react";
import { format, parseISO, isWithinInterval, parseISO as parse } from "date-fns";
import { es } from "date-fns/locale";
import { exportToExcel } from "@/utils/exportExcel";
import { exportToPDF } from "@/utils/exportPDF";

const TYPE_LABELS = {
  tutela:    "Acción de Tutela",
  peticion:  "Derecho de Petición",
  recurso:   "Recurso",
  queja_sic: "Queja SIC",
  demanda:   "Demanda Civil",
  incidente: "Incidente",
  otro:      "Otro",
};

const STATUS_COLORS = {
  activo:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  en_tramite: "bg-amber-100 text-amber-700 border-amber-200",
};

const STATUS_LABELS = { activo: "Activo", en_tramite: "En Trámite" };

const fmtDate = (d) => {
  if (!d) return "—";
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return "—"; }
};

export default function ReportesControl() {
  const [searchText, setSearchText]       = useState("");
  const [filterLawyer, setFilterLawyer]   = useState("all");
  const [filterType, setFilterType]       = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]   = useState("");

  // ── Data fetching ──
  const { data: processes = [], isLoading: loadingP } = useQuery({
    queryKey: ["processes-report"],
    queryFn: () => base44.entities.Process.list(),
  });

  const { data: legalActions = [], isLoading: loadingA } = useQuery({
    queryKey: ["legal-actions-report"],
    queryFn: () => base44.entities.LegalAction.list(),
  });

  const { data: stages = [], isLoading: loadingS } = useQuery({
    queryKey: ["stages-report"],
    queryFn: () => base44.entities.ProcessStage.list("-date", 2000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const isLoading = loadingP || loadingA || loadingS;

  // ── Build rows: JOIN LegalAction + Process + last Stage ──
  const rows = useMemo(() => {
    if (isLoading) return [];

    const processMap = Object.fromEntries(processes.map(p => [p.id, p]));
    const userMap    = Object.fromEntries(users.map(u => [u.id, u]));

    // Group stages by legal_action / process
    const stagesByAction  = {};
    const stagesByProcess = {};
    for (const s of stages) {
      // Stages are linked to process_id (which can be a LegalAction id or macro process id)
      if (!stagesByAction[s.process_id])  stagesByAction[s.process_id]  = [];
      if (!stagesByProcess[s.process_id]) stagesByProcess[s.process_id] = [];
      stagesByAction[s.process_id].push(s);
      stagesByProcess[s.process_id].push(s);
    }

    const getLastStage = (id) => {
      const list = stagesByAction[id] || [];
      if (!list.length) return null;
      return list.sort((a, b) => {
        const da = a.date ? new Date(a.date) : new Date(0);
        const db = b.date ? new Date(b.date) : new Date(0);
        return db - da;
      })[0];
    };

    // Filter active/en_tramite legal actions
    const activeActions = legalActions.filter(
      a => a.status === "activo" || a.status === "en_tramite"
    );

    return activeActions.map(action => {
      const macro     = processMap[action.macro_process_id] || {};
      const lastStage = getLastStage(action.id);
      const lawyer    = userMap[macro.assigned_lawyer_id] || null;
      const lawyerName = macro.assigned_lawyer_name ||
        (lawyer ? lawyer.full_name : "Sin asignar");

      return {
        id:           action.id,
        cliente:      macro.title || macro.plaintiff || "—",
        tipo:         TYPE_LABELS[action.type] || action.type || "—",
        tipo_key:     action.type,
        entidad:      action.judge_entity || "—",
        radicado:     action.case_number || "—",
        etapa:        lastStage?.stage_name || action.notes || "—",
        vencimiento:  lastStage?.term_deadline || action.next_deadline || null,
        abogado:      lawyerName,
        abogado_id:   macro.assigned_lawyer_id || "",
        status:       action.status,
        macro_id:     action.macro_process_id,
      };
    });
  }, [processes, legalActions, stages, users, isLoading]);

  // ── Unique lawyers for filter ──
  const lawyers = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const r of rows) {
      if (!seen.has(r.abogado)) { seen.add(r.abogado); list.push(r.abogado); }
    }
    return list.sort();
  }, [rows]);

  // ── Apply filters ──
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (searchText && !`${r.cliente} ${r.entidad} ${r.radicado}`.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterLawyer !== "all" && r.abogado !== filterLawyer) return false;
      if (filterType   !== "all" && r.tipo_key !== filterType)  return false;
      if (filterDateFrom || filterDateTo) {
        if (!r.vencimiento) return false;
        const d = new Date(r.vencimiento);
        if (filterDateFrom && d < new Date(filterDateFrom)) return false;
        if (filterDateTo   && d > new Date(filterDateTo))   return false;
      }
      return true;
    });
  }, [rows, searchText, filterLawyer, filterType, filterDateFrom, filterDateTo]);

  const handleExcelExport = () => exportToExcel(filtered);
  const handlePDFExport   = () => exportToPDF(filtered);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Centro de Control · Reportes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Actuaciones jurídicas activas y en trámite — {filtered.length} registros
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExcelExport} disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Exportar Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePDFExport} disabled={!filtered.length}>
            <FileText className="h-4 w-4 text-red-500" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-end p-3 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Buscar por cliente, entidad o radicado..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <Select value={filterLawyer} onValueChange={setFilterLawyer}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Abogado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los abogados</SelectItem>
            {lawyers.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder="Tipo de actuación" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) =>
              <SelectItem key={k} value={k}>{v}</SelectItem>
            )}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Vencimiento:</span>
          <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-8 w-36 text-sm" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="date" value={filterDateTo}   onChange={e => setFilterDateTo(e.target.value)}   className="h-8 w-36 text-sm" />
        </div>

        {(filterLawyer !== "all" || filterType !== "all" || filterDateFrom || filterDateTo || searchText) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
            setSearchText(""); setFilterLawyer("all"); setFilterType("all");
            setFilterDateFrom(""); setFilterDateTo("");
          }}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* ── Data Grid ── */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Cliente / Expediente</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Tipo Actuación</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Entidad / Juzgado</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Radicado</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Última Etapa</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Vencimiento</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Abogado</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <div className="flex justify-center"><div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
                    <p className="mt-2 text-sm">Cargando datos...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                    No hay actuaciones que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const isExpired = row.vencimiento && new Date(row.vencimiento) < new Date();
                  const isSoon    = row.vencimiento && !isExpired &&
                    (new Date(row.vencimiento) - new Date()) < 7 * 24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-border transition-colors hover:bg-muted/40 ${
                        idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium max-w-[200px] truncate">{row.cliente}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                          {row.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate uppercase">{row.entidad}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{row.radicado}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate">{row.etapa}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.vencimiento ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            isExpired ? "bg-red-100 text-red-700"
                            : isSoon   ? "bg-amber-100 text-amber-700"
                            :            "bg-emerald-50 text-emerald-700"
                          }`}>
                            {fmtDate(row.vencimiento)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                            {row.abogado.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-sm">{row.abogado}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs border ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {STATUS_LABELS[row.status] || row.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground text-right">
            {filtered.length} actuación{filtered.length !== 1 ? "es" : ""} mostrada{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}