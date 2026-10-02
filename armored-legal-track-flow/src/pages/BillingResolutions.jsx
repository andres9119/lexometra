import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Settings2, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";

const empty = { prefix: "", initial_consecutive: 1, final_consecutive: 500, current_consecutive: 0, expiry_date: "", status: "activa", notes: "" };

const pct = (r) => {
  const range = (r.final_consecutive || 1) - (r.initial_consecutive || 1);
  const used = (r.current_consecutive || 0) - (r.initial_consecutive || 0);
  return range > 0 ? Math.round((used / range) * 100) : 0;
};

export default function BillingResolutions() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: resolutions = [], isLoading } = useQuery({
    queryKey: ["billing_resolutions"],
    queryFn: () => base44.entities.BillingResolution.list("-created_date"),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const save = useMutation({
    mutationFn: (d) => {
      const data = {
        ...d,
        initial_consecutive: parseInt(d.initial_consecutive) || 1,
        final_consecutive: parseInt(d.final_consecutive) || 500,
        current_consecutive: parseInt(d.current_consecutive) || 0,
      };
      return editing
        ? base44.entities.BillingResolution.update(editing.id, data)
        : base44.entities.BillingResolution.create(data);
    },
    onSuccess: () => {
      toast.success(editing ? "Resolución actualizada" : "Resolución creada");
      qc.invalidateQueries({ queryKey: ["billing_resolutions"] });
      setOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id) => base44.entities.BillingResolution.delete(id),
    onSuccess: () => { toast.success("Resolución eliminada"); qc.invalidateQueries({ queryKey: ["billing_resolutions"] }); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.BillingResolution.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing_resolutions"] }),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-xl p-2.5"><Settings2 className="h-5 w-5 text-primary-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold">Resoluciones de Facturación</h1>
            <p className="text-sm text-muted-foreground">Configura prefijos y límites de consecutivos (DIAN)</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Nueva Resolución</Button>
      </div>

      {/* Alert if no active resolution */}
      {!isLoading && resolutions.filter(r => r.status === "activa").length === 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>No hay una resolución activa. Las facturas no podrán asignarse con consecutivo automático hasta que crees una.</span>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>
      ) : resolutions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">No hay resoluciones configuradas</div>
      ) : (
        <div className="space-y-3">
          {resolutions.map(r => {
            const p = pct(r);
            const remaining = (r.final_consecutive || 0) - (r.current_consecutive || 0);
            const atLimit = remaining <= 0;
            const nearLimit = p >= 90 && !atLimit;
            return (
              <div key={r.id} className={`bg-card border rounded-xl p-5 shadow-sm ${atLimit ? "border-red-300 bg-red-50" : nearLimit ? "border-amber-300 bg-amber-50" : "border-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold font-mono text-primary">{r.prefix}</span>
                    <Badge variant={r.status === "activa" ? "default" : "secondary"}>{r.status}</Badge>
                    {atLimit && <Badge className="bg-red-100 text-red-700 border-red-200">Límite alcanzado</Badge>}
                    {nearLimit && <Badge className="bg-amber-100 text-amber-700 border-amber-200">⚠ {p}% usado</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs"
                      onClick={() => toggleStatus.mutate({ id: r.id, status: r.status === "activa" ? "inactiva" : "activa" })}>
                      {r.status === "activa" ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div><p className="text-xs text-muted-foreground">Rango</p><p className="font-semibold font-mono">{r.initial_consecutive} → {r.final_consecutive}</p></div>
                  <div><p className="text-xs text-muted-foreground">Último emitido</p><p className="font-semibold font-mono">{r.current_consecutive || 0}</p></div>
                  <div><p className="text-xs text-muted-foreground">Disponibles</p><p className={`font-semibold ${atLimit ? "text-red-600" : nearLimit ? "text-amber-600" : "text-emerald-600"}`}>{Math.max(remaining, 0)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vencimiento</p><p className="font-semibold">{r.expiry_date || "—"}</p></div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Uso del consecutivo</span><span className="font-bold">{p}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${atLimit ? "bg-red-500" : p >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(p, 100)}%` }} />
                  </div>
                </div>

                {r.notes && <p className="text-xs text-muted-foreground mt-2 italic">{r.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Resolución" : "Nueva Resolución de Facturación"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prefijo *</Label><Input value={form.prefix} onChange={e => set("prefix", e.target.value.toUpperCase())} placeholder="FE" maxLength={10} /></div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="inactiva">Inactiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Consecutivo inicial</Label><Input type="number" value={form.initial_consecutive} onChange={e => set("initial_consecutive", e.target.value)} /></div>
              <div><Label>Consecutivo final</Label><Input type="number" value={form.final_consecutive} onChange={e => set("final_consecutive", e.target.value)} /></div>
              <div><Label>Último emitido</Label><Input type="number" value={form.current_consecutive} onChange={e => set("current_consecutive", e.target.value)} /></div>
            </div>
            <div><Label>Fecha vencimiento resolución</Label><Input type="date" value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} /></div>
            <div><Label>No. Resolución DIAN / Notas</Label><Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Ej: Res. 18764032351234 del 01/01/2024" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.prefix}>
                {save.isPending ? "Guardando..." : editing ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}