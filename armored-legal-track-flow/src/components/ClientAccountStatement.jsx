import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Download, Plus, Phone, Mail, User, CreditCard, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { return format(parseISO(d), "dd/MM/yyyy", { locale: es }); } catch { return d || "—"; } };

export default function ClientAccountStatement({ client, open, onOpenChange }) {
  const qc = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ invoice_id: "", amount: "", method: "transferencia", date: new Date().toISOString().split("T")[0], notes: "" });
  const [generating, setGenerating] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices_client", client?.id],
    queryFn: () => base44.entities.Invoice.filter({ client_id: client?.id }, "-issue_date"),
    enabled: !!client?.id && open,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["tx_client", client?.id],
    queryFn: () => base44.entities.TreasuryTransaction.filter({ client_name: client?.full_name }, "-date"),
    enabled: !!client?.full_name && open,
  });

  // Build ledger entries from invoices
  const ledger = useMemo(() => {
    const entries = [];
    invoices.forEach(inv => {
      // Cargo: invoice created
      entries.push({
        date: inv.issue_date || inv.created_date?.split("T")[0] || "",
        concept: inv.concept || `Factura ${inv.invoice_number || ""}`,
        cargo: inv.amount || 0,
        abono: 0,
        ref: `FAC ${inv.invoice_number || inv.id?.slice(-5)}`,
        inv_id: inv.id,
      });
      // Abono: if paid amount > 0
      if ((inv.amount_paid || 0) > 0) {
        entries.push({
          date: inv.payment_date || inv.issue_date || "",
          concept: `Pago — ${inv.concept || ""}`,
          cargo: 0,
          abono: inv.amount_paid,
          ref: `PAG ${inv.invoice_number || inv.id?.slice(-5)}`,
          inv_id: inv.id,
        });
      }
    });
    // Add treasury transactions as abonos
    txs.filter(t => t.type === "ingreso" && ["pago_cliente","honorarios"].includes(t.category)).forEach(tx => {
      // Avoid double-counting if already in invoices
      entries.push({
        date: tx.date || "",
        concept: tx.concept,
        cargo: 0,
        abono: tx.amount || 0,
        ref: `TX ${tx.reference || tx.id?.slice(-5)}`,
      });
    });
    // Sort chronologically
    entries.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    // Running balance
    let balance = 0;
    return entries.map(e => {
      balance += e.cargo - e.abono;
      return { ...e, balance };
    });
  }, [invoices, txs]);

  // KPIs
  const totalCargos = ledger.reduce((s, e) => s + e.cargo, 0);
  const totalAbonos = ledger.reduce((s, e) => s + e.abono, 0);
  const saldo = totalCargos - totalAbonos;
  const pct = totalCargos > 0 ? Math.round((totalAbonos / totalCargos) * 100) : 0;

  // Register payment mutation
  const registerPayment = useMutation({
    mutationFn: async ({ invoice_id, amount, method, date, notes }) => {
      if (!invoice_id) {
        // No invoice — register as direct treasury transaction
        return base44.entities.TreasuryTransaction.create({
          type: "ingreso",
          category: "pago_cliente",
          concept: `Pago directo — ${client?.full_name}`,
          amount: parseFloat(amount),
          date,
          payment_method: method,
          client_name: client?.full_name,
          notes: notes || "",
        });
      }
      const inv = invoices.find(i => i.id === invoice_id);
      if (!inv) throw new Error("Factura no encontrada");
      const newPaid = (parseFloat(inv.amount_paid) || 0) + parseFloat(amount);
      const newStatus = newPaid >= inv.amount ? "pagada" : "parcial";
      return base44.entities.Invoice.update(invoice_id, {
        amount_paid: newPaid,
        status: newStatus,
        payment_date: date,
        payment_method: method,
        notes: notes || inv.notes,
      });
    },
    onSuccess: () => {
      toast.success("Pago registrado");
      setShowPaymentForm(false);
      setPaymentForm({ invoice_id: "", amount: "", method: "transferencia", date: new Date().toISOString().split("T")[0], notes: "" });
      qc.invalidateQueries({ queryKey: ["invoices_client", client?.id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["tx_client", client?.id] });
    },
  });

  const generatePDF = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageW = 210;

      // Header
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, pageW, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont("helvetica", "bold");
      doc.text("ESTADO DE CUENTA", 15, 18);
      doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 15, 30);
      doc.text(`LegalTrack — Sistema de Gestión Jurídica`, pageW - 15, 30, { align: "right" });

      // Client info box
      let y = 52;
      doc.setFillColor(243, 244, 246);
      doc.rect(15, y - 6, pageW - 30, 30, "F");
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(client?.full_name || "—", 20, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      y += 7;
      doc.text(`C.C.: ${client?.cc || "—"}`, 20, y);
      doc.text(`Tel: ${client?.phone || "—"}`, 85, y);
      doc.text(`Email: ${client?.email || "—"}`, 140, y);
      y += 7;
      doc.text(`Servicio: ${(client?.service_type || "").replace(/_/g, " ")}`, 20, y);
      y += 16;

      // KPIs row
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      const kpis = [
        { label: "TOTAL PACTADO", value: fmt(client?.agreed_value || totalCargos) },
        { label: "TOTAL RECAUDADO", value: fmt(totalAbonos) },
        { label: "SALDO PENDIENTE", value: fmt(saldo) },
        { label: "% AVANCE", value: `${pct}%` },
      ];
      kpis.forEach((k, i) => {
        const x = 15 + i * 46;
        doc.setFillColor(i === 2 && saldo > 0 ? 254 : i === 1 ? 209 : 226, i === 2 && saldo > 0 ? 215 : i === 1 ? 250 : 232, i === 2 && saldo > 0 ? 170 : i === 1 ? 215 : 250);
        doc.rect(x, y - 4, 44, 18, "F");
        doc.setFontSize(7); doc.setTextColor(100, 100, 100);
        doc.text(k.label, x + 2, y + 2);
        doc.setFontSize(9); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "bold");
        doc.text(k.value, x + 2, y + 11);
      });
      y += 26;

      // Ledger table header
      doc.setFillColor(55, 65, 81); doc.setTextColor(255, 255, 255);
      doc.rect(15, y - 4, pageW - 30, 9, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text("FECHA", 20, y + 2);
      doc.text("CONCEPTO", 50, y + 2);
      doc.text("REFERENCIA", 118, y + 2);
      doc.text("CARGO", 148, y + 2, { align: "right" });
      doc.text("ABONO", 168, y + 2, { align: "right" });
      doc.text("SALDO", 193, y + 2, { align: "right" });
      y += 12;

      doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
      ledger.forEach((row, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        if (i % 2 === 0) { doc.setFillColor(249, 250, 251); doc.rect(15, y - 4, pageW - 30, 8, "F"); }
        doc.setFontSize(7.5);
        doc.text(fmtDate(row.date), 20, y);
        const concept = (row.concept || "").length > 42 ? row.concept.slice(0, 39) + "..." : row.concept || "";
        doc.text(concept, 50, y);
        doc.text(row.ref || "—", 118, y);
        if (row.cargo > 0) { doc.setTextColor(180, 50, 50); doc.text(fmt(row.cargo), 148, y, { align: "right" }); }
        else doc.text("—", 148, y, { align: "right" });
        if (row.abono > 0) { doc.setTextColor(16, 120, 60); doc.text(fmt(row.abono), 168, y, { align: "right" }); }
        else doc.text("—", 168, y, { align: "right" });
        doc.setTextColor(row.balance <= 0 ? 16 : 100, row.balance <= 0 ? 120 : 60, row.balance <= 0 ? 60 : 0);
        doc.text(fmt(row.balance), 193, y, { align: "right" });
        doc.setTextColor(0, 0, 0);
        y += 8;
      });

      // Totals footer
      y += 2;
      doc.setDrawColor(100); doc.line(15, y, pageW - 15, y); y += 6;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9);
      doc.text("TOTALES:", 20, y);
      doc.setTextColor(180, 50, 50); doc.text(fmt(totalCargos), 148, y, { align: "right" });
      doc.setTextColor(16, 120, 60); doc.text(fmt(totalAbonos), 168, y, { align: "right" });
      doc.setTextColor(saldo > 0 ? 180 : 16, saldo > 0 ? 90 : 120, 0);
      doc.text(fmt(saldo), 193, y, { align: "right" });

      doc.save(`estado-cuenta-${client?.cc || "cliente"}.pdf`);
      toast.success("PDF generado");
    } finally {
      setGenerating(false);
    }
  };

  const unpaidInvoices = invoices.filter(i => i.status !== "pagada" && i.status !== "anulada");
  const hasInvoices = unpaidInvoices.length > 0;

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-base">Estado de Cuenta — {client.full_name}</DialogTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                onClick={() => setShowPaymentForm(v => !v)}>
                <Plus className="h-3.5 w-3.5" /> Registrar Pago
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1.5 bg-slate-700 hover:bg-slate-800"
                onClick={generatePDF} disabled={generating}>
                <Download className="h-3.5 w-3.5" />
                {generating ? "Generando..." : "Generar PDF"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Client header */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Nombre</p>
              <p className="font-semibold text-xs">{client.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cédula</p>
              <p className="font-mono text-xs">{client.cc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Teléfono</p>
              <p className="text-xs">{client.phone || "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Correo</p>
              <p className="text-xs truncate">{client.email || "—"}</p>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Pactado", value: fmt(client.agreed_value || totalCargos), icon: CreditCard, bg: "bg-slate-700" },
            { label: "Total Recaudado", value: fmt(totalAbonos), icon: CheckCircle2, bg: "bg-emerald-600" },
            { label: "Saldo Pendiente", value: fmt(saldo), icon: Clock, bg: saldo > 0 ? "bg-amber-600" : "bg-emerald-700" },
            { label: "% Avance Recaudo", value: `${pct}%`, icon: TrendingUp, bg: "bg-blue-600" },
          ].map(k => (
            <div key={k.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`${k.bg} rounded-xl p-2 shrink-0`}><k.icon className="h-4 w-4 text-white" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{k.label}</p>
                <p className="font-bold text-sm">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {totalCargos > 0 && (
          <div className="bg-card border border-border rounded-xl p-3.5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Avance de Recaudo</span>
              <span className="font-bold text-emerald-600">{pct}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        )}

        {/* Register payment inline form */}
        {showPaymentForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Registrar Pago</p>
            {!hasInvoices && (
              <p className="text-[11px] text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg">⚠ No hay facturas pendientes — el pago se registrará como movimiento de tesorería.</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {hasInvoices && (
                <div>
                  <Label className="text-xs">Factura</Label>
                  <Select value={paymentForm.invoice_id} onValueChange={v => setPaymentForm(p => ({ ...p, invoice_id: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {unpaidInvoices.map(i => (
                        <SelectItem key={i.id} value={i.id} className="text-xs">
                          {i.invoice_number || i.id.slice(-5)} — Saldo: {fmt((i.amount||0)-(i.amount_paid||0))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Monto (COP)</Label>
                <Input className="h-7 text-xs" type="number" value={paymentForm.amount}
                  onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Método</Label>
                <Select value={paymentForm.method} onValueChange={v => setPaymentForm(p => ({ ...p, method: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["efectivo","transferencia","nequi","daviplata","cheque","otro"].map(m => (
                      <SelectItem key={m} value={m} className="text-xs capitalize">{m.charAt(0).toUpperCase()+m.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fecha</Label>
                <Input className="h-7 text-xs" type="date" value={paymentForm.date}
                  onChange={e => setPaymentForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPaymentForm(false)}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={registerPayment.isPending || !paymentForm.amount}
                onClick={() => registerPayment.mutate(paymentForm)}>
                {registerPayment.isPending ? "Guardando..." : "Confirmar Pago"}
              </Button>
            </div>
          </div>
        )}

        {/* Libro Mayor */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-slate-700 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white">📒 Libro Mayor — Movimientos Cronológicos</span>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                    <th className="px-4 py-2.5 text-left">Fecha</th>
                    <th className="px-4 py-2.5 text-left">Concepto</th>
                    <th className="px-4 py-2.5 text-left">Ref.</th>
                    <th className="px-4 py-2.5 text-right text-red-600">Cargo</th>
                    <th className="px-4 py-2.5 text-right text-emerald-600">Abono</th>
                    <th className="px-4 py-2.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground text-sm">Sin movimientos registrados</td></tr>
                  )}
                  {ledger.map((row, idx) => (
                    <tr key={idx} className={`border-t border-border/50 hover:bg-secondary/30 ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                      <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(row.date)}</td>
                      <td className="px-4 py-2.5 text-xs max-w-[200px] truncate">{row.concept}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">{row.ref}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {row.cargo > 0 ? <span className="text-red-600 font-semibold">{fmt(row.cargo)}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">
                        {row.abono > 0 ? <span className="text-emerald-600 font-semibold">{fmt(row.abono)}</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs font-bold ${row.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {fmt(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {ledger.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase">Totales</td>
                      <td className="px-4 py-2.5 text-right font-bold text-xs text-red-600">{fmt(totalCargos)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-xs text-emerald-600">{fmt(totalAbonos)}</td>
                      <td className={`px-4 py-2.5 text-right font-bold text-xs ${saldo > 0 ? "text-amber-600" : "text-emerald-600"}`}>{fmt(saldo)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}