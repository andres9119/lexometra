import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { sanitizeName } from "@/utils/textFormat";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const METHODS = [
  { value: "transferencia", label: "Transferencia" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "efectivo", label: "Efectivo" },
  { value: "cheque", label: "Cheque" },
  { value: "otro", label: "Otro" },
];

export default function CommissionPaymentForm({ open, onOpenChange, referrer, pendingAmount, pendingInvoices, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "transferencia",
    reference: "",
    notes: "",
    receipt_url: "",
  });
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.CommissionPayment.create({
        ...data,
        referrer_id: referrer.id,
        referrer_name: sanitizeName(referrer.full_name),
        invoice_ids: pendingInvoices.map(i => i.id),
        created_by_name: user?.full_name || "Sistema",
      });
    },
    onSuccess: () => {
      toast.success("Pago registrado correctamente");
      qc.invalidateQueries({ queryKey: ["commission_payments"] });
      onSuccess?.();
      onOpenChange(false);
      setForm({ amount: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "transferencia", reference: "", notes: "", receipt_url: "" });
    },
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set("receipt_url", file_url);
    setUploading(false);
    toast.success("Comprobante cargado");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return toast.error("Ingrese un monto válido");
    mutation.mutate({ ...form, amount: Number(form.amount) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Registrar pago de comisión</DialogTitle>
        </DialogHeader>

        {referrer && (
          <div className="bg-muted/40 rounded-lg px-3 py-2 mb-1">
            <p className="text-xs text-muted-foreground">Referidor</p>
            <p className="font-semibold text-sm">{sanitizeName(referrer.full_name)}</p>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">Comisión pendiente</span>
              <span className="text-sm font-bold text-amber-600">{fmt(pendingAmount)}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Monto a pagar (COP) *</Label>
              <Input
                type="number"
                placeholder={`Máx. ${fmt(pendingAmount)}`}
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de pago *</Label>
              <Input type="date" value={form.payment_date} onChange={e => set("payment_date", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Método *</Label>
              <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referencia / Comprobante #</Label>
              <Input placeholder="No. transacción" value={form.reference} onChange={e => set("reference", e.target.value)} className="h-8 text-sm" />
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-1">
            <Label className="text-xs">Adjuntar comprobante</Label>
            {form.receipt_url ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5 text-xs">
                <a href={form.receipt_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline truncate">Ver comprobante</a>
                <button type="button" onClick={() => set("receipt_url", "")} className="ml-2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted/30 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Subiendo..." : "Seleccionar archivo (JPG, PDF)"}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas</Label>
            <Textarea placeholder="Observaciones del pago..." value={form.notes} onChange={e => set("notes", e.target.value)} className="text-xs min-h-[60px]" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm" className="flex-1 h-8 text-xs" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando..." : "Registrar pago"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}