import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sanitizeFormData } from "@/utils/textFormat";

const empty = { full_name: "", cc: "", phone: "", email: "", commission_percent: 10, bank_name: "", bank_account: "", account_type: "ahorros", status: "activo", notes: "" };

export default function ReferrerForm({ open, onOpenChange, referrer, onSuccess }) {
  const [form, setForm] = useState(empty);
  useEffect(() => { setForm(referrer ? { ...empty, ...referrer } : empty); }, [referrer, open]);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: (d) => {
      const sanitized = sanitizeFormData(d, ["full_name", "bank_name"]);
      const data = { ...sanitized, commission_percent: parseFloat(d.commission_percent) || 0 };
      return referrer ? base44.entities.Referrer.update(referrer.id, data) : base44.entities.Referrer.create(data);
    },
    onSuccess: () => { toast.success(referrer ? "Referidor actualizado" : "Referidor registrado"); onSuccess?.(); },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.cc.trim()) return toast.error("Nombre y cédula son requeridos");
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{referrer ? "Editar Referidor" : "Nuevo Referidor"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre completo *</Label><Input value={form.full_name} onChange={e => set("full_name", e.target.value)} /></div>
            <div><Label>Cédula *</Label><Input value={form.cc} onChange={e => set("cc", e.target.value)} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div><Label>Correo</Label><Input value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Comisión (%)</Label><Input type="number" min="0" max="100" value={form.commission_percent} onChange={e => set("commission_percent", e.target.value)} /></div>
            <div><Label>Banco</Label><Input value={form.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder="Bancolombia" /></div>
            <div><Label>No. Cuenta</Label><Input value={form.bank_account} onChange={e => set("bank_account", e.target.value)} /></div>
            <div><Label>Tipo cuenta</Label>
              <Select value={form.account_type} onValueChange={v => set("account_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ahorros","corriente","nequi","daviplata","otro"].map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Estado</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="activo">Activo</SelectItem><SelectItem value="inactivo">Inactivo</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Guardando..." : referrer ? "Actualizar" : "Registrar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}