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

const empty = {
  type: "ingreso", category: "pago_cliente", concept: "",
  wallet: "cuenta_firma",
  amount: "", date: new Date().toISOString().split("T")[0],
  payment_method: "transferencia", reference: "", client_name: "",
  attachment_url: "", notes: "", invoice_id: "",
};

const WALLET_LABELS = { cuenta_firma: "Cuenta de la Firma", fondo_terceros: "Fondo de Terceros" };

const CATEGORIES = {
  ingreso: ["pago_cliente", "honorarios", "titulo_judicial", "anticipo_cliente", "otro"],
  egreso: ["comision_referido", "gastos_operacion", "impuestos", "reembolso", "otro"],
};

export default function TreasuryTransactionForm({ open, onOpenChange, defaultType, onSuccess }) {
  const [form, setForm] = useState(empty);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });

  const filteredClients = clients.filter(c =>
    clientSearch.trim() &&
    (c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.cc?.includes(clientSearch))
  ).slice(0, 6);

  useEffect(() => {
    setForm({ ...empty, type: defaultType || "ingreso" });
    setClientSearch("");
    setShowClientList(false);
    setInvoiceSearch("");
    setShowInvoiceList(false);
  }, [defaultType, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async (d) => {
      const payload = {
        transaction_data: { ...d, amount: parseFloat(d.amount) || 0 },
        invoice_id: d.invoice_id || null,
      };
      const res = await base44.functions.invoke('registerPayment', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Movimiento registrado');
      // If a receipt PDF was generated, trigger download automatically
      if (data?.receipt_pdf_base64) {
        const link = document.createElement('a');
        link.href = data.receipt_pdf_base64;
        link.download = `recibo-${data.consecutive || 'caja'}.pdf`;
        link.click();
        toast.success(`Recibo ${data.consecutive} descargado`);
      }
      onSuccess?.();
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.concept.trim() || !form.amount) return toast.error('Concepto y monto son requeridos');
    if (form.type === 'ingreso' && form.category === 'pago_cliente' && !form.invoice_id) {
      return toast.error('Debe seleccionar una factura para aplicar el pago');
    }
    mutation.mutate(form);
  };

  const cats = CATEGORIES[form.type] || CATEGORIES.ingreso;
  const catLabels = {
    pago_cliente:"Pago cliente", comision_referido:"Comisión referido",
    gastos_operacion:"Gastos operación", honorarios:"Honorarios",
    impuestos:"Impuestos", titulo_judicial:"Título Judicial",
    anticipo_cliente:"Anticipo cliente", reembolso:"Reembolso/Egreso de terceros", otro:"Otro",
  };

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("attachment_url", file_url);
      toast.success("Comprobante adjunto");
    } catch {
      toast.error("Error al subir el comprobante");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={form.type === "ingreso" ? "text-emerald-700" : "text-red-700"}>
            {form.type === "ingreso" ? "Registrar Ingreso" : "Registrar Egreso"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => { set("type", v); set("category", CATEGORIES[v][0]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c} value={c}>{catLabels[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Concepto *</Label><Input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Descripción del movimiento" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Monto (COP) *</Label><Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" /></div>
            <div><Label>Fecha</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Método de pago</Label>
              <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["efectivo","transferencia","nequi","daviplata","cheque","otro"].map(m => (
                    <SelectItem key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase()+m.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>No. Referencia</Label><Input value={form.reference} onChange={e => set("reference", e.target.value)} placeholder="REF-001" /></div>
          </div>

          {/* Invoice selection for payment */}
          {form.type === "ingreso" && form.category === "pago_cliente" && (
            <div>
              <Label>Factura a cobrar *</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar por No. factura o cliente..."
                  value={invoiceSearch}
                  onChange={e => {
                    setInvoiceSearch(e.target.value);
                    setShowInvoiceList(true);
                    if (!e.target.value) set("invoice_id", "");
                  }}
                  onFocus={() => setShowInvoiceList(true)}
                />
                {form.invoice_id && (
                  <p className="text-[11px] text-emerald-600 mt-0.5">✓ Factura seleccionada</p>
                )}
                {showInvoiceList && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                    {invoices
                       .filter(inv => ["Emitida", "Pago_Parcial", "Vencida"].includes(inv.status) && (!invoiceSearch.trim() || ((inv.invoice_number ?? "").toLowerCase().includes(invoiceSearch.toLowerCase())) || ((inv.client_name ?? "").toLowerCase().includes(invoiceSearch.toLowerCase()))))
                      .map(inv => {
                        const saldo = (inv.amount || 0) - (inv.amount_paid || 0);
                        return (
                          <button key={inv.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary text-sm border-b border-border/30"
                            onClick={() => { set("invoice_id", inv.id); set("client_name", inv.client_name); setInvoiceSearch(inv.invoice_number); setShowInvoiceList(false); }}>
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold">{inv.invoice_number}</span>
                                <span className="text-muted-foreground text-xs ml-2">{inv.client_name}</span>
                              </div>
                              <span className="text-amber-600 text-xs font-bold">Saldo: ${saldo.toLocaleString('es-CO')}</span>
                            </div>
                          </button>
                        );
                      })
                      .slice(0, 8)}
                    {invoices.filter(inv => ["Emitida", "Pago_Parcial", "Vencida"].includes(inv.status)).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-3">Sin facturas pendientes</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Cliente relacionado</Label>
            <div className="relative">
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setShowClientList(true);
                  if (!e.target.value) set("client_name", "");
                }}
                onFocus={() => setShowClientList(true)}
              />
              {form.client_name && <p className="text-[11px] text-emerald-600 mt-0.5">✓ {form.client_name}</p>}
              {showClientList && filteredClients.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-auto">
                  {filteredClients.map(c => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary text-sm"
                      onClick={() => { set("client_name", c.full_name); setClientSearch(c.full_name); setShowClientList(false); }}>
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground text-xs ml-2">CC {c.cc}</span>
                      {c.pending_balance > 0 && <span className="text-amber-600 text-xs ml-2 font-bold">Saldo: {new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(c.pending_balance)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wallet */}
          <div><Label>Billetera / Centro de costos</Label>
            <Select value={form.wallet} onValueChange={v => set("wallet", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cuenta_firma">🏛️ Cuenta de la Firma</SelectItem>
                <SelectItem value="fondo_terceros">👥 Fondo de Terceros (Títulos, Anticipos)</SelectItem>
              </SelectContent>
            </Select>
            {form.wallet === "fondo_terceros" && (
              <p className="text-[11px] text-amber-600 mt-1">⚠️ Estos fondos pertenecen al cliente — no son ingresos de la firma</p>
            )}
          </div>

          {/* Comprobante */}
          <div>
            <Label>Comprobante adjunto (JPG/PDF)</Label>
            <input type="file" accept="image/*,.pdf" className="hidden" id="tx-attachment" onChange={handleAttachment} />
            <div className="flex items-center gap-2 mt-1">
              <label htmlFor="tx-attachment"
                className="cursor-pointer px-3 py-1.5 text-xs rounded-lg border border-dashed border-input hover:bg-muted transition-colors font-medium">
                📎 Adjuntar comprobante
              </label>
              {form.attachment_url && (
                <a href={form.attachment_url} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 underline truncate max-w-[180px]">Ver adjunto</a>
              )}
            </div>
          </div>

          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}
              className={form.type === "ingreso" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}>
              {mutation.isPending ? "Guardando..." : `Registrar ${form.type === "ingreso" ? "Ingreso" : "Egreso"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}