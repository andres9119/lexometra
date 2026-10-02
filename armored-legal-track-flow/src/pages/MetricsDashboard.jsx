import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { TrendingUp, TrendingDown, ShieldCheck, Wallet, Users, FileText, Target, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, addMonths, parseISO, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";

const fmt = (n) => n != null
  ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
  : "—";

const pct = (a, b) => b > 0 ? Math.round((a / b) * 100) : 0;

const KpiCard = ({ icon: Icon, label, value, sub, color = "text-foreground", bg = "bg-card", trend }) => (
  <div className={"rounded-xl border border-border p-4 shadow-sm flex items-start gap-3 " + bg}>
    <div className={"rounded-xl p-2.5 shrink-0 " + (bg === "bg-card" ? "bg-muted" : "bg-white/20")}>
      <Icon className={"h-5 w-5 " + color} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={"text-xl font-bold mt-0.5 " + color}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {trend != null && (
        <div className={"flex items-center gap-1 text-xs mt-1 font-semibold " + (trend >= 0 ? "text-emerald-600" : "text-red-500")}>
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {trend >= 0 ? "+" : ""}{trend}% vs mes anterior
        </div>
      )}
    </div>
  </div>
);

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#0ea5e9", "#8b5cf6"];

export default function MetricsDashboard() {
  const { data: reports = [], isLoading: lr } = useQuery({ queryKey: ["neg_reports_all"], queryFn: () => base44.entities.ClientNegativeReport.list() });
  const { data: invoices = [], isLoading: li } = useQuery({ queryKey: ["invoices_all"], queryFn: () => base44.entities.Invoice.list() });
  const { data: installments = [], isLoading: lin } = useQuery({ queryKey: ["installments_all"], queryFn: () => base44.entities.CreditInstallment.list() });
  const { data: clients = [], isLoading: lc } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ["treasury_tx"], queryFn: () => base44.entities.TreasuryTransaction.list("-date") });

  const isLoading = lr || li || lin || lc;

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
    </div>
  );

  // ── 1. ELIMINACIÓN DE REPORTES NEGATIVOS ──────────────────────────
  const totalReports = reports.length;
  const eliminados = reports.filter(r => r.status === "eliminado").length;
  const enGestion = reports.filter(r => r.status === "en_gestion").length;
  const pendientes = reports.filter(r => r.status === "pendiente").length;
  const successRate = pct(eliminados, totalReports);

  // Por tipo de reporte
  const reportsByType = ["dudoso_recaudo", "cartera_castigada", "mora", "otro"].map(type => {
    const total = reports.filter(r => r.report_type === type).length;
    const done = reports.filter(r => r.report_type === type && r.status === "eliminado").length;
    return { name: type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), total, eliminados: done, tasa: pct(done, total) };
  }).filter(r => r.total > 0);

  // ── 2. PROYECCIÓN DE RECAUDO MENSUAL ──────────────────────────────
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const nextMonthStart = startOfMonth(addMonths(now, 1));
  const nextMonthEnd = endOfMonth(addMonths(now, 1));

  // Facturas pendientes por cobrar
  const pendingInvoices = invoices.filter(i => i.status === "pendiente" || i.status === "parcial" || i.status === "vencida");
  const totalPending = pendingInvoices.reduce((s, i) => s + ((i.amount || 0) - (i.amount_paid || 0)), 0);

  // Cuotas de acuerdos venciendo este mes
  const installmentsThisMonth = installments.filter(inst => {
    if (inst.status !== "pendiente" || !inst.due_date) return false;
    try { return isWithinInterval(parseISO(inst.due_date), { start: thisMonthStart, end: thisMonthEnd }); } catch { return false; }
  });
  const installmentsNextMonth = installments.filter(inst => {
    if (inst.status !== "pendiente" || !inst.due_date) return false;
    try { return isWithinInterval(parseISO(inst.due_date), { start: nextMonthStart, end: nextMonthEnd }); } catch { return false; }
  });

  const recaudoEsperadoMes = installmentsThisMonth.reduce((s, i) => s + (i.amount || 0), 0);
  const recaudoEsperadoSig = installmentsNextMonth.reduce((s, i) => s + (i.amount || 0), 0);

  // Recaudo real de los últimos 6 meses (basado en TreasuryTransaction tipo ingreso)
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = addMonths(now, -5 + i);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const ingresos = transactions
      .filter(t => t.type === "ingreso" && t.date)
      .filter(t => { try { return isWithinInterval(parseISO(t.date), { start, end }); } catch { return false; } })
      .reduce((s, t) => s + (t.amount || 0), 0);
    const cuotas = installments
      .filter(inst => inst.status === "pagada" && inst.payment_date)
      .filter(inst => { try { return isWithinInterval(parseISO(inst.payment_date), { start, end }); } catch { return false; } })
      .reduce((s, inst) => s + (inst.amount_paid || inst.amount || 0), 0);
    return {
      mes: format(d, "MMM", { locale: es }),
      ingresos: Math.round(ingresos / 1000),
      cuotas: Math.round(cuotas / 1000),
    };
  });

  // Proyección próximos 2 meses
  last6Months.push({
    mes: format(addMonths(now, 1), "MMM", { locale: es }) + " (proy.)",
    ingresos: 0,
    cuotas: Math.round(recaudoEsperadoSig / 1000),
    proyeccion: true,
  });

  // Facturación por estado
  const invoicesByStatus = [
    { name: "Pagada", value: invoices.filter(i => i.status === "pagada").length, color: "#10b981" },
    { name: "Pendiente", value: invoices.filter(i => i.status === "pendiente").length, color: "#f59e0b" },
    { name: "Vencida", value: invoices.filter(i => i.status === "vencida").length, color: "#ef4444" },
    { name: "Parcial", value: invoices.filter(i => i.status === "parcial").length, color: "#6366f1" },
    { name: "Anulada", value: invoices.filter(i => i.status === "anulada").length, color: "#94a3b8" },
  ].filter(i => i.value > 0);

  // Clientes activos vs perdidos
  const activeClients = clients.filter(c => !["finalizado", "perdido"].includes(c.status)).length;
  const finalizedClients = clients.filter(c => c.status === "finalizado").length;
  const lostClients = clients.filter(c => c.status === "perdido").length;

  // Tasa de conversión (contratos firmados o más avanzados / total)
  const converted = clients.filter(c => ["contrato_firmado", "peticion_radicada", "en_tramite", "finalizado"].includes(c.status)).length;
  const conversionRate = pct(converted, clients.length);

  return (
    <div className="p-5 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold">Panel de Métricas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Indicadores clave de rendimiento — actualización en tiempo real</p>
      </div>

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={ShieldCheck}
          label="Tasa de Éxito Reportes"
          value={successRate + "%"}
          sub={eliminados + " eliminados de " + totalReports + " totales"}
          color={successRate >= 70 ? "text-emerald-600" : successRate >= 40 ? "text-amber-600" : "text-red-500"}
        />
        <KpiCard
          icon={Wallet}
          label="Recaudo Esperado (mes)"
          value={fmt(recaudoEsperadoMes)}
          sub={installmentsThisMonth.length + " cuota(s) pendiente(s) este mes"}
          color="text-blue-600"
        />
        <KpiCard
          icon={Target}
          label="Cartera por Cobrar"
          value={fmt(totalPending)}
          sub={pendingInvoices.length + " factura(s) pendientes"}
          color="text-amber-600"
        />
        <KpiCard
          icon={Users}
          label="Tasa de Conversión"
          value={conversionRate + "%"}
          sub={converted + " clientes convertidos de " + clients.length}
          color={conversionRate >= 60 ? "text-emerald-600" : "text-amber-600"}
        />
      </div>

      {/* ── Sección 1: Eliminación de Reportes ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-emerald-800 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-200" />
          <span className="text-sm font-bold text-white">Indicadores de Eliminación de Reportes Negativos</span>
        </div>
        <div className="p-5 grid lg:grid-cols-3 gap-6">
          {/* Gauge visual */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none"
                  stroke={successRate >= 70 ? "#10b981" : successRate >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="12"
                  strokeDasharray={"" + (successRate / 100) * 314 + " 314"}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                <span className="text-3xl font-extrabold">{successRate}%</span>
                <span className="text-xs text-muted-foreground">éxito</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full text-center text-xs">
              <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                <p className="font-bold text-emerald-700 text-lg">{eliminados}</p>
                <p className="text-emerald-600">Eliminados</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 border border-amber-200">
                <p className="font-bold text-amber-700 text-lg">{enGestion}</p>
                <p className="text-amber-600">En Gestión</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                <p className="font-bold text-slate-700 text-lg">{pendientes}</p>
                <p className="text-slate-600">Pendientes</p>
              </div>
            </div>
          </div>

          {/* Tasa por tipo */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tasa de Éxito por Tipo de Reporte</p>
            {reportsByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de reportes</p>
            ) : (
              <div className="space-y-3">
                {reportsByType.map(r => (
                  <div key={r.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">{r.name}</span>
                      <span className="text-muted-foreground">{r.eliminados}/{r.total} eliminados — <strong className={r.tasa >= 70 ? "text-emerald-600" : r.tasa >= 40 ? "text-amber-600" : "text-red-500"}>{r.tasa}%</strong></span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={"h-full rounded-full transition-all " + (r.tasa >= 70 ? "bg-emerald-500" : r.tasa >= 40 ? "bg-amber-400" : "bg-red-400")}
                        style={{ width: r.tasa + "%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Estados de reportes pie */}
            {totalReports > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Distribución de Estados</p>
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: "Eliminados", value: eliminados },
                          { name: "En Gestión", value: enGestion },
                          { name: "Pendientes", value: pendientes },
                        ].filter(d => d.value > 0)} dataKey="value" cx="50%" cy="50%" outerRadius={38} innerRadius={18}>
                          {[{ color: "#10b981" }, { color: "#f59e0b" }, { color: "#94a3b8" }].map((c, i) => (
                            <Cell key={i} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [v, ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Eliminados: <strong>{eliminados}</strong></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> En gestión: <strong>{enGestion}</strong></div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Pendientes: <strong>{pendientes}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sección 2: Proyección de Recaudo ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-blue-900 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-blue-200" />
          <span className="text-sm font-bold text-white">Proyección de Recaudo Mensual</span>
        </div>
        <div className="p-5 grid lg:grid-cols-3 gap-6">
          {/* KPIs recaudo */}
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 mb-1">Cuotas esperadas este mes</p>
              <p className="text-2xl font-extrabold text-blue-800">{fmt(recaudoEsperadoMes)}</p>
              <p className="text-xs text-blue-600 mt-0.5">{installmentsThisMonth.length} cuota(s) de acuerdos de pago</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 mb-1">Proyección próximo mes</p>
              <p className="text-2xl font-extrabold text-violet-800">{fmt(recaudoEsperadoSig)}</p>
              <p className="text-xs text-violet-600 mt-0.5">{installmentsNextMonth.length} cuota(s) programadas</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-1">Cartera total por cobrar</p>
              <p className="text-xl font-extrabold text-amber-800">{fmt(totalPending)}</p>
              <p className="text-xs text-amber-600 mt-0.5">En {pendingInvoices.length} factura(s) pendientes</p>
            </div>

            {/* Cuotas vencidas */}
            {(() => {
              const overdue = installments.filter(i => i.status === "vencida");
              const overdueAmt = overdue.reduce((s, i) => s + (i.amount || 0), 0);
              return overdue.length > 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-700">{overdue.length} cuota(s) vencida(s)</p>
                    <p className="text-xs text-red-600">{fmt(overdueAmt)} en mora</p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-emerald-700">Sin cuotas vencidas ✓</p>
                </div>
              );
            })()}
          </div>

          {/* Gráfico recaudo 6m + proyección */}
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Ingresos Reales vs Proyección de Cuotas (miles COP)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last6Months} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v, name) => [v + "K COP", name === "ingresos" ? "Ingresos tesorería" : "Cuotas acuerdos"]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ingresos" name="Ingresos tesorería" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cuotas" name="Cuotas acuerdos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Facturas por estado */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Estado de Facturación</p>
              <div className="flex items-center gap-6">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={invoicesByStatus} dataKey="value" cx="50%" cy="50%" outerRadius={48} innerRadius={22}>
                        {invoicesByStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [v + " facturas", ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {invoicesByStatus.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: s.color }} />
                      <span className="text-muted-foreground">{s.name}:</span>
                      <strong>{s.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sección 3: Pipeline comercial ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-700 flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-200" />
          <span className="text-sm font-bold text-white">Pipeline Comercial</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { key: "prospecto", label: "Prospectos", color: "bg-slate-100 text-slate-700", border: "border-slate-300" },
              { key: "contactado", label: "Contactados", color: "bg-blue-100 text-blue-700", border: "border-blue-300" },
              { key: "contrato_firmado", label: "C. Firmado", color: "bg-violet-100 text-violet-700", border: "border-violet-300" },
              { key: "peticion_radicada", label: "Petición", color: "bg-amber-100 text-amber-700", border: "border-amber-300" },
              { key: "en_tramite", label: "En Trámite", color: "bg-orange-100 text-orange-700", border: "border-orange-300" },
              { key: "finalizado", label: "Finalizados", color: "bg-emerald-100 text-emerald-700", border: "border-emerald-300" },
              { key: "perdido", label: "Perdidos", color: "bg-red-100 text-red-700", border: "border-red-300" },
            ].map(s => {
              const count = clients.filter(c => c.status === s.key).length;
              const pctVal = pct(count, clients.length);
              return (
                <div key={s.key} className={"rounded-xl border p-3 text-center " + s.color + " " + s.border}>
                  <p className="text-2xl font-extrabold">{count}</p>
                  <p className="text-[10px] font-semibold mt-0.5">{s.label}</p>
                  <p className="text-[10px] opacity-70">{pctVal}%</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Tasa de conversión global (prospecto → contrato o más): <strong className="text-foreground">{conversionRate}%</strong></span>
            <span>·</span>
            <span>Total clientes: <strong className="text-foreground">{clients.length}</strong></span>
            <span>·</span>
            <span>Activos: <strong className="text-foreground">{activeClients}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}