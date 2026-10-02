import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const TYPE_LABELS = {
  tutela:    "Acción de Tutela",
  peticion:  "Derecho de Petición",
  recurso:   "Recurso (Apelación / Reposición)",
  queja_sic: "Queja SIC",
  demanda:   "Demanda Civil",
  incidente: "Incidente (Nulidad / Desacato)",
  otro:      "Otro trámite",
};

const EMPTY = {
  type: "tutela",
  title: "",
  judge_entity: "",
  status: "activo",
  priority: "media",
  case_number: "",
  start_date: "",
  next_deadline: "",
  notes: "",
  };

export default function LegalActionForm({ open, onOpenChange, macroProcessId, action, processType, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const qc = useQueryClient();
  const isEdit = !!action?.id;

  useEffect(() => {
    if (open) setForm(action ? Object.fromEntries(Object.entries({ ...EMPTY, ...action }).map(([k, v]) => [k, v ?? ""])) : { ...EMPTY });
  }, [open, action]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.LegalAction.update(action.id, data)
      : base44.entities.LegalAction.create({ ...data, macro_process_id: macroProcessId }),
    onSuccess: () => {
      toast.success(isEdit ? "Actuación actualizada" : "Actuación creada");
      qc.invalidateQueries({ queryKey: ["legal_actions", macroProcessId] });
      onSuccess?.();
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.type) { toast.error("Selecciona el tipo de actuación"); return; }
    mut.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Actuación" : "Nueva Actuación Jurídica"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">

          {/* Tipo */}
          <div className="space-y-1">
            <Label>Tipo de trámite *</Label>
            <Select value={form.type} onValueChange={v => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <Label>Título / Descripción corta</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ej: Tutela contra Bancolombia por reporte negativo" />
          </div>

          {/* Entidad + Radicado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Entidad / Juzgado accionado</Label>
              <Input value={form.judge_entity} onChange={e => set("judge_entity", e.target.value)} placeholder="Ej: Juzgado 3 Civil" />
            </div>
            <div className="space-y-1">
              <Label>Número de radicado</Label>
              <Input value={form.case_number} onChange={e => set("case_number", e.target.value)} placeholder="Ej: 2024-00123" />
            </div>
          </div>

          {/* Estado + Prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="en_tramite">En trámite</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="archivado">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridad</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Próximo vencimiento</Label>
              <Input type="date" value={form.next_deadline} onChange={e => set("next_deadline", e.target.value)} />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Notas internas de esta actuación..." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear Actuación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}