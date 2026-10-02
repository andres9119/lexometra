import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Users, DollarSign, TrendingUp, Award, Info, ChevronDown, ChevronUp, Phone, Landmark, Edit2, Coins } from "lucide-react";
import ReferralLinkCard from "@/components/ReferralLinkCard";
import { sanitizeName } from "@/utils/textFormat";
import { Button } from "@/components/ui/button";
import ReferrerForm from "@/components/ReferrerForm";
import CommissionsPanel from "./CommissionsPanel";

const fmt = (n) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

function ReferrerCard({ r, refClients, commission, totalFacturadoPagado, totalAgreed, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = r.status === "activo";

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <div
        className={`px-4 py-3 flex items-center justify-between cursor-pointer select-none transition-colors ${isActive ? "bg-emerald-50 hover:bg-emerald-100/70 border-b border-emerald-100" : "bg-muted/40 hover:bg-muted/60 border-b border-border"}`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isActive ? "bg-emerald-500" : "bg-slate-400"}`}>
            {sanitizeName(r.full_name).charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{sanitizeName(r.full_name)}</p>
            <p className="text-xs text-muted-foreground">CC {r.cc} · {r.commission_percent}% comisión</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {isActive ? "Activo" : "Inactivo"}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Summary row — always visible */}
      <div className="px-4 py-2.5 grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/20">
        <div className="text-center pr-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Referidos</p>
          <p className="text-sm font-bold text-primary">{refClients.length}</p>
        </div>
        <div className="text-center px-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Facturado</p>
          <p className="text-sm font-bold text-emerald-700">{fmt(totalFacturadoPagado)}</p>
        </div>
        <div className="text-center pl-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Comisión</p>
          <p className="text-sm font-bold text-amber-600">{fmt(commission)}</p>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Contact & bank */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" /> Teléfono</span>
              <span className="font-medium">{r.phone || "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Landmark className="h-3 w-3" /> Banco</span>
              <span className="font-medium text-right">{r.bank_name ? `${r.bank_name}${r.bank_account ? ` · ${r.bank_account}` : ""}` : "—"}</span>
            </div>
          </div>

          {/* Finance summary */}
          <div className="border-t border-border pt-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Valor pactado total</span>
              <span className="font-medium">{fmt(totalAgreed)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Facturado y pagado</span>
              <span className="font-medium text-emerald-700">{fmt(totalFacturadoPagado)}</span>
            </div>
          </div>

          {/* Commission box */}
          <div className="flex justify-between items-center bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <div>
              <span className="text-xs font-semibold text-amber-700">Comisión causada</span>
              <p className="text-[10px] text-amber-600 flex items-center gap-1"><Info className="h-2.5 w-2.5" />Solo sobre facturas pagadas</p>
            </div>
            <span className="font-bold text-amber-700 text-sm">{fmt(commission)}</span>
          </div>

          {/* Clients list */}
          {refClients.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Clientes referidos</p>
              <div className="space-y-1 max-h-36 overflow-auto">
                {refClients.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-2.5 py-1.5">
                    <span className="truncate text-foreground">{sanitizeName(c.full_name)}</span>
                    <span className="text-muted-foreground ml-2 shrink-0 font-medium">{fmt(c.agreed_value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReferralLinkCard referrerId={r.id} />

          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 mt-1"
            onClick={() => onEdit(r)}>
            <Edit2 className="h-3 w-3" /> Editar
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Referrals() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editReferrer, setEditReferrer] = useState(null);
  const [activeTab, setActiveTab] = useState("referidos");

  const { data: referrers = [], isLoading } = useQuery({ queryKey: ["referrers"], queryFn: () => base44.entities.Referrer.list("-created_date") });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.list() });
  const { data: paidInvoices = [] } = useQuery({
    queryKey: ["invoices_pagadas"],
    queryFn: () => base44.entities.Invoice.filter({ status: "Pagada" }),
  });

  const getReferrerClients = (referrerId) => clients.filter(c => c.referrer_id === referrerId);

  const getCommissionEarned = (referrerId, commissionPct) => {
    const refClientIds = new Set(getReferrerClients(referrerId).map(c => c.id));
    const totalPaid = paidInvoices
      .filter(inv => refClientIds.has(inv.client_id))
      .reduce((s, inv) => s + (inv.amount || 0), 0);
    return (totalPaid * (commissionPct || 0)) / 100;
  };

  const totalCommissions = referrers.reduce((s, r) => s + getCommissionEarned(r.id, r.commission_percent), 0);

  const handleEdit = (r) => { setEditReferrer(r); setShowForm(true); };

  if (activeTab === "comisiones") {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-0 px-6 pt-3 bg-sidebar border-b border-sidebar-border shrink-0">
          <Award className="h-5 w-5 text-sidebar-primary mr-2" />
          <button
            onClick={() => setActiveTab("referidos")}
            className="px-4 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground border-b-2 border-transparent transition-colors"
          >Referidos</button>
          <button
            className="px-4 py-2.5 text-sm font-medium text-sidebar-primary border-b-2 border-sidebar-primary transition-colors"
          ><span className="flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" />Comisiones</span></button>
        </div>
        <div className="flex-1 overflow-auto">
          <CommissionsPanel embedded />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 pt-3 bg-sidebar border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-0">
          <Award className="h-5 w-5 text-sidebar-primary mr-2" />
          <button
            className="px-4 py-2.5 text-sm font-medium text-sidebar-primary border-b-2 border-sidebar-primary transition-colors"
          >Referidos</button>
          <button
            onClick={() => setActiveTab("comisiones")}
            className="px-4 py-2.5 text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground border-b-2 border-transparent transition-colors flex items-center gap-1.5"
          ><Coins className="h-3.5 w-3.5" />Comisiones</button>
        </div>
        <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 text-xs mb-3"
          onClick={() => { setEditReferrer(null); setShowForm(true); }}>
          <Plus className="h-3.5 w-3.5" /> Nuevo Referidor
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Referidores Activos", value: referrers.filter(r => r.status === "activo").length, icon: Users, color: "bg-blue-600" },
            { label: "Total Clientes Referidos", value: clients.filter(c => c.referrer_id).length, icon: TrendingUp, color: "bg-violet-600" },
            { label: "Comisiones s/ Facturas Pagadas", value: fmt(totalCommissions), icon: DollarSign, color: "bg-emerald-600", small: true },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
              <div className={`${s.color} rounded-lg p-2 shrink-0`}><s.icon className="h-4 w-4 text-white" /></div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight">{s.label}</p>
                <p className={`font-bold leading-tight mt-0.5 ${s.small ? "text-base" : "text-xl"} truncate`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" />
          </div>
        ) : referrers.length > 0 ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {referrers.map(r => {
              const refClients = getReferrerClients(r.id);
              const commission = getCommissionEarned(r.id, r.commission_percent);
              const refClientIds = new Set(refClients.map(c => c.id));
              const totalFacturadoPagado = paidInvoices.filter(inv => refClientIds.has(inv.client_id)).reduce((s, inv) => s + (inv.amount || 0), 0);
              const totalAgreed = refClients.reduce((s, c) => s + (c.agreed_value || 0), 0);
              return (
                <ReferrerCard key={r.id} r={r} refClients={refClients} commission={commission}
                  totalFacturadoPagado={totalFacturadoPagado} totalAgreed={totalAgreed} onEdit={handleEdit} />
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl text-center py-14">
            <Award className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Sin referidores registrados</p>
            <Button variant="outline" className="mt-4 text-sm" onClick={() => setShowForm(true)}>Registrar primer referidor</Button>
          </div>
        )}
      </div>

      <ReferrerForm open={showForm} onOpenChange={setShowForm} referrer={editReferrer}
        onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["referrers"] }); }} />
    </div>
  );
}