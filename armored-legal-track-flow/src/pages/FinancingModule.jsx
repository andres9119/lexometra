import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CreditCard, Plus, FileText, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp, Download, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import CreditAgreementForm from "@/components/CreditAgreementForm";
import { generateAgreementPDF } from "@/utils/generateAgreementPDF";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (d) => { try { return format(parseISO(d), "dd/MM/yyyy", { locale: es }); } catch { return d || "—"; } };

const STATUS_CFG = {
  activo:     { label: "Activo",     color: "bg-emerald-100 text-emerald-700", icon: Clock },
  completado: { label: "Completado", color: "bg-blue-100 text-blue-700",       icon: CheckCircle2 },
  anulado:    { label: "Anulado",    color: "bg-red-100 text-red-600",         icon: XCircle },
};

const INST_STATUS = {
  pendiente: { label: "Pendiente", color: "bg-amber-100 text-amber-700" },
  pagada:    { label: "Pagada",    color: "bg-emerald-100 text-emerald-700" },
  vencida:   { label: "Vencida",   color: "bg-red-100 text-red-700" },
};

const TABS = [
  { id: "credito",      label: "Créditos",          color: "bg-slate-700" },
  { id: "acuerdo_pago", label: "Acuerdos de Pago",  color: "bg-amber-700" },
];

function AgreementCard({ agreement }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: installments = [] } = useQuery({
    queryKey: ["installments", agreement.id],
    queryFn: () => base44.entities.CreditInstallment.filter({ agreement_id: agreement.id }, "installment_number"),
    enabled: open,
  });

  const markPaid = useMutation({
    mutationFn: ({ id, amount }) => base44.entities.CreditInstallment.update(id, {
      status: "pagada", amount_paid: amount, payment_date: new Date().toISOString().split("T")[0],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["installments", agreement.id] }); toast.success("Cuota marcada como pagada"); },
  });

  const deleteAgreement = useMutation({
    mutationFn: () => base44.entities.CreditAgreement.delete(agreement.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agreements"] }); toast.success("Acuerdo eliminado"); },
  });

  const st = STATUS_CFG[agreement.status] || STATUS_CFG.activo;
  const paidCount = installments.filter(i => i.status === "pagada").length;
  const progress = installments.length > 0 ? (paidCount / installments.length) * 100 : 0;

  const handlePDF = async () => {
    let insts = installments;
    if (insts.length === 0) {
      insts = await base44.entities.CreditInstallment.filter({ agreement_id: agreement.id }, "installment_number");
    }
    generateAgreementPDF(agreement, insts);
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${st.color}`}>{st.label}</span>
            <span className="font-semibold text-sm truncate">{agreement.description}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{agreement.client_name} · CC {agreement.client_cc} · Inicio: {fmtDate(agreement.start_date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handlePDF}>
            <Download className="h-3 w-3" /> Ver Acuerdo PDF
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(v => !v)}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteAgreement.mutate()}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-0 divide-x divide-border border-b border-border">
        {[
          { label: "Capital", value: fmt(agreement.total_amount) },
          { label: `Tasa ${agreement.interest_rate || 0}% / mes`, value: fmt(agreement.total_with_interest) },
          { label: "Cuotas", value: `${agreement.num_installments}` },
          { label: "Valor cuota", value: fmt(agreement.installment_amount) },
          { label: "Pagadas", value: open ? `${paidCount} / ${installments.length}` : `${agreement.num_installments} cuotas` },
        ].map(s => (
          <div key={s.label} className="px-4 py-2.5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            <p className="font-bold text-xs mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {open && installments.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/10">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progreso de pago</span>
            <span className="font-bold text-emerald-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Installments table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border bg-muted/20">
                <th className="px-4 py-2 text-center">No.</th>
                <th className="px-4 py-2 text-center">Vencimiento</th>
                <th className="px-4 py-2 text-right">Capital</th>
                <th className="px-4 py-2 text-right">Interés</th>
                <th className="px-4 py-2 text-right">Cuota</th>
                <th className="px-4 py-2 text-right">Saldo</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((inst, idx) => {
                const ist = INST_STATUS[inst.status] || INST_STATUS.pendiente;
                return (
                  <tr key={inst.id} className={`border-t border-border/50 transition-colors ${idx % 2 !== 0 ? "bg-muted/10" : ""} ${inst.status === "pagada" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2 text-center font-mono text-xs font-bold">{inst.installment_number}</td>
                    <td className="px-4 py-2 text-center font-mono text-xs">{fmtDate(inst.due_date)}</td>
                    <td className="px-4 py-2 text-right text-xs">{fmt(inst.capital)}</td>
                    <td className="px-4 py-2 text-right text-xs text-rose-600">{fmt(inst.interest)}</td>
                    <td className="px-4 py-2 text-right text-xs font-bold">{fmt(inst.amount)}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">{fmt(inst.balance)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${ist.color}`}>{ist.label}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {inst.status !== "pagada" && (
                        <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                          disabled={markPaid.isPending}
                          onClick={() => markPaid.mutate({ id: inst.id, amount: inst.amount })}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Pagar
                        </Button>
                      )}
                      {inst.status === "pagada" && (
                        <span className="text-[10px] text-muted-foreground">{fmtDate(inst.payment_date)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30 font-bold">
                <td colSpan={2} className="px-4 py-2 text-xs uppercase">Total</td>
                <td className="px-4 py-2 text-right text-xs">{fmt(installments.reduce((s,i)=>s+(i.capital||0),0))}</td>
                <td className="px-4 py-2 text-right text-xs text-rose-600">{fmt(installments.reduce((s,i)=>s+(i.interest||0),0))}</td>
                <td className="px-4 py-2 text-right text-xs">{fmt(installments.reduce((s,i)=>s+(i.amount||0),0))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function FinancingModule() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("credito");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("credito");

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["agreements"],
    queryFn: () => base44.entities.CreditAgreement.list("-created_date"),
  });

  const filtered = agreements.filter(a => a.type === tab);
  const totalCapital = filtered.reduce((s, a) => s + (a.total_amount || 0), 0);
  const totalInterest = filtered.reduce((s, a) => s + ((a.total_with_interest || 0) - (a.total_amount || 0)), 0);
  const activeCount = filtered.filter(a => a.status === "activo").length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Module header */}
      <div className="flex items-center justify-between px-6 py-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-sidebar-primary" />
          <span className="text-sidebar-foreground font-semibold text-sm tracking-wide">FINANCIAMIENTO — CRÉDITOS Y ACUERDOS DE PAGO</span>
        </div>
        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs"
          onClick={() => { setFormType(tab); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5" /> {tab === "credito" ? "Nuevo Crédito" : "Nuevo Acuerdo"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-0.5 px-5 pt-3 bg-card border-b border-border shrink-0">
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-all ${
                active ? `${t.color} text-white border-transparent -mb-px pb-3` : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              }`}>
              <FileText className="h-3.5 w-3.5" />
              {t.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20" : "bg-border text-muted-foreground"}`}>
                {agreements.filter(a => a.type === t.id).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-5 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Registros", value: filtered.length, icon: FileText, bg: "bg-slate-700", plain: true },
            { label: "Activos", value: activeCount, icon: Clock, bg: "bg-violet-600", plain: true },
            { label: "Capital Total", value: fmt(totalCapital), icon: DollarSign, bg: "bg-emerald-700" },
            { label: "Intereses Totales", value: fmt(totalInterest), icon: DollarSign, bg: "bg-rose-700" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`${s.bg} rounded-xl p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{s.label}</p>
                <p className={`font-bold ${s.plain ? "text-2xl" : "text-sm"} truncate`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Agreements */}
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map(a => <AgreementCard key={a.id} agreement={a} />)}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl text-center py-14">
            <CreditCard className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sin {tab === "credito" ? "créditos" : "acuerdos de pago"} registrados</p>
            <Button variant="outline" className="mt-4 text-sm" onClick={() => { setFormType(tab); setShowForm(true); }}>
              Crear {tab === "credito" ? "primer crédito" : "primer acuerdo"}
            </Button>
          </div>
        )}
      </div>

      <CreditAgreementForm open={showForm} onOpenChange={setShowForm} defaultType={formType}
        onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["agreements"] }); }} />
    </div>
  );
}