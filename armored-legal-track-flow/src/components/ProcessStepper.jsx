import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Paperclip, CheckCircle2, Circle, Clock, Plus, AlertTriangle, Calendar } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { es } from "date-fns/locale";
import DocViewer from "@/components/DocViewer";

const STATUS_CONFIG = {
  completada: {
    icon: CheckCircle2,
    nodeClass: "bg-emerald-500 border-emerald-500 text-white",
    lineClass: "bg-emerald-300",
    cardClass: "border-emerald-200 bg-emerald-50/30",
    label: "Completada",
    labelClass: "bg-emerald-100 text-emerald-700",
  },
  en_curso: {
    icon: Clock,
    nodeClass: "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
    lineClass: "bg-border",
    cardClass: "border-primary/30 bg-primary/5 shadow-md",
    label: "En curso",
    labelClass: "bg-primary/10 text-primary",
  },
  pendiente: {
    icon: Circle,
    nodeClass: "bg-background border-border text-muted-foreground",
    lineClass: "bg-border",
    cardClass: "border-border bg-card opacity-70",
    label: "Pendiente",
    labelClass: "bg-muted text-muted-foreground",
  },
};

const fmtDate = (d) => {
  try { return format(parseISO(d), "d 'de' MMMM, yyyy", { locale: es }); } catch { return null; }
};

function AttachmentList({ attachments }) {
  const [viewerDoc, setViewerDoc] = useState(null);
  return (
    <>
      <div className="mt-3 pt-3 border-t border-inherit flex flex-wrap gap-2">
        {attachments.map((att, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setViewerDoc({ url: att.url, name: att.name || "Documento" })}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border bg-background text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            <Paperclip className="h-3 w-3" />
            {att.name || "Documento"}
          </button>
        ))}
      </div>
      <DocViewer doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </>
  );
}

function StageNode({ stage, isLast, onEdit, processId }) {
  const qc = useQueryClient();
  const cfg = STATUS_CONFIG[stage.status] || STATUS_CONFIG.pendiente;
  const Icon = cfg.icon;

  const delMut = useMutation({
    mutationFn: () => base44.entities.ProcessStage.delete(stage.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", processId] });
      toast.success("Etapa eliminada");
    },
  });

  return (
    <div className="flex gap-4">
      {/* Timeline column: node + vertical line */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 32 }}>
        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 z-10 shrink-0 ${cfg.nodeClass}`}>
          <Icon className="h-4 w-4" strokeWidth={stage.status === "en_curso" ? 2.5 : 2} />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 min-h-[32px] ${cfg.lineClass}`} />
        )}
      </div>

      {/* Card content */}
      <div className={`flex-1 mb-6 rounded-xl border p-4 transition-all ${cfg.cardClass}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className={`text-sm font-bold ${stage.status === "en_curso" ? "text-primary" : "text-foreground"}`}>
                {stage.stage_name}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.labelClass}`}>
                {cfg.label}
              </span>
              {stage.order != null && (
                <span className="text-[10px] text-muted-foreground font-mono">#{stage.order}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              {stage.date && (
                <p className="text-xs text-muted-foreground">{fmtDate(stage.date)}</p>
              )}
              {stage.term_deadline && (() => {
                const days = differenceInDays(parseISO(stage.term_deadline), new Date());
                const cls = days < 0
                  ? "text-red-700 bg-red-50 border-red-200"
                  : days === 0 ? "text-red-700 bg-red-50 border-red-200"
                  : days <= 5 ? "text-orange-600 bg-orange-50 border-orange-200"
                  : "text-muted-foreground bg-muted border-border";
                const label = days < 0 ? "Término VENCIDO"
                  : days === 0 ? "Término: HOY"
                  : `Término: ${fmtDate(stage.term_deadline)}`;
                return (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${cls}`}>
                    {days <= 5 ? <AlertTriangle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                    {label}
                  </span>
                );
              })()}
            </div>
            {stage.description && (
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {stage.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(stage)}
            >
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
                  <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => delMut.mutate()} className="bg-destructive text-destructive-foreground">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Attachments — open native DocViewer on click */}
        {stage.attachments?.length > 0 && (
          <AttachmentList attachments={stage.attachments} />
        )}
      </div>
    </div>
  );
}

export default function ProcessStepper({ stages, onEdit, processId, onAdd, sharepointUrl }) {
  const sorted = [...stages].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-base">Historial del Proceso</h3>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Agregar etapa
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No hay etapas registradas aún</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onAdd}>
            Registrar primera etapa
          </Button>
        </div>
      ) : (
        <div>
          {sorted.map((stage, idx) => (
            <StageNode
              key={stage.id}
              stage={stage}
              isLast={idx === sorted.length - 1}
              onEdit={onEdit}
              processId={processId}
            />
          ))}
        </div>
      )}
    </div>
  );
}