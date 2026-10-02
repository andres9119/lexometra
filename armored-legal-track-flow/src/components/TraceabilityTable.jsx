import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Edit, Trash2, CheckCircle2, Clock, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const STATUS = {
  completada: { label: "Completada", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  en_curso:   { label: "En curso",   color: "bg-blue-100 text-blue-700",    icon: Loader2 },
  pendiente:  { label: "Pendiente",  color: "bg-slate-100 text-slate-600",  icon: Clock },
};

function formatDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: es }); } catch { return d; }
}

export default function TraceabilityTable({ stages = [], onEdit, processId }) {
  const qc = useQueryClient();

  const delMut = useMutation({
    mutationFn: (stageId) => base44.entities.ProcessStage.delete(stageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stages", processId] }),
  });

  if (stages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <p className="font-medium">Sin etapas registradas</p>
        <p className="text-sm mt-1">Agrega hitos para llevar la trazabilidad del proceso.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-10">#</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Hito / Etapa</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-32">Fecha</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-32">Estado</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Observaciones</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-36">Documentos</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-20">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {stages.map((stage, idx) => {
            const st = STATUS[stage.status] || STATUS.pendiente;
            const Icon = st.icon;
            return (
              <tr key={stage.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{stage.order ?? idx + 1}</td>
                <td className="px-3 py-3 font-medium">{stage.stage_name}</td>
                <td className="px-3 py-3 text-muted-foreground tabular-nums">{formatDate(stage.date)}</td>
                <td className="px-3 py-3">
                  <Badge className={`${st.color} gap-1 font-normal text-xs`}>
                    <Icon className="h-3 w-3" />
                    {st.label}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-muted-foreground max-w-xs">
                  <span className="line-clamp-2">{stage.description || "—"}</span>
                </td>
                <td className="px-3 py-3">
                  {stage.attachments?.length > 0 ? (
                    <div className="space-y-1">
                      {stage.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[120px]">
                          <Paperclip className="h-3 w-3 shrink-0" />{att.name}
                        </a>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1 justify-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(stage)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminará "{stage.stage_name}" permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => delMut.mutate(stage.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}