import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, ChevronRight, Edit, Trash2, AlertTriangle,
  Landmark, Calendar
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import ProcessStepper from "@/components/ProcessStepper";
import StageForm from "@/components/StageForm";
import ActionDownloadButtons from "@/components/ActionDownloadButtons";

const TYPE_LABELS = {
  tutela:    "Acción de Tutela",
  peticion:  "Derecho de Petición",
  recurso:   "Recurso",
  queja_sic: "Queja SIC",
  demanda:   "Demanda Civil",
  incidente: "Incidente",
  otro:      "Otro",
};

const TYPE_COLORS = {
  tutela:    "bg-violet-100 text-violet-700 border-violet-200",
  peticion:  "bg-blue-100 text-blue-700 border-blue-200",
  recurso:   "bg-orange-100 text-orange-700 border-orange-200",
  queja_sic: "bg-cyan-100 text-cyan-700 border-cyan-200",
  demanda:   "bg-rose-100 text-rose-700 border-rose-200",
  incidente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  otro:      "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_CONFIG = {
  activo:     { label: "Activo",      cls: "bg-emerald-100 text-emerald-700" },
  en_tramite: { label: "En trámite",  cls: "bg-amber-100 text-amber-700" },
  finalizado: { label: "Finalizado",  cls: "bg-slate-100 text-slate-600" },
  archivado:  { label: "Archivado",   cls: "bg-red-100 text-red-600" },
};

const fmtDate = (d) => {
  try { return format(parseISO(d), "d MMM yyyy", { locale: es }); } catch { return null; }
};

export default function LegalActionAccordion({ action, defaultOpen = false, onEdit }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showStage, setShowStage] = useState(false);
  const [editStage, setEditStage] = useState(null);
  const qc = useQueryClient();

  // Stages keyed by legal action ID (not process_id — reusing process_id field as action_id)
  const { data: stages = [] } = useQuery({
    queryKey: ["stages", action.id],
    queryFn: () => base44.entities.ProcessStage.filter({ process_id: action.id }, "order"),
    enabled: open,
  });

  const delMut = useMutation({
    mutationFn: () => base44.entities.LegalAction.delete(action.id),
    onSuccess: () => {
      toast.success("Actuación eliminada");
      qc.invalidateQueries({ queryKey: ["legal_actions", action.macro_process_id] });
    },
  });

  const st = STATUS_CONFIG[action.status] || STATUS_CONFIG.activo;
  const typeColor = TYPE_COLORS[action.type] || TYPE_COLORS.otro;
  const typeLabel = TYPE_LABELS[action.type] || "Actuación";

  // Deadline badge
  let deadlineBadge = null;
  if (action.next_deadline) {
    const days = differenceInDays(parseISO(action.next_deadline), new Date());
    if (days < 0)
      deadlineBadge = <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><AlertTriangle className="h-2.5 w-2.5" />VENCIDO</span>;
    else if (days === 0)
      deadlineBadge = <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full"><AlertTriangle className="h-2.5 w-2.5" />HOY</span>;
    else if (days <= 5)
      deadlineBadge = <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full"><Calendar className="h-2.5 w-2.5" />{days}d</span>;
  }

  return (
    <div className={`rounded-xl border transition-all ${open ? "border-slate-300 shadow-sm" : "border-slate-200"} bg-white overflow-hidden`}>

      {/* ── Accordion Header ── */}
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Chevron */}
        <span className="shrink-0 text-muted-foreground">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>

        {/* Type badge */}
        <span className={`shrink-0 px-2.5 py-1 rounded-md border text-[11px] font-bold ${typeColor}`}>
          {typeLabel}
        </span>

        {/* Title + entity */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{action.title || typeLabel}</p>
          {action.judge_entity && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Landmark className="h-3 w-3 shrink-0" />{action.judge_entity}
              {action.case_number && <span className="font-mono ml-1">· {action.case_number}</span>}
            </p>
          )}
        </div>

        {/* Status + deadline */}
         <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
           {deadlineBadge}
           <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
           <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit(action)}>
             <Edit className="h-3.5 w-3.5" />
           </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar actuación?</AlertDialogTitle>
                <AlertDialogDescription>Se eliminará esta actuación y todas sus etapas. Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => delMut.mutate()} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </button>

      {/* ── Accordion Body ── */}
      {open && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/30">
          {/* Download buttons */}
          <div className="group flex justify-end mb-4 -mx-6 px-6 py-3 border-b border-border/40">
            <ActionDownloadButtons action={action} />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mb-5 pt-3">
            {action.start_date && (
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide text-[10px]">Inicio</span>
                <p>{fmtDate(action.start_date)}</p>
              </div>
            )}
            {action.next_deadline && (
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide text-[10px]">Vencimiento</span>
                <p>{fmtDate(action.next_deadline)}</p>
              </div>
            )}

            {action.notes && (
              <div className="text-xs text-muted-foreground w-full">
                <span className="font-semibold uppercase tracking-wide text-[10px]">Observaciones</span>
                <p className="mt-0.5">{action.notes}</p>
              </div>
            )}
          </div>

          {/* Stepper */}
          <ProcessStepper
            stages={stages}
            processId={action.id}
            sharepointUrl={null}
            onAdd={() => { setEditStage(null); setShowStage(true); }}
            onEdit={(s) => { setEditStage(s); setShowStage(true); }}
          />
        </div>
      )}

      {/* Stage form modal */}
      <StageForm
        open={showStage}
        onOpenChange={setShowStage}
        stage={editStage}
        processId={action.id}
        processType={action.type}
        onSuccess={() => { setShowStage(false); qc.invalidateQueries({ queryKey: ["stages", action.id] }); }}
      />
    </div>
  );
}