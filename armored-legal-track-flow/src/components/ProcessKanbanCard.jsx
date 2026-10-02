import { Link } from "react-router-dom";
import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { User, ExternalLink, AlertCircle } from "lucide-react";

const TYPE_CONFIG = {
  tutela: { label: "Tutela", color: "bg-violet-100 text-violet-700" },
  sic:    { label: "SIC",    color: "bg-blue-100 text-blue-700" },
  otro:   { label: "Otro",   color: "bg-slate-100 text-slate-600" },
};

const PRIO_COLOR = {
  alta:  "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja:  "bg-slate-100 text-slate-500",
};

export default function ProcessKanbanCard({ process: p, isDragging }) {
  let deadlineEl = null;
  let isUrgent = false;

  if (p.next_deadline) {
    const days = differenceInDays(parseISO(p.next_deadline), new Date());
    isUrgent = days <= 0;
    if (days < 0) {
      deadlineEl = (
        <span className="flex items-center gap-0.5 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">
          <AlertCircle className="h-2.5 w-2.5" /> VENCIDO
        </span>
      );
    } else if (days === 0) {
      deadlineEl = <span className="text-[10px] font-bold bg-red-400 text-white px-1.5 py-0.5 rounded">HOY</span>;
    } else if (days <= 5) {
      deadlineEl = <span className="text-[10px] font-bold bg-orange-400 text-white px-1.5 py-0.5 rounded">{days}d</span>;
    } else {
      deadlineEl = (
        <span className="text-[10px] text-muted-foreground font-mono">
          {format(parseISO(p.next_deadline), "dd/MM/yy", { locale: es })}
        </span>
      );
    }
  }

  return (
    <Link to={`/process/${p.id}`}>
      <div className={`bg-card rounded-lg border p-2.5 cursor-pointer transition-all hover:shadow-md select-none
        ${isDragging ? "shadow-xl ring-2 ring-accent rotate-1 opacity-90" : ""}
        ${isUrgent ? "border-red-300 shadow-red-100" : "border-border"}
      `}>
        {/* Type + Priority badges */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TYPE_CONFIG[p.type]?.color || "bg-slate-100 text-slate-600"}`}>
            {TYPE_CONFIG[p.type]?.label || p.type}
          </span>
          {p.priority && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIO_COLOR[p.priority] || ""}`}>
              {p.priority.toUpperCase()}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-foreground line-clamp-2 mb-1.5 leading-snug">{p.title}</p>

        {/* Radicado */}
        {p.case_number && (
          <p className="text-[10px] font-mono text-muted-foreground mb-1.5">{p.case_number}</p>
        )}

        {/* Plaintiff vs defendant */}
        {p.plaintiff && (
          <p className="text-[10px] text-muted-foreground truncate mb-1">
            {p.plaintiff}{p.defendant ? ` vs ${p.defendant}` : ""}
          </p>
        )}

        {/* SharePoint link */}
        {p.sharepoint_url && (
          <a href={p.sharepoint_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-blue-500 hover:underline mb-1"
            onClick={e => e.stopPropagation()}>
            <ExternalLink className="h-2.5 w-2.5" /> SharePoint
          </a>
        )}

        {/* Footer: lawyer + deadline */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50">
          {p.assigned_lawyer_name ? (
            <div className="flex items-center gap-1 min-w-0">
              <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-2.5 w-2.5 text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">
                {p.assigned_lawyer_name.split(" ")[0]}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">Sin asignar</span>
          )}
          <div>{deadlineEl}</div>
        </div>
      </div>
    </Link>
  );
}