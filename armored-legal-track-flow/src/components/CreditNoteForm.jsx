import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

const empty = {
  type: "nota_credito",
  value: "",
  invoice_id: "",
  invoice_number: "",
  client_name: "",
  motivo_ajuste: "",
};

export default function CreditNoteForm({ open, onOpenChange, onSuccess }) {
  const [form, setForm] = useState(empty);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 200),
  });
  const { data: currentUser } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  useEffect(() => {
    if (!open) { setForm(empty); setInvoiceSearch(""); setShowInvoiceList(false); }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (d) => base44.entities.CreditNote.create({
      type: d.type,
      value: parseFloat(d.value) || 0,
      invoice_id: d.invoice_id || null,
      invoice_number: d.invoice_number || null,
      client_name: d.client_name || null,
      motivo_ajuste: d.motivo_ajuste,
      created_by_id: currentUser?.id || "sistema",
      created_by_name: currentUser?.full_name || currentUser?.email || "Usuario",
    }),
    onSuccess: () => {
      toast.success("Nota registrada correctamente");
      onSuccess?.();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.value || parseFloat(form.value) <= 0) return toast.error("El valor debe ser mayor a cero");
    if (!form.motivo_ajuste.trim()) return toast.error("El motivo del ajuste es obligatorio para auditoría");
    mutation.mutate(form);
  };

  const filteredInvoices = invoices.filter(inv =>
    invoiceSearch.trim() &&
    ((inv.invoice_number && inv.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
     (inv.client_name && inv.client_name.toLowerCase().includes(invoiceSearch.toLowerCase())))
  ).slice(0, 8);

  const isCredito = form.type === "nota_credito";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={isCredito ? "text-blue-700" : "text-orange-700"}>
            {isCredito ? "📉 Nueva Nota Crédito" : "📈 Nueva Nota Débito"}
          </DialogTitle>
        </DialogHeader>

        <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${isCredito ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{isCredito ? "La nota crédito reduce el valor adeudado al cliente. No altera facturas existentes." : "La nota débito aumenta el valor que el cliente debe a la firma. Requiere justificación clara."}</span>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Nota</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota_credito">Nota Crédito (−)</SelectItem>
                  <SelectItem value="nota_debito">Nota Débito (+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (COP) *</Label>
              <Input type="number" min="0" value={form.value} onChange={e => set("value", e.target.value)} placeholder="0" />
            </div>
          </div>

          <div>
            <Label>Factura afectada</Label>
            <div className="relative">
              <Input
                placeholder="Buscar por No. factura o cliente..."
                value={invoiceSearch}
                onChange={e => {
                  setInvoiceSearch(e.target.value);
                  setShowInvoiceList(true);
                  if (!e.target.value) { set("invoice_id", ""); set("invoice_number", ""); set("client_name", ""); }
                }}
                onFocus={() => setShowInvoiceList(true)}
              />
              {form.invoice_id && (
                <p className="text-[11px] text-emerald-600 mt-0.5">✓ {form.invoice_number} — {form.client_name}</p>
              )}
              {showInvoiceList && filteredInvoices.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredInvoices.map(inv => (
                    <button key={inv.id} type="button"
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-sm border-b border-border/30"
                      onClick={() => {
                        set("invoice_id", inv.id);
                        set("invoice_number", inv.invoice_number || inv.id?.slice(-5));
                        set("client_name", inv.client_name || "");
                        setInvoiceSearch(inv.invoice_number || inv.id?.slice(-5));
                        setShowInvoiceList(false);
                      }}>
                      <span className="font-bold">{inv.invoice_number || "#" + inv.id?.slice(-5)}</span>
                      <span className="text-muted-foreground text-xs ml-2">{inv.client_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>
              Motivo del Ajuste *
              <span className="text-[10px] font-normal text-muted-foreground ml-1">(requerido para auditoría)</span>
            </Label>
            <Textarea
              value={form.motivo_ajuste}
              onChange={e => set("motivo_ajuste", e.target.value)}
              rows={4}
              placeholder="Ej: Devolución por reporte ineliminable según permanencia negativa / Corrección por pago asignado a cédula errada CC 12345678..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Creado por: <strong>{currentUser?.full_name || currentUser?.email || "—"}</strong> — quedará registrado en auditoría
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}
              className={isCredito ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-orange-600 hover:bg-orange-700 text-white"}>
              {mutation.isPending ? "Guardando..." : `Registrar ${isCredito ? "Nota Crédito" : "Nota Débito"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}