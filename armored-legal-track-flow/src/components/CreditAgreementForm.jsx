import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { calculateAmortization, calcInstallmentAmount, calcTotalWithInterest } from "@/utils/amortization";
import { generateAgreementPDF } from "@/utils/generateAgreementPDF";
import { Download, Search } from "lucide-react";

const empty = {
  type: "credito", client_id: "", client_name: "", client_cc: "", client_phone: "",
  description: "", total_amount: "", interest_rate: "0", num_installments: "12",
  start_date: new Date().toISOString().split("T")[0], status: "activo", notes: "",
};

export default function CreditAgreementForm({ open, onOpenChange, defaultType, prefilledClient, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [modifyInstallments, setModifyInstallments] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [createdAgreement, setCreatedAgreement] = useState(null);
  const [step, setStep] = useState(1); // 1=form, 2=success

  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });

  useEffect(() => {
    const base = { ...empty, type: defaultType || "credito" };
    if (prefilledClient) {
      base.client_id = prefilledClient.id || "";
      base.client_name = prefilledClient.full_name || "";
      base.client_cc = prefilledClient.cc || "";
      base.client_phone = prefilledClient.phone || "";
      // For acuerdo_pago auto-fill pending balance
      if ((defaultType === "acuerdo_pago") && prefilledClient.pending_balance > 0) {
        base.total_amount = String(prefilledClient.pending_balance);
      }
      setClientSearch(prefilledClient.full_name || "");
    } else {
      setClientSearch("");
    }
    setForm(base);
    setSchedule([]);
    setModifyInstallments(false);
    setShowClientList(false);
    setStep(1);
    setCreatedAgreement(null);
  }, [open, defaultType, prefilledClient]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filteredClients = clients.filter(c =>
    !clientSearch || c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.cc?.includes(clientSearch)
  ).slice(0, 8);

  const selectClient = (c) => {
    set("client_id", c.id); set("client_name", c.full_name);
    set("client_cc", c.cc); set("client_phone", c.phone || "");
    setClientSearch(c.full_name); setShowClientList(false);
  };

  // Recalculate schedule when params change
  useEffect(() => {
    const principal = parseFloat(form.total_amount) || 0;
    const rate = parseFloat(form.interest_rate) / 100 || 0;
    const n = parseInt(form.num_installments) || 0;
    if (principal > 0 && n > 0) {
      const sched = calculateAmortization(principal, rate, n, form.start_date);
      setSchedule(sched);
    } else {
      setSchedule([]);
    }
  }, [form.total_amount, form.interest_rate, form.num_installments, form.start_date]);

  const updateInstallmentAmount = (idx, val) => {
    setSchedule(prev => prev.map((s, i) => i === idx ? { ...s, amount: parseFloat(val) || 0 } : s));
  };

  const totalScheduled = schedule.reduce((s, q) => s + (q.amount || 0), 0);
  const principal = parseFloat(form.total_amount) || 0;
  const rate = parseFloat(form.interest_rate) / 100 || 0;
  const n = parseInt(form.num_installments) || 0;
  const installmentAmt = calcInstallmentAmount(principal, rate, n);
  const totalWithInterest = calcTotalWithInterest(principal, rate, n);

  const fmt = (v) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const agreementData = {
        ...data,
        total_amount: parseFloat(data.total_amount) || 0,
        interest_rate: parseFloat(data.interest_rate) || 0,
        num_installments: parseInt(data.num_installments) || 0,
        installment_amount: installmentAmt,
        total_with_interest: modifyInstallments ? totalScheduled : totalWithInterest,
      };
      const agreement = await base44.entities.CreditAgreement.create(agreementData);
      // Create installments
      await Promise.all(schedule.map(inst =>
        base44.entities.CreditInstallment.create({ ...inst, agreement_id: agreement.id })
      ));
      return agreement;
    },
    onSuccess: (agreement) => {
      toast.success(`${form.type === "credito" ? "Crédito" : "Acuerdo de pago"} creado exitosamente`);
      setCreatedAgreement(agreement);
      setStep(2);
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.client_name.trim()) return toast.error("Seleccione un cliente");
    if (!form.description.trim()) return toast.error("La descripción es requerida");
    if (!principal || principal <= 0) return toast.error("El valor debe ser mayor a 0");
    if (n <= 0) return toast.error("Ingrese el número de cuotas");
    if (modifyInstallments && Math.round(totalScheduled) !== Math.round(totalWithInterest)) {
      return toast.error(`La suma de cuotas (${fmt(totalScheduled)}) debe coincidir con el total (${fmt(totalWithInterest)})`);
    }
    createMutation.mutate(form);
  };

  const handleViewPDF = async () => {
    if (!createdAgreement) return;
    const insts = await base44.entities.CreditInstallment.filter({ agreement_id: createdAgreement.id }, "installment_number");
    generateAgreementPDF(createdAgreement, insts);
  };

  const typeLabel = form.type === "credito" ? "Crédito" : "Acuerdo de Pago";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? `Crear ${typeLabel}` : `✅ ${typeLabel} Creado`}
          </DialogTitle>
        </DialogHeader>

        {step === 2 ? (
          // SUCCESS SCREEN
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="font-bold text-lg">{typeLabel} creado exitosamente</p>
              <p className="text-muted-foreground text-sm mt-1">{createdAgreement?.description} — {createdAgreement?.client_name}</p>
              <p className="text-sm mt-1">Capital: <strong>{fmt(createdAgreement?.total_amount)}</strong> · {createdAgreement?.num_installments} cuotas de <strong>{fmt(createdAgreement?.installment_amount)}</strong></p>
            </div>
            <div className="bg-muted/30 rounded-xl p-4 text-sm text-left space-y-1.5">
              <p>El sistema generó automáticamente el plan de amortización con <strong>{schedule.length} cuotas</strong>.</p>
              <p>Puede descargar el acuerdo en PDF para imprimir y hacer firmar al cliente.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { onSuccess?.(); }}>Cerrar</Button>
              <Button className="gap-2" onClick={handleViewPDF}>
                <Download className="h-4 w-4" /> Ver Acuerdo PDF
              </Button>
            </div>
          </div>
        ) : (
          // FORM
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type */}
            <div className="grid grid-cols-2 gap-2">
              {["credito","acuerdo_pago"].map(t => (
                <button key={t} type="button" onClick={() => set("type", t)}
                  className={`py-2 rounded-lg border text-sm font-semibold transition-all ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-secondary"}`}>
                  {t === "credito" ? "💳 Crédito" : "🤝 Acuerdo de Pago"}
                </button>
              ))}
            </div>

            {/* Client search */}
            <div>
              <Label>Cliente *</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar por nombre o cédula..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientList(true); if (!e.target.value) { set("client_id",""); set("client_name",""); set("client_cc",""); } }}
                  onFocus={() => setShowClientList(true)}
                />
              </div>
              {showClientList && filteredClients.length > 0 && (
                <div className="border border-border rounded-lg bg-card shadow-lg mt-1 max-h-40 overflow-auto z-50">
                  {filteredClients.map(c => (
                    <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-secondary text-sm"
                      onClick={() => selectClient(c)}>
                      <span className="font-medium">{c.full_name}</span>
                      <span className="text-muted-foreground text-xs ml-2">CC {c.cc} · {c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {form.client_name && (
                <div className="mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs text-emerald-700">
                  ✓ {form.client_name} — CC {form.client_cc}
                </div>
              )}
            </div>

            {/* Description */}
            <div><Label>Descripción *</Label><Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Ej: Crédito por servicios de eliminación de reportes" /></div>

            {/* Credit params */}
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Valor (COP) *</Label><Input type="number" value={form.total_amount} onChange={e => set("total_amount", e.target.value)} placeholder="0" /></div>
              <div><Label>Tasa interés (% / mes)</Label><Input type="number" step="0.01" value={form.interest_rate} onChange={e => set("interest_rate", e.target.value)} placeholder="0" /></div>
              <div><Label>No. de cuotas *</Label><Input type="number" value={form.num_installments} onChange={e => set("num_installments", e.target.value)} placeholder="12" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha inicio</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
              <div><Label>Estado</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="completado">Completado</SelectItem>
                    <SelectItem value="anulado">Anulado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Computed summary */}
            {principal > 0 && n > 0 && (
              <div className="grid grid-cols-3 gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3">
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Valor cuota</p><p className="font-bold text-sm">{fmt(installmentAmt)}</p></div>
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Total intereses</p><p className="font-bold text-sm text-rose-600">{fmt(totalWithInterest - principal)}</p></div>
                <div className="text-center"><p className="text-[10px] text-muted-foreground uppercase">Total a pagar</p><p className="font-bold text-sm text-primary">{fmt(totalWithInterest)}</p></div>
              </div>
            )}

            {/* Modify installments toggle */}
            {schedule.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-semibold">Modificar cuotas individualmente</p>
                  <p className="text-xs text-muted-foreground">Ajusta el valor de cada cuota (la suma debe coincidir con el total)</p>
                </div>
                <Switch checked={modifyInstallments} onCheckedChange={setModifyInstallments} />
              </div>
            )}

            {/* Schedule table */}
            {schedule.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tabla de Amortización</span>
                  {modifyInstallments && (
                    <span className={`text-[11px] font-bold ${Math.round(totalScheduled) !== Math.round(totalWithInterest) ? "text-red-600" : "text-emerald-600"}`}>
                      Suma: {fmt(totalScheduled)} {Math.round(totalScheduled) !== Math.round(totalWithInterest) ? `≠ ${fmt(totalWithInterest)}` : "✓"}
                    </span>
                  )}
                </div>
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide border-b border-border">
                        <th className="px-3 py-2 text-center">No.</th>
                        <th className="px-3 py-2 text-center">Vencimiento</th>
                        <th className="px-3 py-2 text-right">Capital</th>
                        <th className="px-3 py-2 text-right">Interés</th>
                        <th className="px-3 py-2 text-right">Cuota</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((inst, idx) => (
                        <tr key={idx} className={`border-t border-border/40 ${idx % 2 !== 0 ? "bg-muted/10" : ""}`}>
                          <td className="px-3 py-1.5 text-center font-bold">{inst.installment_number}</td>
                          <td className="px-3 py-1.5 text-center font-mono">{inst.due_date}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(inst.capital)}</td>
                          <td className="px-3 py-1.5 text-right text-rose-600">{fmt(inst.interest)}</td>
                          <td className="px-3 py-1.5 text-right font-bold">
                            {modifyInstallments ? (
                              <Input type="number" className="h-6 text-xs w-28 text-right p-1" value={inst.amount}
                                onChange={e => updateInstallmentAmount(idx, e.target.value)} />
                            ) : fmt(inst.amount)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt(inst.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div><Label>Observaciones</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || (modifyInstallments && Math.round(totalScheduled) !== Math.round(totalWithInterest))}>
                {createMutation.isPending ? "Creando..." : `Crear ${typeLabel}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}