import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Award, DollarSign, Clock, CheckCircle2, ChevronDown, ChevronUp, Plus, Receipt, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeName } from "@/utils/textFormat";
import CommissionPaymentForm from "@/components/CommissionPaymentForm";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => d ? format(new Date(d), "d MMM yyyy", { locale: es }) : "—";

const METHOD_LABELS = { transferencia: "Transferencia", nequi: "Nequi", daviplata: "Daviplata", efectivo: "Efectivo", cheque: "Cheque", otro: "Otro" };

function ReferrerCommissionRow({ referrer, clients, paidInvoices, payments }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  const refClients = clients.filter(c => c.referrer_id === referrer.id);
  const refClientIds = new Set(refClients.map(c => c.id));

  // Facturas pagadas de clientes referidos
  const refInvoices = paidInvoices.filter(inv => refClientIds.has(inv.client_id));
  const totalFacturado = refInvoices.reduce((s, inv) => s + (inv.amount || 0), 0);
  const commissionRate = (referrer.commission_percent || 0) / 100;
  const totalCausado = totalFacturado * commissionRate;

  // Pagos ya realizados a este referidor
  const myPayments = payments.filter(p => p.referrer_id === referrer.id);
  const totalPagado = myPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const saldoPendiente = Math.max(0, totalCausado - totalPagado);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CommissionPayment.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission_payments"] }),
  });

  const statusColor = saldoPendiente > 0 ? "text-amber-600" : "text-emerald-600";
  const statusBg = saldoPendiente > 0 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";
  const statusLabel = saldoPendiente > 0 ? "Pendiente" : "Al día";

  // Agrupar facturas por cliente
  const invoicesByClient = refClients.map(c => ({
    client: c,
    invoices: refInvoices.filter(inv => inv.client_id === c.id),
  })).filter(g => g.invoices.length > 0);

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Header */}
        <div
          className={`px-4 py-3 flex items-center justify-between cursor-pointer select-none transition-colors hover:bg-muted/30 border-b border-border`}
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${referrer.status === "activo" ? "bg-emerald-500" : "bg-slate-400"}`}>
              {sanitizeName(referrer.full_name).charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{sanitizeName(referrer.full_name)}</p>
              <p className="text-xs text-muted-foreground">{referrer.commission_percent}% · {refClients.length} cliente{refClients.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pendiente</p>
              <p className={`text-sm font-bold ${statusColor}`}>{fmt(saldoPendiente)}</p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBg} ${statusColor}`}>{statusLabel}</span>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/10">
          {[
            { label: "Base facturada", value: fmt(totalFacturado), color: "" },
            { label: "Comisión total", value: fmt(totalCausado), color: "text-amber-600" },
            { label: "Ya pagado", value: fmt(totalPagado), color: "text-emerald-700" },
            { label: "Saldo", value: fmt(saldoPendiente), color: saldoPendiente > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold" },
          ].map(col => (
            <div key={col.label} className="text-center py-2 px-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{col.label}</p>
              <p className={`text-xs font-semibold mt-0.5 ${col.color}`}>{col.value}</p>
            </div>
          ))}
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="p-4 space-y-4">
            {/* Facturas por cliente */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Facturas pagadas por cliente</p>
              {invoicesByClient.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin facturas pagadas aún.</p>
              ) : (
                <div className="space-y-2">
                  {invoicesByClient.map(({ client, invoices }) => {
                    const clientTotal = invoices.reduce((s, i) => s + (i.amount || 0), 0);
                    const clientComm = clientTotal * commissionRate;
                    return (
                      <div key={client.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                          <span className="text-xs font-semibold">{sanitizeName(client.full_name)}</span>
                          <span className="text-xs text-muted-foreground">Comisión: <span className="font-bold text-amber-600">{fmt(clientComm)}</span></span>
                        </div>
                        <div className="divide-y divide-border">
                          {invoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                              <div className="flex items-center gap-2">
                                <Receipt className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{inv.invoice_number || inv.id.slice(-6)}</span>
                                <span className="text-muted-foreground">{fmtDate(inv.payment_date || inv.issue_date)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{fmt(inv.amount)}</span>
                                <span className="text-amber-600">→ {fmt((inv.amount || 0) * commissionRate)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Historial de pagos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historial de pagos al referidor</p>
                {saldoPendiente > 0 && (
                  <Button size="sm" className="h-7 text-xs gap-1.5 bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={(e) => { e.stopPropagation(); setShowPayForm(true); }}>
                    <Plus className="h-3 w-3" /> Registrar pago
                  </Button>
                )}
              </div>

              {myPayments.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg px-3 py-4 text-center">
                  <p className="text-xs text-muted-foreground">Sin pagos registrados</p>
                  {saldoPendiente > 0 && (
                    <Button variant="outline" size="sm" className="mt-2 h-7 text-xs gap-1.5"
                      onClick={() => setShowPayForm(true)}>
                      <Plus className="h-3 w-3" /> Registrar primer pago
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {myPayments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).map(p => (
                    <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-xs bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium">{fmtDate(p.payment_date)}</span>
                          <span className="text-muted-foreground ml-2">{METHOD_LABELS[p.payment_method] || p.payment_method}</span>
                          {p.reference && <span className="text-muted-foreground ml-1">· #{p.reference}</span>}
                          {p.notes && <p className="text-muted-foreground truncate mt-0.5">{p.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="font-bold text-emerald-700">{fmt(p.amount)}</span>
                        {p.receipt_url && (
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button onClick={() => setDeleteTarget(p)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saldo final resumen */}
            <div className={`flex justify-between items-center rounded-lg px-4 py-2.5 border ${saldoPendiente > 0 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
              <div className="flex items-center gap-2">
                {saldoPendiente > 0 ? <Clock className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                <span className={`text-xs font-semibold ${saldoPendiente > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {saldoPendiente > 0 ? "Saldo pendiente de pago" : "Comisiones al día"}
                </span>
              </div>
              <span className={`font-bold text-sm ${saldoPendiente > 0 ? "text-amber-700" : "text-emerald-700"}`}>{fmt(saldoPendiente)}</span>
            </div>
          </div>
        )}
      </div>

      <CommissionPaymentForm
        open={showPayForm}
        onOpenChange={setShowPayForm}
        referrer={referrer}
        pendingAmount={saldoPendiente}
        pendingInvoices={refInvoices}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["commission_payments"] })}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. El saldo pendiente se ajustará automáticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function CommissionsPanel({ embedded = false }) {
  const { data: referrers = [], isLoading } = useQuery({ queryKey: ["referrers"], queryFn: () => base44.entities.Referrer.list("-created_date") });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: paidInvoices = [] } = useQuery({ queryKey: ["invoices_pagadas"], queryFn: () => base44.entities.Invoice.filter({ status: "Pagada" }) });
  const { data: payments = [] } = useQuery({ queryKey: ["commission_payments"], queryFn: () => base44.entities.CommissionPayment.list("-payment_date") });

  // KPIs globales
  const allCommission = referrers.reduce((s, r) => {
    const refClientIds = new Set(clients.filter(c => c.referrer_id === r.id).map(c => c.id));
    const total = paidInvoices.filter(inv => refClientIds.has(inv.client_id)).reduce((a, inv) => a + (inv.amount || 0), 0);
    return s + total * (r.commission_percent || 0) / 100;
  }, 0);
  const totalPagado = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPendiente = Math.max(0, allCommission - totalPagado);

  const referrersConPendiente = referrers.filter(r => {
    const refClientIds = new Set(clients.filter(c => c.referrer_id === r.id).map(c => c.id));
    const total = paidInvoices.filter(inv => refClientIds.has(inv.client_id)).reduce((a, inv) => a + (inv.amount || 0), 0);
    const causado = total * (r.commission_percent || 0) / 100;
    const pagado = payments.filter(p => p.referrer_id === r.id).reduce((s, p) => s + (p.amount || 0), 0);
    return causado - pagado > 0;
  }).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {!embedded && (
        <div className="flex items-center gap-2 px-6 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
          <DollarSign className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">COMISIONES DE REFERIDOS</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Referidores activos", value: referrers.filter(r => r.status === "activo").length, icon: Award, color: "bg-blue-600" },
            { label: "Total causado", value: fmt(allCommission), icon: DollarSign, color: "bg-violet-600", small: true },
            { label: "Total pagado", value: fmt(totalPagado), icon: CheckCircle2, color: "bg-emerald-600", small: true },
            { label: "Pendiente por pagar", value: fmt(totalPendiente), icon: Clock, color: totalPendiente > 0 ? "bg-amber-500" : "bg-emerald-600", small: true },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`${s.color} rounded-lg p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight">{s.label}</p>
                <p className={`font-bold leading-tight mt-0.5 ${s.small ? "text-sm" : "text-lg"} truncate`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Alerta si hay pendientes */}
        {referrersConPendiente > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">
              <span className="font-bold">{referrersConPendiente} referidor{referrersConPendiente !== 1 ? "es" : ""}</span> tiene{referrersConPendiente !== 1 ? "n" : ""} comisiones pendientes de pago.
            </p>
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" />
          </div>
        ) : referrers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl text-center py-14">
            <Award className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sin referidores registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primero los que tienen pendiente */}
            {[...referrers].sort((a, b) => {
              const getPendiente = (r) => {
                const rIds = new Set(clients.filter(c => c.referrer_id === r.id).map(c => c.id));
                const total = paidInvoices.filter(inv => rIds.has(inv.client_id)).reduce((s, inv) => s + (inv.amount || 0), 0);
                const causado = total * (r.commission_percent || 0) / 100;
                const pagado = payments.filter(p => p.referrer_id === r.id).reduce((s, p) => s + (p.amount || 0), 0);
                return causado - pagado;
              };
              return getPendiente(b) - getPendiente(a);
            }).map(r => (
              <ReferrerCommissionRow
                key={r.id}
                referrer={r}
                clients={clients}
                paidInvoices={paidInvoices}
                payments={payments}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}