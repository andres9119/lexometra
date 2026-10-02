import { useMemo } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Scale, TrendingUp } from "lucide-react";

const TYPE_LABELS = {
  tutela:    "Tutela",
  peticion:  "Petición",
  recurso:   "Recurso",
  queja_sic: "Queja SIC",
  demanda:   "Demanda",
  incidente: "Incidente",
  otro:      "Otro",
};

// Compute the "radar card" for each unique entity (judge_entity)
function buildEntityCards(legalActions) {
  const map = {};

  for (const action of legalActions) {
    const key = (action.judge_entity || "Sin entidad").trim();
    if (!map[key]) {
      map[key] = { entity: key, actions: [] };
    }
    map[key].actions.push(action);
  }

  return Object.values(map).map(({ entity, actions }) => {
    // Sort actions: activo/en_tramite first, then by start_date desc
    const sorted = [...actions].sort((a, b) => {
      const order = { activo: 0, en_tramite: 1, finalizado: 2, archivado: 3 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      const da = a.start_date ? new Date(a.start_date) : new Date(0);
      const db = b.start_date ? new Date(b.start_date) : new Date(0);
      return db - da;
    });

    const latest = sorted[0]; // most relevant action
    const activeCount = actions.filter(a => a.status === "activo" || a.status === "en_tramite").length;
    const closedCount = actions.filter(a => a.status === "finalizado" || a.status === "archivado").length;

    // Deadline logic for latest active action
    let deadlineState = null; // "vencido" | "hoy" | "proximo" | "ok" | null
    if (latest?.next_deadline) {
      const days = differenceInDays(parseISO(latest.next_deadline), new Date());
      if (days < 0)       deadlineState = "vencido";
      else if (days === 0) deadlineState = "hoy";
      else if (days <= 5)  deadlineState = "proximo";
      else                 deadlineState = "ok";
    }

    // Overall semantic status
    let semanticStatus;
    if (activeCount === 0 && closedCount > 0) {
      semanticStatus = "resuelto";
    } else if (deadlineState === "vencido" || deadlineState === "hoy") {
      semanticStatus = "critico";
    } else if (activeCount > 0) {
      semanticStatus = "activo";
    } else {
      semanticStatus = "sin_tramite";
    }

    return { entity, latest, actions: sorted, activeCount, closedCount, deadlineState, semanticStatus };
  }).sort((a, b) => {
    // Critical first, then active, then resolved
    const p = { critico: 0, activo: 1, sin_tramite: 2, resuelto: 3 };
    return (p[a.semanticStatus] ?? 9) - (p[b.semanticStatus] ?? 9);
  });
}

const SEMANTIC_CONFIG = {
  critico:    { bar: "bg-red-500",     dot: "bg-red-500",     label: "Crítico",    text: "text-red-600",    bg: "bg-red-50 border-red-200" },
  activo:     { bar: "bg-amber-400",   dot: "bg-amber-400",   label: "Activo",     text: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  sin_tramite:{ bar: "bg-slate-300",   dot: "bg-slate-400",   label: "Sin trámite",text: "text-slate-500",  bg: "bg-slate-50 border-slate-200" },
  resuelto:   { bar: "bg-emerald-500", dot: "bg-emerald-500", label: "Resuelto",   text: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200" },
};

const STATUS_LABELS = { activo: "Activo", en_tramite: "En trámite", finalizado: "Finalizado", archivado: "Archivado" };

const DEADLINE_CONFIG = {
  vencido: { icon: AlertTriangle, text: "text-red-600", label: "Vencido" },
  hoy:     { icon: AlertTriangle, text: "text-red-600", label: "Vence hoy" },
  proximo: { icon: Clock,         text: "text-amber-600", label: "Próximo" },
  ok:      { icon: Clock,         text: "text-slate-400", label: "En plazo" },
};

function EntityCard({ card }) {
  const cfg = SEMANTIC_CONFIG[card.semanticStatus] || SEMANTIC_CONFIG.sin_tramite;
  const latestType = card.latest ? (TYPE_LABELS[card.latest.type] || "Actuación") : null;
  const latestStatus = card.latest ? (STATUS_LABELS[card.latest.status] || card.latest.status) : null;

  const dl = card.deadlineState ? DEADLINE_CONFIG[card.deadlineState] : null;
  const DlIcon = dl?.icon;

  return (
    <div className={`relative rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden min-w-0 flex flex-col`}>
      {/* Semantic color bar top */}
      <div className={`h-1 w-full ${cfg.bar}`} />

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Entity name */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-bold text-foreground bg-secondary px-2 py-0.5 rounded-md leading-tight line-clamp-2 max-w-[calc(100%-36px)]">
            {card.entity}
          </span>
          <span className={`shrink-0 flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Row 1: action counts */}
        <div className="flex items-center gap-2 text-[10px]">
          {card.activeCount > 0 && (
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">
              <Scale className="h-2.5 w-2.5" />
              {card.activeCount} activa{card.activeCount !== 1 ? "s" : ""}
            </span>
          )}
          {card.closedCount > 0 && (
            <span className="flex items-center gap-1 text-slate-500 bg-muted px-1.5 py-0.5 rounded-full">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {card.closedCount} cerrada{card.closedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Row 2: latest action type */}
        {latestType && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-foreground/80 font-medium truncate">{latestType}</span>
          </div>
        )}

        {/* Row 3: legal status + deadline */}
        <div className="flex items-center justify-between gap-1 mt-auto pt-1 border-t border-border/40">
          {latestStatus && (
            <span className="text-[10px] text-muted-foreground">{latestStatus}</span>
          )}
          {dl && DlIcon && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${dl.text}`}>
              <DlIcon className="h-3 w-3" />
              {dl.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EntityRadar({ legalActions = [] }) {
  const cards = useMemo(() => buildEntityCards(legalActions), [legalActions]);

  if (cards.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Scale className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Radar de Entidades
        </span>
        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-bold">
          {cards.length}
        </span>
      </div>

      {/* Horizontal scroll container */}
      <div
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`.entity-radar-scroll::-webkit-scrollbar{display:none}`}</style>
        {cards.map(card => (
          <div key={card.entity} className="shrink-0 w-44">
            <EntityCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}