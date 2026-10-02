import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Phone, Mail, FileText, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const fmtDateTime = (d) => { try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: es }); } catch { return d; } };

const ACTIVITY_ICONS = {
  comentario: MessageSquare, llamada: Phone, correo: Mail,
  documento: FileText, pago: CheckCircle2, estado: AlertCircle, reunion: MessageSquare
};

export default function ClientActivityExpanded() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [activityType, setActivityType] = useState("comentario");

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: () => base44.entities.Client.get(id)
  });

  const { data: activities = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["activities", id],
    queryFn: () => base44.entities.ClientActivity.filter({ client_id: id }, "-created_date")
  });

  const addActivity = useMutation({
    mutationFn: (d) => base44.entities.ClientActivity.create({ ...d, client_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", id] });
      setNewComment("");
      toast.success("Actividad registrada");
    },
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">Actividad del Cliente</h1>
            {client && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {client.full_name} — CC {client.cc}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={"h-3.5 w-3.5 " + (isFetching ? "animate-spin" : "")} />
            Refrescar
          </Button>
        </div>

        {/* Form */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registrar Actividad</p>
          </div>
          <div className="p-4 space-y-2">
            <Textarea
              placeholder="Escribe un comentario o registra una actividad..."
              rows={3}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              className="text-sm resize-none"
            />
            <div className="flex gap-2 items-center justify-between">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["comentario","llamada","correo","reunion","documento","pago","estado"].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={!newComment.trim() || addActivity.isPending}
                onClick={() => addActivity.mutate({ comment: newComment, activity_type: activityType })}
              >
                {addActivity.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Activity list */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && activities.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-20">
            Sin actividad registrada aún
          </div>
        )}

        <div className="space-y-3">
          {activities.map(a => {
            const Icon = ACTIVITY_ICONS[a.activity_type] || MessageSquare;
            return (
              <div key={a.id} className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1 bg-card border border-border rounded-lg p-3">
                  <p className="text-sm">{a.comment}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtDateTime(a.created_date)} · <span className="capitalize">{a.activity_type}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}