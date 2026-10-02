import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const EMPTY = {
  type: "tutela",
  title: "",
  case_number: "",
  plaintiff: "",
  defendant: "",
  judge_entity: "",
  status: "activo",
  current_stage: "",
  start_date: "",
  priority: "media",
  description: "",
  notes: "",
  next_deadline: "",
  assigned_lawyer_id: "",
  assigned_lawyer_name: "",
  macro_process_id: "",
  contrato_autenticado: false,
  habilitado_juridico: false,
  datos_especificos: {},
};

export default function ProcessForm({ open, onOpenChange, process, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [autoAssign, setAutoAssign] = useState(false);
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      // Sanitize null values to empty strings to avoid controlled/uncontrolled warnings
      const sanitized = process
        ? Object.fromEntries(Object.entries({ ...EMPTY, ...process }).map(([k, v]) => [k, v ?? ""]))
        : { ...EMPTY };
      setForm(sanitized);
      setAutoAssign(false);
    }
  }, [open, process]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: async (data) => {
      if (process?.id) return base44.entities.Process.update(process.id, data);
      // Generate radicado_interno automatically
      try {
        const radRes = await base44.functions.invoke("generateRadicado", {});
        data.radicado_interno = radRes?.data?.radicado_interno || null;
      } catch { /* non-blocking */ }
      // Auto-assign: pick lawyer with lowest workload
      if (autoAssign && users.length > 0) {
        try {
          const res = await base44.functions.invoke("getWorkloadBalance", {});
          const workload = res?.data?.workload || [];
          if (workload.length > 0) {
            const best = workload[0];
            data.assigned_lawyer_id = best.id;
            data.assigned_lawyer_name = best.nombre;
          }
        } catch { /* fallback: skip auto-assign */ }
      }
      const created = await base44.entities.Process.create(data);
      try { base44.functions.invoke("notifySharePointProcess", { process_data: created }); } catch {}
      return created;
    },
    onSuccess: () => {
      toast.success(process?.id ? "Proceso actualizado" : "Proceso creado");
      qc.invalidateQueries({ queryKey: ["processes"] });
      onSuccess?.();
    },
    onError: (e) => toast.error("Error: " + e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title?.trim()) { toast.error("El título es obligatorio"); return; }
    saveMut.mutate({ ...form });
  };

  const isNew = !process?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuevo Proceso Jurídico" : "Editar Proceso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Tipo y Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo de proceso *</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutela">Acción de Tutela</SelectItem>
                  <SelectItem value="derecho_peticion">Derecho de Petición</SelectItem>
                  <SelectItem value="recurso">Recurso</SelectItem>
                  <SelectItem value="incidente_desacato">Incidente de Desacato</SelectItem>
                  <SelectItem value="eliminacion_reportes">Eliminación de Reportes</SelectItem>
                  <SelectItem value="proteccion_consumidor">Protección al Consumidor</SelectItem>
                  <SelectItem value="superfinanciera">Superfinanciera</SelectItem>
                  <SelectItem value="sic">SIC</SelectItem>
                  <SelectItem value="ejecutivo">Proceso Ejecutivo</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Estado *</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="en_tramite">En Trámite</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="archivado">Archivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1">
            <Label>Título del proceso *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ej: Tutela vs Banco XYZ" />
          </div>

          {/* Radicado interno (readonly) + Radicado externo + Prioridad */}
          {process?.radicado_interno && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Radicado Interno</span>
              <Badge variant="outline" className="font-mono text-sm font-bold tracking-widest">{process.radicado_interno}</Badge>
              <span className="text-[10px] text-slate-400 ml-auto">Auto-generado · Solo lectura</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Radicado externo <span className="text-muted-foreground font-normal text-xs">(juzgado / entidad)</span></Label>
              <Input value={form.case_number} onChange={e => set("case_number", e.target.value)} placeholder="Ej: 2024-00123" />
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

          {/* Partes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Demandante / Accionante</Label>
              <Input value={form.plaintiff} onChange={e => set("plaintiff", e.target.value)} placeholder="Nombre del accionante" />
            </div>
            <div className="space-y-1">
              <Label>Demandado / Accionado</Label>
              <Input value={form.defendant} onChange={e => set("defendant", e.target.value)} placeholder="Nombre del accionado" />
            </div>
          </div>

          {/* Juzgado y Etapa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Juzgado / Entidad</Label>
              <Input value={form.judge_entity} onChange={e => set("judge_entity", e.target.value)} placeholder="Juzgado o entidad" />
            </div>
            <div className="space-y-1">
              <Label>Etapa actual</Label>
              <Input value={form.current_stage} onChange={e => set("current_stage", e.target.value)} placeholder="Ej: Radicación, Admisión, Fallo..." />
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

          {/* Abogado asignado */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Abogado asignado</Label>
              {isNew && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={autoAssign} onChange={e => setAutoAssign(e.target.checked)} className="rounded" />
                  Asignación automática (menor carga)
                </label>
              )}
            </div>
            <Select
              value={form.assigned_lawyer_id || "none"}
              onValueChange={v => {
                if (v === "none") { set("assigned_lawyer_id", ""); set("assigned_lawyer_name", ""); return; }
                const u = users.find(x => x.id === v);
                set("assigned_lawyer_id", v);
                set("assigned_lawyer_name", u?.full_name || "");
              }}
              disabled={isNew && autoAssign}
            >
              <SelectTrigger><SelectValue placeholder={isNew && autoAssign ? "Se asignará automáticamente" : "Seleccionar abogado"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción y Notas */}
          <div className="space-y-1">
            <Label>Descripción del caso</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Resumen del caso..." rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Notas adicionales</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notas internas..." rows={2} />
          </div>

          {/* ── Campos dinámicos según tipo de proceso (Ejecutivo) ── */}
          {(form.type === "ejecutivo") && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 mb-1">Datos Específicos — Proceso Ejecutivo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Juzgado de conocimiento</Label>
                  <Input value={form.datos_especificos?.juzgado_ejecutivo || ""}
                    onChange={e => set("datos_especificos", { ...form.datos_especificos, juzgado_ejecutivo: e.target.value })}
                    placeholder="Juzgado Civil del Circuito de..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuantía de la demanda (COP)</Label>
                  <Input type="number" value={form.datos_especificos?.cuantia || ""}
                    onChange={e => set("datos_especificos", { ...form.datos_especificos, cuantia: e.target.value })}
                    placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Acreedor (Demandante)</Label>
                  <Input value={form.datos_especificos?.acreedor || ""}
                    onChange={e => set("datos_especificos", { ...form.datos_especificos, acreedor: e.target.value })}
                    placeholder="Nombre del acreedor" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deudor (Demandado)</Label>
                  <Input value={form.datos_especificos?.deudor || ""}
                    onChange={e => set("datos_especificos", { ...form.datos_especificos, deudor: e.target.value })}
                    placeholder="Nombre del deudor" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Título ejecutivo (obligación base)</Label>
                  <Input value={form.datos_especificos?.titulo_ejecutivo || ""}
                    onChange={e => set("datos_especificos", { ...form.datos_especificos, titulo_ejecutivo: e.target.value })}
                    placeholder="Pagaré, letra de cambio, sentencia..." />
                </div>
              </div>
            </div>
          )}

          {/* ── Políticas de Handoff Comercial → Jurídico ── */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-700 mb-1">Políticas de Handoff — Habilitación Jurídica</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.contrato_autenticado}
                  onChange={e => set("contrato_autenticado", e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium">Contrato autenticado recibido</p>
                  <p className="text-[11px] text-muted-foreground">El original firmado y autenticado fue entregado a la firma</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.habilitado_juridico}
                  onChange={e => set("habilitado_juridico", e.target.checked)}
                  className="w-4 h-4 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium">Habilitado para módulo jurídico</p>
                  <p className="text-[11px] text-muted-foreground">Activa la visibilidad del expediente para el equipo jurídico (requiere pago registrado + contrato)</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? "Guardando..." : (isNew ? "Crear Proceso" : "Guardar Cambios")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}