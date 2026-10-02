import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Landmark, Plus, TrendingUp, TrendingDown, DollarSign, FileText, Users, AlertCircle, CheckCircle2, Clock, Search, ChevronRight, Trash2, BarChart2, Download, Paperclip } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useEffect, useCallback, useMemo } from "react";
import { es } from "date-fns/locale";
import InvoiceForm from "@/components/InvoiceForm";
import ClientAccountStatement from "@/components/ClientAccountStatement";
import TreasuryTransactionForm from "@/components/TreasuryTransactionForm";
import CreditNoteForm from "@/components/CreditNoteForm";
import CreditAgreementForm from "@/components/CreditAgreementForm";
import { toast } from "sonner";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const fmtDate = (d) => {try {return format(parseISO(d), "dd/MM/yyyy", { locale: es });} catch {return d || "—";}};

const INV_STATUS = {
  Borrador: { label: "Borrador", color: "bg-slate-100 text-slate-700" },
  Emitida: { label: "Emitida", color: "bg-blue-100 text-blue-700" },
  Pago_Parcial: { label: "Pago Parcial", color: "bg-orange-100 text-orange-700" },
  Pagada: { label: "Pagada", color: "bg-emerald-100 text-emerald-700" },
  Vencida: { label: "Vencida", color: "bg-red-100 text-red-700" },
  Anulada: { label: "Anulada", color: "bg-slate-100 text-slate-500" }
};

const CAT_LABELS = {
  pago_cliente: "Pago cliente", comision_referido: "Comisión referido",
  gastos_operacion: "Gastos operación", honorarios: "Honorarios",
  impuestos: "Impuestos", otro: "Otro"
};

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const TABS = [
{ id: "facturacion", label: "Facturación", icon: FileText, color: "bg-slate-700" },
{ id: "cartera", label: "Cartera", icon: Users, color: "bg-amber-600" },
{ id: "tesoreria", label: "Tesorería", icon: Landmark, color: "bg-emerald-700" },
{ id: "reportes", label: "Reportes", icon: BarChart2, color: "bg-violet-700" },
{ id: "notas", label: "Notas C/D", icon: FileText, color: "bg-orange-700" }];


export default function TreasuryModule() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("facturacion");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [walletFilter, setWalletFilter] = useState("all");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editInvoice, setEditInvoice] = useState(null);
  const [showTxForm, setShowTxForm] = useState(false);
  const [txType, setTxType] = useState("ingreso");
  const [showCreditForm, setShowCreditForm] = useState(false);
  const [creditClient, setCreditClient] = useState(null);
  const [statementClient, setStatementClient] = useState(null);
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: invoices = [], isLoading: li } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list("-created_date", 200) });
  const { data: transactions = [], isLoading: lt } = useQuery({ queryKey: ["treasury_tx"], queryFn: () => base44.entities.TreasuryTransaction.list("-date") });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: processes = [] } = useQuery({ queryKey: ["processes"], queryFn: () => base44.entities.Process.list(), enabled: tab === "reportes" });
  const { data: negReports = [] } = useQuery({ queryKey: ["neg_reports_all"], queryFn: () => base44.entities.ClientNegativeReport.list() });
  const { data: creditNotes = [], isLoading: lcn } = useQuery({ queryKey: ["credit_notes"], queryFn: () => base44.entities.CreditNote.list("-created_date") });

  const deleteInvoice = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => {qc.invalidateQueries({ queryKey: ["invoices"] });toast.success("Factura eliminada");}
  });
  const deleteTx = useMutation({
    mutationFn: (id) => base44.entities.TreasuryTransaction.delete(id),
    onSuccess: () => {qc.invalidateQueries({ queryKey: ["treasury_tx"] });toast.success("Movimiento eliminado");}
  });

  // --- KPIs ---
  const totalInvoiced = invoices.filter((i) => i.status !== "Anulada").reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = invoices.filter((i) => i.status !== "Anulada").reduce((s, i) => s + (i.amount_paid || 0), 0);
  const totalPending = totalInvoiced - totalPaid;
  const overdueCount = invoices.filter((i) => i.status === "Vencida").length;

  const txIn = transactions.filter((t) => t.type === "ingreso").reduce((s, t) => s + (t.amount || 0), 0);
  const txOut = transactions.filter((t) => t.type === "egreso").reduce((s, t) => s + (t.amount || 0), 0);
  const balance = txIn - txOut;

  // Cartera: group all invoices with unpaid balance by client.
  // Use client_id as key when available, otherwise fall back to client_cc or client_name
  // so no invoice is silently dropped due to a missing FK.
  const portfolioClients = useMemo(() => {
    const byKey = {};
    invoices.forEach((inv) => {
      if (["Borrador", "Emitida", "Pago_Parcial", "Vencida"].includes(inv.status)) {
        const saldo = (inv.amount || 0) - (inv.amount_paid || 0);
        if (saldo <= 0) return;

        // Resolve the grouping key: prefer client_id, then CC, then name
        const groupKey = inv.client_id || inv.client_cc || inv.client_name || "sin_cliente";

        if (!byKey[groupKey]) {
          // Try to match a Client record for richer data
          const c = clients.find((cl) =>
          cl.id === inv.client_id ||
          inv.client_cc && cl.cc?.trim() === inv.client_cc?.trim() ||
          cl.full_name?.toLowerCase().trim() === inv.client_name?.toLowerCase().trim()
          );
          byKey[groupKey] = {
            id: c?.id || inv.client_id || groupKey,
            full_name: c?.full_name || inv.client_name || "—",
            cc: c?.cc || inv.client_cc || "—",
            service_type: c?.service_type,
            status: c?.status,
            agreed_value: c?.agreed_value || 0,
            pending_balance: 0
          };
        }
        byKey[groupKey].pending_balance += saldo;
      }
    });
    return Object.values(byKey);
  }, [invoices, clients]);
  const totalPortfolio = portfolioClients.reduce((s, c) => s + (c.pending_balance || 0), 0);

  // filtered invoices
  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "Todos" && inv.status !== statusFilter) return false;
    if (debouncedSearch && !inv.client_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) && !inv.invoice_number?.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const filteredTx = transactions.filter((tx) => {
    if (walletFilter !== "all" && tx.wallet !== walletFilter) return false;
    if (debouncedSearch && !tx.concept?.toLowerCase().includes(debouncedSearch.toLowerCase()) && !tx.client_name?.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  // Wallet KPIs
  const firmaIn = transactions.filter((t) => t.type === "ingreso" && (!t.wallet || t.wallet === "cuenta_firma")).reduce((s, t) => s + (t.amount || 0), 0);
  const firmaOut = transactions.filter((t) => t.type === "egreso" && (!t.wallet || t.wallet === "cuenta_firma")).reduce((s, t) => s + (t.amount || 0), 0);
  const tercerosIn = transactions.filter((t) => t.type === "ingreso" && t.wallet === "fondo_terceros").reduce((s, t) => s + (t.amount || 0), 0);
  const tercerosOut = transactions.filter((t) => t.type === "egreso" && t.wallet === "fondo_terceros").reduce((s, t) => s + (t.amount || 0), 0);

  const exportCSV = (data, filename) => {
    const headers = ["Fecha", "Tipo", "Billetera", "Categoría", "Concepto", "Cliente", "Método", "Referencia", "Monto"];
    const rows = data.map((tx) => [
    tx.date || "", tx.type || "", tx.wallet || "", tx.category || "",
    `"${(tx.concept || "").replace(/"/g, "'")}"`,
    `"${(tx.client_name || "").replace(/"/g, "'")}"`,
    tx.payment_method || "", tx.reference || "", tx.amount || 0]
    );
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = filename;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Module header */}
      <div className="flex items-center justify-between px-6 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">MÓDULO DE FACTURACIÓN, CARTERA Y TESORERÍA</span>
        </div>
        {tab === "facturacion" &&
        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
        onClick={() => {setEditInvoice(null);setShowInvoiceForm(true);}}>
            <Plus className="h-3.5 w-3.5" /> Nueva Factura
          </Button>
        }
        {tab === "tesoreria" &&
        <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => {setTxType("egreso");setShowTxForm(true);}}>
              <TrendingDown className="h-3.5 w-3.5 mr-1 text-red-400" /> Egreso
            </Button>
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
          onClick={() => {setTxType("ingreso");setShowTxForm(true);}}>
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Ingreso
            </Button>
          </div>
        }
        {tab === "notas" &&
        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-xs"
        onClick={() => setShowCreditNoteForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva Nota
          </Button>
        }
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0.5 px-5 pt-3 bg-card border-b border-border shrink-0">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => {setTab(t.id);setSearch("");setStatusFilter("Todos");}}
            className={"flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-all " + (active ? t.color + " text-white border-transparent -mb-px pb-3" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted")}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>);

        })}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-5 space-y-4">

        {/* ============ FACTURACIÓN ============ */}
        {tab === "facturacion" &&
        <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
            { label: "Total Facturado", value: fmt(totalInvoiced), icon: FileText, bg: "bg-slate-700" },
            { label: "Recaudado", value: fmt(totalPaid), icon: CheckCircle2, bg: "bg-emerald-600" },
            { label: "Por Cobrar", value: fmt(totalPending), icon: Clock, bg: "bg-amber-600" },
            { label: "Facturas Vencidas", value: overdueCount, icon: AlertCircle, bg: "bg-red-600", plain: true }].
            map((s) => null







            )}
            </div>

            {/* Recaudo progress */}
            {totalInvoiced > 0 &&
          <div className="bg-card border border-border rounded-xl p-4 hidden">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wide">Avance de Recaudo</span>
                  <span className="font-bold text-emerald-600">{Math.round(totalPaid / totalInvoiced * 100)}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(totalPaid / totalInvoiced * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                  <span>Recaudado: <strong className="text-emerald-600">{fmt(totalPaid)}</strong></span>
                  <span>Pendiente: <strong className="text-amber-600">{fmt(totalPending)}</strong></span>
                </div>
              </div>
          }

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar por cliente o No. factura..." className="pl-8 h-7 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {["Todos", "Borrador", "Emitida", "Pago_Parcial", "Vencida", "Pagada", "Anulada"].map((k) =>
            <button key={k} onClick={() => setStatusFilter(k)}
            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${statusFilter === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>
                  {k === "Todos" ? "Todos" : INV_STATUS[k]?.label || k}
                </button>
            )}
            </div>

            {/* Invoices table */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2 bg-muted/30 border-b border-border">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{filteredInvoices.length} factura{filteredInvoices.length !== 1 ? "s" : ""}</span>
              </div>
              {li ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div> :
            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">No. Factura</th>
                        <th className="px-4 py-2.5 text-left">Cliente</th>
                        <th className="px-4 py-2.5 text-left">Concepto</th>
                        <th className="px-4 py-2.5 text-left">Emisión</th>
                        <th className="px-4 py-2.5 text-left">Vencimiento</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">Pagado</th>
                        <th className="px-4 py-2.5 text-right">Saldo</th>
                        <th className="px-4 py-2.5 text-center">Estado</th>
                        <th className="px-4 py-2.5 text-center">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.length === 0 &&
                  <tr><td colSpan={10} className="text-center py-10 text-muted-foreground text-sm">Sin facturas</td></tr>
                  }
                      {filteredInvoices.map((inv, idx) => {
                    const st = INV_STATUS[inv.status] || INV_STATUS.Borrador;
                    const saldo = (inv.amount || 0) - (inv.amount_paid || 0);
                    return (
                      <tr key={inv.id} className={`border-t border-border/50 hover:bg-secondary/40 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                            <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-primary">{inv.invoice_number || `#${inv.id?.slice(-5)}`}</td>
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-semibold">{inv.client_name}</p>
                              {inv.client_cc && <p className="text-[10px] text-muted-foreground">CC {inv.client_cc}</p>}
                            </td>
                            <td className="px-4 py-2.5 text-xs max-w-[160px] truncate">{inv.concept}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(inv.issue_date)}</td>
                            <td className="px-4 py-2.5 font-mono text-[11px]">
                              {inv.due_date ?
                          <span className={differenceInDays(parseISO(inv.due_date), new Date()) < 0 && inv.status !== "Pagada" ? "text-red-600 font-bold" : ""}>
                                  {fmtDate(inv.due_date)}
                                </span> :
                          "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">{fmt(inv.amount)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-600 font-semibold">{fmt(inv.amount_paid)}</td>
                            <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-amber-600">{fmt(saldo)}</td>
                            <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.color}`}>{st.label}</span></td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {inv.status === "Pago_Parcial" &&
                            <Button size="sm" className="h-6 text-[10px] px-2 bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => {setEditInvoice(inv);setShowInvoiceForm(true);}}
                            title="Registrar pago del saldo restante">
                                    💰 Cobrar Saldo
                                  </Button>
                            }
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {setEditInvoice(inv);setShowInvoiceForm(true);}}>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteInvoice.mutate(inv.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>);

                  })}
                    </tbody>
                  </table>
                </div>
            }
            </div>
          </>
        }

        {/* ============ CARTERA ============ */}
        {tab === "cartera" &&
        <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
            { label: "Clientes con Saldo", value: portfolioClients.length, icon: Users, bg: "bg-amber-600", plain: true },
            { label: "Total Cartera Activa", value: fmt(totalPortfolio), icon: DollarSign, bg: "bg-rose-600" },
            { label: "Facturas Vencidas", value: fmt(invoices.filter((i) => i.status === "Vencida").reduce((s, i) => s + (i.amount - (i.amount_paid || 0)), 0)), icon: AlertCircle, bg: "bg-red-700" }].
            map((s) =>
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                  <div className={`${s.bg} rounded-xl p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={`font-bold ${s.plain ? "text-2xl" : "text-sm"} truncate`}>{s.value}</p>
                  </div>
                </div>
            )}
            </div>

            {/* Portfolio table */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-amber-700 border-b border-border flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-amber-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-white">Cartera Vigente — Clientes con Saldo Pendiente</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                      <th className="px-4 py-2.5 text-left">Cliente</th>
                      <th className="px-4 py-2.5 text-left">Cédula</th>
                      <th className="px-4 py-2.5 text-left">Servicio</th>
                      <th className="px-4 py-2.5 text-right">Valor Pactado</th>
                      <th className="px-4 py-2.5 text-right">Saldo Pendiente</th>
                      <th className="px-4 py-2.5 text-right">% Recaudado</th>
                      <th className="px-4 py-2.5 text-center">Estado</th>
                      <th className="px-4 py-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioClients.length === 0 &&
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Sin cartera activa</td></tr>
                  }
                    {portfolioClients.sort((a, b) => (b.pending_balance || 0) - (a.pending_balance || 0)).map((c, idx) => {
                    const pct = c.agreed_value > 0 ? Math.round((c.agreed_value - c.pending_balance) / c.agreed_value * 100) : 0;
                    return (
                      <tr key={c.id} className={`border-t border-border/50 hover:bg-secondary/40 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-4 py-2.5 font-semibold text-xs">{c.full_name}</td>
                          <td className="px-4 py-2.5">
                            <button
                            className="font-mono text-[11px] text-blue-600 hover:underline cursor-pointer"
                            onClick={() => setStatementClient(c)}>
                              {c.cc}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-[11px] capitalize text-muted-foreground">{c.service_type?.replace(/_/g, " ")}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs">{fmt(c.agreed_value)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-xs text-amber-600">{fmt(c.pending_balance)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] font-bold text-emerald-600">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-700 capitalize">{c.status?.replace(/_/g, " ")}</span></td>
                          <td className="px-4 py-2.5 text-center">
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => {setCreditClient(c);setShowCreditForm(true);}}>
                              🤝 Acuerdo
                            </Button>
                          </td>
                        </tr>);

                  })}
                  </tbody>
                  {portfolioClients.length > 0 &&
                <tfoot>
                      <tr className="border-t-2 border-border bg-muted/30">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-bold uppercase">TOTAL</td>
                        <td className="px-4 py-2.5 text-right font-bold text-xs">{fmt(portfolioClients.reduce((s, c) => s + (c.agreed_value || 0), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-xs text-amber-600">{fmt(totalPortfolio)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                }
                </table>
              </div>
            </div>
          </>
        }

        {/* ============ TESORERÍA ============ */}
        {tab === "tesoreria" &&
        <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
            { label: "Total Ingresos", value: fmt(txIn), icon: TrendingUp, bg: "bg-emerald-600" },
            { label: "Total Egresos", value: fmt(txOut), icon: TrendingDown, bg: "bg-red-600" },
            { label: "Balance Neto", value: fmt(balance), icon: DollarSign, bg: balance >= 0 ? "bg-emerald-700" : "bg-red-700" },
            { label: "Movimientos", value: transactions.length, icon: FileText, bg: "bg-slate-700", plain: true }].
            map((s) =>
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                  <div className={`${s.bg} rounded-xl p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={`font-bold ${s.plain ? "text-2xl" : "text-sm"} truncate`}>{s.value}</p>
                  </div>
                </div>
            )}
            </div>

            {/* Search + Wallet filter */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar movimiento..." className="pl-8 h-7 text-xs w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {["all", "cuenta_firma", "fondo_terceros"].map((w) =>
            <button key={w} onClick={() => setWalletFilter(w)}
            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${walletFilter === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>
                  {w === "all" ? "Todas" : w === "cuenta_firma" ? "🏛️ Firma" : "👥 Terceros"}
                </button>
            )}
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 ml-auto" onClick={() => exportCSV(filteredTx, "tesoreria.csv")}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>

            {/* Wallet KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">🏛️ Firma — Balance</p>
                <p className={`font-bold text-sm mt-0.5 ${firmaIn - firmaOut >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(firmaIn - firmaOut)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(firmaIn)} ing · {fmt(firmaOut)} egr</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">👥 Fondo Terceros</p>
                <p className={`font-bold text-sm mt-0.5 ${tercerosIn - tercerosOut >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmt(tercerosIn - tercerosOut)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmt(tercerosIn)} rec · {fmt(tercerosOut)} ent</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Ingresos</p>
                <p className="font-bold text-sm mt-0.5 text-emerald-600">{fmt(txIn)}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Total Egresos</p>
                <p className="font-bold text-sm mt-0.5 text-red-600">{fmt(txOut)}</p>
              </div>
            </div>

            {/* Transactions table */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-800 border-b border-border flex items-center gap-2">
                <Landmark className="h-3.5 w-3.5 text-emerald-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-white">Libro de Caja — Movimientos de Tesorería</span>
              </div>
              {lt ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div> :
            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-left">Billetera</th>
                        <th className="px-4 py-2.5 text-left">Categoría</th>
                        <th className="px-4 py-2.5 text-left">Concepto</th>
                        <th className="px-4 py-2.5 text-left">Cliente</th>
                        <th className="px-4 py-2.5 text-left">Método</th>
                        <th className="px-4 py-2.5 text-left">Referencia</th>
                        <th className="px-4 py-2.5 text-right">Monto</th>
                        <th className="px-4 py-2.5 text-center">Acc.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.length === 0 &&
                  <tr><td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">Sin movimientos registrados</td></tr>
                  }
                      {filteredTx.map((tx, idx) =>
                  <tr key={tx.id} className={`border-t border-border/50 hover:bg-secondary/40 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(tx.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${tx.type === "ingreso" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                              {tx.type === "ingreso" ? "INGRESO" : "EGRESO"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${tx.wallet === "fondo_terceros" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                              {tx.wallet === "fondo_terceros" ? "Terceros" : "Firma"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[11px]">{CAT_LABELS[tx.category] || tx.category}</td>
                          <td className="px-4 py-2.5 text-xs max-w-[160px] truncate">{tx.concept}</td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{tx.client_name || "—"}</td>
                          <td className="px-4 py-2.5 text-[11px] capitalize">{tx.payment_method || "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{tx.reference || "—"}</td>
                          {tx.attachment_url && <td className="px-2 py-2.5 text-center"><a href={tx.attachment_url} target="_blank" rel="noreferrer" title="Ver comprobante"><Paperclip className="h-3.5 w-3.5 text-blue-500" /></a></td>}
                          <td className={`px-4 py-2.5 text-right font-bold text-sm ${tx.type === "ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                            {tx.type === "ingreso" ? "+" : "-"}{fmt(tx.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteTx.mutate(tx.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                  )}
                    </tbody>
                    {filteredTx.length > 0 &&
                <tfoot>
                        <tr className="border-t-2 border-border bg-muted/30">
                          <td colSpan={7} className="px-4 py-2.5 text-xs font-bold uppercase">Balance del período</td>
                          <td className={`px-4 py-2.5 text-right font-bold text-sm ${balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(balance)}</td>
                          <td />
                        </tr>
                      </tfoot>
                }
                  </table>
                </div>
            }
            </div>
          </>
        }

        {/* ============ REPORTES ============ */}
        {tab === "reportes" && (() => {
          const now = new Date();

          // Date range filter
          const txFiltered = transactions.filter((t) => {
            if (!t.date) return true;
            if (dateFrom && t.date < dateFrom) return false;
            if (dateTo && t.date > dateTo) return false;
            return true;
          });
          const invFiltered = invoices.filter((i) => {
            if (!i.issue_date) return true;
            if (dateFrom && i.issue_date < dateFrom) return false;
            if (dateTo && i.issue_date > dateTo) return false;
            return true;
          });

          const totalInvoicedFiltered = invFiltered.filter((i) => i.status !== "Anulada").reduce((s, i) => s + (i.amount || 0), 0);
          const totalPaidFiltered = invFiltered.filter((i) => i.status !== "Anulada").reduce((s, i) => s + (i.amount_paid || 0), 0);
          const txInFiltered = txFiltered.filter((t) => t.type === "ingreso").reduce((s, t) => s + (t.amount || 0), 0);
          const txOutFiltered = txFiltered.filter((t) => t.type === "egreso").reduce((s, t) => s + (t.amount || 0), 0);

          const exportReportCSV = () => {
            const headers = ["Mes", "Ingresos", "Egresos", "Neto"];
            const rows = cashFlowData.map((d) => [d.mes, d.ingresos, d.egresos, d.ingresos - d.egresos]);
            const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
            const a = document.createElement("a");a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);a.download = "flujo-caja.csv";a.click();
          };

          const cashFlowData = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
            const m = d.getMonth();const y = d.getFullYear();
            const ing = transactions.filter((t) => t.type === "ingreso" && t.date && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y).reduce((s, t) => s + (t.amount || 0), 0);
            const egr = transactions.filter((t) => t.type === "egreso" && t.date && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y).reduce((s, t) => s + (t.amount || 0), 0);
            return { mes: MONTHS_ES[m], ingresos: ing, egresos: egr };
          });
          let running = 0;
          const balanceData = cashFlowData.map((d) => {running += d.ingresos - d.egresos;return { mes: d.mes, acumulado: running };});
          const repStatus = [
          { name: "Eliminados", value: negReports.filter((r) => r.status === "eliminado_exito").length, color: "#10b981" },
          { name: "En Gestión", value: negReports.filter((r) => r.status === "en_gestion").length, color: "#f59e0b" },
          { name: "Pendiente", value: negReports.filter((r) => r.status === "pendiente").length, color: "#94a3b8" }].
          filter((r) => r.value > 0);
          const totalRep = negReports.length;
          const eliminatedPct = totalRep > 0 ? Math.round(negReports.filter((r) => r.status === "eliminado_exito").length / totalRep * 100) : 0;
          const clientStatusData = [
          { name: "Prospectos", value: clients.filter((c) => c.status === "prospecto").length, color: "#94a3b8" },
          { name: "En Trámite", value: clients.filter((c) => ["contactado", "contrato_firmado", "peticion_radicada", "en_tramite"].includes(c.status)).length, color: "#f59e0b" },
          { name: "Finalizados", value: clients.filter((c) => c.status === "finalizado").length, color: "#10b981" },
          { name: "Perdidos", value: clients.filter((c) => c.status === "perdido").length, color: "#ef4444" }].
          filter((r) => r.value > 0);
          const fmtTick = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
          return (
            <div className="space-y-5">
              {/* Date range filter */}
              <div className="flex flex-wrap gap-3 items-center bg-card border border-border rounded-xl px-4 py-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rango de fechas</span>
                <Input type="date" className="h-7 text-xs w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground">al</span>
                <Input type="date" className="h-7 text-xs w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                {(dateFrom || dateTo) &&
                <button className="text-[11px] text-red-500 hover:text-red-700 font-semibold" onClick={() => {setDateFrom("");setDateTo("");}}>✕ Limpiar</button>
                }
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 ml-auto" onClick={exportReportCSV}>
                  <Download className="h-3 w-3" /> Exportar Flujo CSV
                </Button>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                { label: "Facturado (período)", value: fmt(totalInvoicedFiltered), icon: FileText, bg: "bg-slate-700" },
                { label: "Recaudado (período)", value: fmt(totalPaidFiltered), icon: CheckCircle2, bg: "bg-emerald-600" },
                { label: "Por Cobrar (período)", value: fmt(totalInvoicedFiltered - totalPaidFiltered), icon: Clock, bg: "bg-amber-600" },
                { label: "Balance Tesorería", value: fmt(txInFiltered - txOutFiltered), icon: DollarSign, bg: txInFiltered - txOutFiltered >= 0 ? "bg-emerald-700" : "bg-red-600" }].
                map((s) =>
                <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                    <div className={`${s.bg} rounded-xl p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
                      <p className="font-bold text-lg truncate">{s.value}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-emerald-800 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-200" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-white">Flujo de Caja — Últimos 6 Meses</span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={cashFlowData} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10 }} width={60} />
                      <Tooltip formatter={(v) => [fmt(v)]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="egresos" name="Egresos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-slate-700 flex items-center gap-2">
                    <BarChart2 className="h-3.5 w-3.5 text-slate-200" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-white">Balance Acumulado</span>
                  </div>
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={balanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10 }} width={60} />
                        <Tooltip formatter={(v) => [fmt(v)]} />
                        <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: "#6366f1" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-violet-700 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-200" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-white">Efectividad — Reportes Negativos</span>
                  </div>
                  <div className="p-4 flex items-center gap-4">
                    {repStatus.length === 0 ?
                    <p className="text-sm text-muted-foreground text-center w-full py-8">Sin reportes registrados</p> :

                    <>
                        <ResponsiveContainer width="55%" height={200}>
                          <PieChart>
                            <Pie data={repStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                              {repStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          <p className="text-3xl font-black text-emerald-600">{eliminatedPct}%</p>
                          <p className="text-xs text-muted-foreground">tasa de eliminación</p>
                          {repStatus.map((r) =>
                        <div key={r.name} className="flex items-center gap-2 text-xs">
                              <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                              <span className="text-muted-foreground">{r.name}:</span>
                              <span className="font-bold">{r.value}</span>
                            </div>
                        )}
                          <p className="text-[10px] text-muted-foreground pt-1">Total: {totalRep} reportes</p>
                        </div>
                      </>
                    }
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-amber-700 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-amber-200" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-white">Pipeline Comercial — Clientes por Estado</span>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={clientStatusData} layout="vertical" barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="value" name="Clientes" radius={[0, 3, 3, 0]}>
                        {clientStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>);

        })()}

        {/* ============ NOTAS C/D ============ */}
        {tab === "notas" &&
        <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[
            { label: "Notas Crédito", value: creditNotes.filter((n) => n.type === "nota_credito").length, icon: TrendingDown, bg: "bg-blue-600", plain: true },
            { label: "Total Créditos", value: fmt(creditNotes.filter((n) => n.type === "nota_credito").reduce((s, n) => s + (n.value || 0), 0)), icon: FileText, bg: "bg-blue-700" },
            { label: "Total Débitos", value: fmt(creditNotes.filter((n) => n.type === "nota_debito").reduce((s, n) => s + (n.value || 0), 0)), icon: TrendingUp, bg: "bg-orange-600" }].
            map((s) =>
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                  <div className={`${s.bg} rounded-xl p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
                    <p className={`font-bold ${s.plain ? "text-2xl" : "text-sm"} truncate`}>{s.value}</p>
                  </div>
                </div>
            )}
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-orange-700 border-b border-border flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-orange-200" />
                <span className="text-xs font-semibold uppercase tracking-wide text-white">Registro de Notas de Crédito y Débito — Ajustes Contables</span>
              </div>
              {lcn ? <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div> :
            <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-left">Cliente</th>
                        <th className="px-4 py-2.5 text-left">Factura Afectada</th>
                        <th className="px-4 py-2.5 text-right">Valor</th>
                        <th className="px-4 py-2.5 text-left">Motivo del Ajuste</th>
                        <th className="px-4 py-2.5 text-left">Creado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditNotes.length === 0 &&
                  <tr><td colSpan={7} className="text-center py-10 text-muted-foreground text-sm">Sin notas registradas</td></tr>
                  }
                      {creditNotes.map((n, idx) =>
                  <tr key={n.id} className={`border-t border-border/50 hover:bg-secondary/40 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-4 py-2.5 font-mono text-[11px]">{fmtDate(n.created_date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${n.type === "nota_credito" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                              {n.type === "nota_credito" ? "NOTA CRÉDITO" : "NOTA DÉBITO"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs">{n.client_name || "—"}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] text-primary">{n.invoice_number || "—"}</td>
                          <td className={`px-4 py-2.5 text-right font-bold text-sm font-mono ${n.type === "nota_credito" ? "text-blue-600" : "text-orange-600"}`}>
                            {n.type === "nota_credito" ? "−" : "+"}{fmt(n.value)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[220px] truncate" title={n.motivo_ajuste}>{n.motivo_ajuste || "—"}</td>
                          <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{n.created_by_name || "—"}</td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>
            }
            </div>
          </>
        }
      </div>

      <InvoiceForm open={showInvoiceForm} onOpenChange={setShowInvoiceForm} invoice={editInvoice}
      onSuccess={() => {setShowInvoiceForm(false);qc.invalidateQueries({ queryKey: ["invoices"] });}} />
      <TreasuryTransactionForm open={showTxForm} onOpenChange={setShowTxForm} defaultType={txType}
      onSuccess={() => {setShowTxForm(false);qc.invalidateQueries({ queryKey: ["treasury_tx"] });}} />
      <ClientAccountStatement client={statementClient} open={!!statementClient} onOpenChange={(v) => {if (!v) setStatementClient(null);}} />
      <CreditNoteForm open={showCreditNoteForm} onOpenChange={setShowCreditNoteForm}
      onSuccess={() => {setShowCreditNoteForm(false);qc.invalidateQueries({ queryKey: ["credit_notes"] });}} />
      <CreditAgreementForm open={showCreditForm} onOpenChange={setShowCreditForm} defaultType="acuerdo_pago"
      prefilledClient={creditClient}
      onSuccess={() => {setShowCreditForm(false);qc.invalidateQueries({ queryKey: ["agreements"] });}} />
    </div>);

}