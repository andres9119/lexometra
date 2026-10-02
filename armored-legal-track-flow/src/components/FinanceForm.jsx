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

const empty = { concept: "", amount: "", date: "", type: "egreso", payment_method: "", notes: "" };

export default function FinanceForm({ open, onOpenChange, finance, processId, onSuccess }) {
  const [form, setForm] = useState(empty);
  const qc = useQueryClient();

  useEffect(() => {
    setForm(finance ? { ...empty, ...finance, amount: String(finance.amount || "") } : empty);
  }, [finance, open]);

  const mutation = useMutation({
    mutationFn: (d) => finance ? base44.entities.ProcessFinance.update(finance.id, d) : base44.entities.ProcessFinance.create({ ...d, process_id: processId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finances", processId] }); qc.invalidateQueries({ queryKey: ["finances"] }); toast.success(finance ? "Movimiento actualizado" : "Movimiento registrado"); onSuccess?.(); }
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const submit = (e) => {
    e.preventDefault();
    if (!form.concept.trim()) return toast.error("El concepto es requerido");
    if (!form.amount || isNaN(form.amount)) return toast.error("El monto es inválido");
    mutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{finance ? "Editar Movimiento" : "Nuevo Movimiento"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Concepto *</Label><Input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Ej: Honorarios abogado" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto (COP) *</Label><Input type="number" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" /></div>
            <div><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ingreso">Ingreso</SelectItem><SelectItem value="egreso">Egreso</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
            <div><Label>Método de pago</Label><Input value={form.payment_method} onChange={e => set("payment_method", e.target.value)} placeholder="Transferencia" /></div>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Guardando..." : finance ? "Actualizar" : "Registrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}