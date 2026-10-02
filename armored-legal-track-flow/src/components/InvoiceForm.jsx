import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Download, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { addDays, format } from "date-fns";
import { toastSuccess, toastError } from "@/utils/toastUtils";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const ITEM_TYPES = { honorarios_fijo: "Honorarios Fijo", cuota_litis: "Cuota Litis (%)", gastos_reembolsables: "Gastos Reembolsables" };

const emptyItem = () => ({ id: crypto.randomUUID(), type: "honorarios_fijo", concept: "", amount: "", base_value: "", percentage: "" });

const empty = {
  invoice_number: "", client_id: "", client_name: "", client_cc: "",
  process_id: "", concept: "", service_type: "eliminacion_reportes",
  items: [], payment_terms: "30",
  amount: "", amount_paid: "0", status: "Borrador",
  issue_date: new Date().toISOString().split("T")[0],
  due_date: "", notes: "", client_cc: "",
};

export default function InvoiceForm({ open, onOpenChange, invoice, onSuccess }) {
  const [form, setForm] = useState(empty);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: resolutions = [] } = useQuery({ queryKey: ["billing_resolutions"], queryFn: () => base44.entities.BillingResolution.list() });
  const activeResolution = resolutions.find(r => r.status === "activa");  
  const qcInvoice = useQueryClient();

  const getNextInvoiceNumber = (res) => {
    const next = (res.current_consecutive || 0) + 1;
    return `${res.prefix}-${String(next).padStart(3, "0")}`;
  };

  const resolutionUsePct = activeResolution ? Math.round(((activeResolution.current_consecutive || 0) - (activeResolution.initial_consecutive || 0)) / ((activeResolution.final_consecutive || 1) - (activeResolution.initial_consecutive || 0)) * 100) : 0;
  const resolutionAtLimit = activeResolution && (activeResolution.current_consecutive || 0) >= activeResolution.final_consecutive;
  const resolutionNearLimit = activeResolution && resolutionUsePct >= 90 && !resolutionAtLimit;

  useEffect(() => {
    if (invoice) {
      setForm({ ...empty, ...invoice, amount: invoice.amount || "", amount_paid: invoice.amount_paid || "0", items: invoice.items || [], client_cc: invoice.client_cc || "" });
      setClientSearch(invoice.client_name || "");
    } else {
      // Never pre-assign the number — emitInvoice assigns it atomically
      setForm({ ...empty, invoice_number: "", client_cc: "" });
      setClientSearch("");
    }
    setShowClientList(false);
  }, [invoice, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-calculate due_date from issue_date + payment_terms
  useEffect(() => {
    if (form.payment_terms && form.payment_terms !== "manual" && form.issue_date) {
      const days = parseInt(form.payment_terms);
      const due = addDays(new Date(form.issue_date), days);
      set("due_date", format(due, "yyyy-MM-dd"));
    }
  }, [form.payment_terms, form.issue_date]);

  // Auto-calculate total from items
  const totalFromItems = form.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
  const effectiveTotal = form.items.length > 0 ? totalFromItems : parseFloat(form.amount) || 0;

  // Line items helpers
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, emptyItem()] }));
  const removeItem = (id) => setForm(p => ({ ...p, items: p.items.filter(it => it.id !== id) }));
  const updateItem = (id, key, val) => {
    setForm(p => ({
      ...p,
      items: p.items.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [key]: val };
        // Auto-calc cuota litis
        if (updated.type === "cuota_litis" && updated.base_value && updated.percentage) {
          updated.amount = String(Math.round((parseFloat(updated.base_value) * parseFloat(updated.percentage)) / 100));
        }
        return updated;
      }),
    }));
  };

  const filteredClients = clients.filter(c =>
    clientSearch.trim() &&
    (c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.cc?.includes(clientSearch))
  ).slice(0, 6);

  const handleClientSelect = (c) => {
    set("client_id", c.id); set("client_name", c.full_name); set("client_cc", c.cc);
    setClientSearch(c.full_name); setShowClientList(false);
    if (c.agreed_value && !form.amount) set("amount", String(c.agreed_value));
  };

  const applyInitial50 = () => {
    const total = effectiveTotal;
    if (!total) return toast.error("Ingresa primero el valor total");
    setForm(p => ({ ...p, amount_paid: String(Math.round(total * 0.5)), status: "parcial",
      notes: p.notes || "50% inicial al firmar contrato. Saldo restante por cobrar al avance del caso." }));
    toast.success("50% inicial aplicado");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const invoiceNum = form.invoice_number || "BORRADOR";

    // Header bar
    doc.setFillColor(17, 24, 39);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text("FACTURA DE SERVICIOS LEGALES", 20, 18);
    doc.setFontSize(12); doc.setFont("helvetica", "normal");
    doc.text(`N° ${invoiceNum}`, 20, 30);
    doc.setFontSize(10);
    doc.text(`Fecha emisión: ${form.issue_date || "—"}`, 140, 22);
    if (form.due_date) doc.text(`Vencimiento: ${form.due_date}`, 140, 30);

    // Client info
    doc.setTextColor(0, 0, 0);
    let y = 52;
    doc.setFillColor(243, 244, 246);
    doc.rect(15, y - 6, 180, 22, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("CLIENTE:", 20, y);
    doc.setFont("helvetica", "normal");
    doc.text(form.client_name || "—", 50, y); y += 7;
    if (form.client_cc) { doc.text(`C.C.: ${form.client_cc}`, 20, y); }
    doc.text(`Servicio: ${(form.service_type || "").replace(/_/g, " ")}`, 100, y); y += 16;

    // Items table
    doc.setFont("helvetica", "bold");
    doc.setFillColor(55, 65, 81);
    doc.setTextColor(255, 255, 255);
    doc.rect(15, y - 4, 180, 9, "F");
    doc.text("CONCEPTO", 20, y + 2);
    doc.text("TIPO", 110, y + 2);
    doc.text("VALOR", 190, y + 2, { align: "right" });
    y += 12;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const items = form.items.length > 0
      ? form.items
      : [{ concept: form.concept || "Servicios legales", amount: effectiveTotal, type: "honorarios_fijo" }];

    items.forEach((item, i) => {
      if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(15, y - 4, 180, 9, "F"); }
      const label = item.concept || "—";
      const typeLbl = ITEM_TYPES[item.type] || item.type || "—";
      doc.text(label.length > 50 ? label.slice(0, 47) + "..." : label, 20, y);
      doc.text(typeLbl, 110, y);
      doc.text(fmt(parseFloat(item.amount) || 0), 190, y, { align: "right" });
      y += 9;
    });

    y += 5;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y); y += 8;

    // Totals
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("TOTAL FACTURA:", 130, y);
    doc.text(fmt(effectiveTotal), 190, y, { align: "right" }); y += 8;

    const paid = parseFloat(form.amount_paid) || 0;
    if (paid > 0) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.setTextColor(16, 185, 129);
      doc.text("Pagado:", 130, y);
      doc.text(fmt(paid), 190, y, { align: "right" }); y += 7;
      const saldo = effectiveTotal - paid;
      if (saldo > 0) {
        doc.setTextColor(217, 119, 6); doc.setFont("helvetica", "bold");
        doc.text("Saldo pendiente:", 130, y);
        doc.text(fmt(saldo), 190, y, { align: "right" });
      }
    }

    if (form.notes) {
      y += 15; doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("Notas: " + form.notes, 20, y, { maxWidth: 170 });
    }

    doc.save(`factura-${invoiceNum}.pdf`);
    toast.success("PDF exportado");
  };

  const mutation = useMutation({
    mutationFn: async (d) => {
      const finalAmount = d.items?.length > 0
        ? d.items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
        : parseFloat(d.amount) || 0;
      const baseData = { ...d, amount: finalAmount, amount_paid: parseFloat(d.amount_paid) || 0 };
      
      if (!invoice) {
        // New invoice: create as Borrador
        baseData.status = "Borrador";
        const result = await base44.entities.Invoice.create(baseData);
        
        // If emitting (changing to Emitida), call emitInvoice
        if (d.status === "Emitida" && activeResolution) {
          if (resolutionAtLimit) throw new Error("Límite de facturación alcanzado. Configura una nueva resolución.");
          const emitResponse = await base44.functions.invoke('emitInvoice', {
            invoice_id: result.id,
            billing_resolution_id: activeResolution.id
          });
          // Refresh invoices and resolutions
          await qcInvoice.invalidateQueries({ queryKey: ["invoices"] });
          await qcInvoice.invalidateQueries({ queryKey: ["billing_resolutions"] });
          // Return the data with updated status
          return { ...result, ...emitResponse.data };
        }
        return result;
      }
      
      // Edit existing invoice: only allow editable fields
      const editData = {
        concept: d.concept,
        notes: d.notes,
        due_date: d.due_date,
        service_type: d.service_type,
        process_id: d.process_id,
        payment_terms: d.payment_terms,
        issue_date: d.issue_date,
        items: d.items
      };
      return base44.entities.Invoice.update(invoice.id, editData);
    },
    onSuccess: (data) => { 
      if (invoice) {
        toastSuccess("Factura actualizada correctamente");
      } else if (form.status === "Emitida") {
        toastSuccess(`Factura emitida: ${data.invoice_number}`);
      } else {
        toastSuccess("Factura creada en borrador");
      }
      onSuccess?.();
    },
    onError: (error) => {
      toastError(error.message || "Error al guardar la factura");
    }
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.client_name.trim() || !form.concept.trim()) return toast.error("Cliente y concepto son requeridos");
    if (form.items.length === 0 && !form.amount) return toast.error("Ingresa el monto o agrega ítems");
    if (!invoice && resolutionAtLimit) return toast.error("Límite de facturación alcanzado. Crea una nueva resolución en Configuración.");
    if (!invoice && !activeResolution) return toast.error("No hay una resolución de facturación activa. Configúrala primero.");
    // New invoices always emit (number assigned by emitInvoice)
    mutation.mutate(!invoice ? { ...form, status: "Emitida" } : form);
  };

  const saldo = effectiveTotal - (parseFloat(form.amount_paid) || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle>{invoice ? "Editar Factura" : "Nueva Factura"}</DialogTitle>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={exportPDF}>
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Resolution warnings */}
          {!invoice && resolutionNearLimit && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Resolución al {resolutionUsePct}% de uso. Quedan {(activeResolution.final_consecutive) - (activeResolution.current_consecutive || 0)} consecutivos disponibles.
            </div>
          )}
          {!invoice && resolutionAtLimit && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Límite de facturación alcanzado. Ve a Configuración &gt; Resoluciones para crear una nueva.
            </div>
          )}
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1.5">
                No. Factura
                <Lock className="h-3 w-3 text-muted-foreground" />
              </Label>
              <p className="h-9 flex items-center px-3 py-2 bg-muted/50 rounded-md font-mono font-bold text-sm">{form.invoice_number || "(autogenerado)"}</p>
            </div>
            <div>
              <Label>Estado</Label>
              <div className="flex items-center gap-2 h-9">
                <span className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  form.status === "Borrador" ? "bg-slate-100 text-slate-700" :
                  form.status === "Emitida" ? "bg-blue-100 text-blue-700" :
                  form.status === "Pago_Parcial" ? "bg-orange-100 text-orange-700" :
                  form.status === "Pagada" ? "bg-emerald-100 text-emerald-700" :
                  form.status === "Vencida" ? "bg-red-100 text-red-700" :
                  "bg-slate-100 text-slate-500"
                }`}>
                  {form.status === "Pago_Parcial" ? "Pago Parcial" : form.status}
                </span>
              </div>
            </div>
          </div>

          {/* Client search */}
          <div>
            <Label>Cliente *</Label>
            <div className="relative">
              <Input placeholder="Buscar por nombre o cédula..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientList(true); if (!e.target.value) { set("client_id",""); set("client_name",""); set("client_cc",""); } }}
                onFocus={() => setShowClientList(true)} />
              {form.client_name && <p className="text-[11px] text-emerald-600 mt-0.5">✓ {form.client_name} {form.client_cc && `— CC ${form.client_cc}`}</p>}
              {showClientList && filteredClients.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-auto">
                  {filteredClients.map(c => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary text-sm" onClick={() => handleClientSelect(c)}>
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground text-xs ml-2">CC {c.cc}</span>
                      {c.agreed_value && <span className="text-blue-600 text-xs ml-2">Pactado: {fmt(c.agreed_value)}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Concept + service */}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Concepto *</Label><Input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Descripción del servicio" /></div>
            <div><Label>Tipo de servicio</Label>
              <Select value={form.service_type} onValueChange={v => set("service_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["eliminacion_reportes","tutela","sic","cartera","otro"].map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ítems de cobro</span>
              <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={addItem}>
                <Plus className="h-3 w-3" /> Agregar ítem
              </Button>
            </div>
            {form.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Sin ítems — se usará el monto total directo</p>
            ) : (
              <div className="divide-y divide-border">
                {form.items.map((it) => (
                  <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-end">
                    <div className="col-span-3">
                      {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Tipo</p>}
                      <Select value={it.type} onValueChange={v => updateItem(it.id, "type", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ITEM_TYPES).map(([k,v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Concepto</p>}
                      <Input className="h-7 text-xs" value={it.concept} onChange={e => updateItem(it.id, "concept", e.target.value)} placeholder="Descripción" />
                    </div>
                    {it.type === "cuota_litis" ? (
                      <>
                        <div className="col-span-2">
                          {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Valor base</p>}
                          <Input className="h-7 text-xs" type="number" value={it.base_value} onChange={e => updateItem(it.id, "base_value", e.target.value)} placeholder="Base" />
                        </div>
                        <div className="col-span-1">
                          {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">%</p>}
                          <Input className="h-7 text-xs" type="number" value={it.percentage} onChange={e => updateItem(it.id, "percentage", e.target.value)} placeholder="%" />
                        </div>
                      </>
                    ) : (
                      <div className="col-span-3">
                        {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Monto</p>}
                        <Input className="h-7 text-xs" type="number" value={it.amount} onChange={e => updateItem(it.id, "amount", e.target.value)} placeholder="0" />
                      </div>
                    )}
                    <div className="col-span-2">
                      {it === form.items[0] && <p className="text-[10px] text-muted-foreground mb-1 font-semibold">Total</p>}
                      <p className="h-7 flex items-center justify-end text-xs font-bold text-primary">{fmt(parseFloat(it.amount)||0)}</p>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeItem(it.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {form.items.length > 0 && (
              <div className="px-4 py-2 bg-muted/20 border-t border-border flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Total calculado</span>
                <span className="font-bold text-sm text-primary">{fmt(totalFromItems)}</span>
              </div>
            )}
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            {form.items.length === 0 && (
              <div><Label>Total factura (COP) *</Label>
                <Input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" />
              </div>
            )}
            <div className={form.items.length > 0 ? "col-span-2" : ""}>
              <Label className="text-muted-foreground">Valor pagado (COP)</Label>
              <p className="h-9 flex items-center px-3 py-2 bg-muted/50 rounded-md text-sm font-bold text-emerald-600">{fmt(parseFloat(form.amount_paid) || 0)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Saldo pendiente</Label>
              <p className={`h-9 flex items-center px-3 py-2 bg-muted/50 rounded-md text-sm font-bold ${saldo > 0 ? "text-amber-600" : "text-emerald-600"}`}>{fmt(Math.max(saldo, 0))}</p>
            </div>
          </div>

          {/* Dates + payment terms */}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Fecha emisión</Label><Input type="date" value={form.issue_date} onChange={e => set("issue_date", e.target.value)} /></div>
            <div><Label>Términos de pago</Label>
              <Select value={form.payment_terms} onValueChange={v => set("payment_terms", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="60">60 días</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Fecha vencimiento</Label>
              <Input type="date" value={form.due_date} onChange={e => { set("payment_terms","manual"); set("due_date", e.target.value); }} />
            </div>
          </div>

          <div><Label>ID Expediente (opcional)</Label><Input value={form.process_id} onChange={e => set("process_id", e.target.value)} placeholder="ID del proceso" /></div>

          <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            {!invoice ? (
                <Button type="submit" disabled={mutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {mutation.isPending ? "Emitiendo..." : <><CheckCircle2 className="h-4 w-4" /> Emitir Factura</> }
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Guardando..." : "Guardar Cambios"}</Button>
              )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}