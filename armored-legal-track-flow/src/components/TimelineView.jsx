import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CheckCircle, Clock, Circle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const ICONS = { completada: CheckCircle, en_curso: Clock, pendiente: Circle };
const COLORS = { completada: "text-emerald-500", en_curso: "text-amber-500", pendiente: "text-muted-foreground" };
const LABELS = { completada: "Completada", en_curso: "En curso", pendiente: "Pendiente" };

export default function TimelineView({ stages, onEdit, processId }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id) => base44.entities.ProcessStage.delete(id),
    onSuccess: () => { toast.success("Etapa eliminada"); qc.invalidateQueries({ queryKey: ["stages", processId] }); }
  });

  if (!stages.length) return (
    <div className="text-center py-12 border rounded-xl bg-card">
      <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">Aún no hay etapas registradas</p>
      <p className="text-xs text-muted-foreground mt-1">Agrega la primera actuación del proceso</p>
    </div>
  );

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
      {stages.map((s) => {
        const Icon = ICONS[s.status] || Circle;
        return (
          <div key={s.id} className="relative pb-6 last:pb-0">
            <div className={`absolute left-[-17px] top-1 ${COLORS[s.status]}`}>
              <Icon className="h-5 w-5 fill-background" />
            </div>
            <div className="bg-card border rounded-xl p-4 ml-4 group hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm">{s.stage_name}</span>
                    <Badge variant="outline" className="text-xs">{LABELS[s.status]}</Badge>
                  </div>
                  {s.date && <p className="text-xs text-muted-foreground">{format(parseISO(s.date), "d 'de' MMMM, yyyy", { locale: es })}</p>}
                  {s.description && <p className="text-sm text-muted-foreground mt-2">{s.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(s)}><Edit className="h-3 w-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>¿Eliminar etapa?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente esta etapa.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(s.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}