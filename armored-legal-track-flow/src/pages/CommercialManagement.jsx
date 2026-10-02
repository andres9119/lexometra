import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Plus, Search, Users, Clock, CheckCircle2, UserX, FileText, AlertCircle, Pencil } from "lucide-react";
import { sanitizeName } from "@/utils/textFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ClientForm from "@/components/ClientForm";
import CreditAgreementForm from "@/components/CreditAgreementForm";

const fmt = (n) => n ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n) : "$0";

const STATUS_CONFIG = {
  all: { label: "Todos", color: "bg-slate-600", light: "bg-slate-100 text-slate-700", icon: Users },
  prospecto: { label: "Prospecto", color: "bg-slate-500", light: "bg-slate-100 text-slate-600", icon: Users },
  contactado: { label: "Contactado", color: "bg-blue-600", light: "bg-blue-100 text-blue-700", icon: Clock },
  contrato_firmado: { label: "Contrato Firmado", color: "bg-violet-600", light: "bg-violet-100 text-violet-700", icon: FileText },
  peticion_radicada: { label: "Petición Radicada", color: "bg-amber-600", light: "bg-amber-100 text-amber-700", icon: AlertCircle },
  en_tramite: { label: "En Trámite", color: "bg-orange-600", light: "bg-orange-100 text-orange-700", icon: Clock },
  finalizado: { label: "Finalizado", color: "bg-emerald-600", light: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  perdido: { label: "Perdido", color: "bg-red-600", light: "bg-red-100 text-red-600", icon: UserX }
};

const SERVICE_CONFIG = {
  eliminacion_reportes: { label: "Elim. Reportes", color: "bg-rose-100 text-rose-700" },
  tutela: { label: "Tutela", color: "bg-violet-100 text-violet-700" },
  sic: { label: "SIC", color: "bg-blue-100 text-blue-700" },
  cartera: { label: "Cartera", color: "bg-emerald-100 text-emerald-700" },
  otro: { label: "Otro", color: "bg-slate-100 text-slate-600" }
};

export default function CommercialManagement() {
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusTab, setStatusTab] = useState(() => sessionStorage.getItem("cm_statusTab") || "new");

  const handleSetStatusTab = (tab) => {
    sessionStorage.setItem("cm_statusTab", tab);
    setStatusTab(tab);
  };
  const [now, setNow] = useState(Date.now());
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Abrir formulario si el toolbar "Nuevo" navegó con ?new=1
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("new") === "1") {
      setShowForm(true);
      navigate("/commercial", { replace: true });
    }
  }, [location.search]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date")
  });

  const { data: processStates = [] } = useQuery({
    queryKey: ["process_states"],
    queryFn: () => base44.functions.invoke('getActiveProcessStates', {}).then((res) => res.data.states || [])
  });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service_types"],
    queryFn: () => base44.entities.ServiceType.list()
  });

  // Si el tab activo ya no existe en los estados, resetear a "new"
  const validTabKeys = ["new", "all", ...processStates.map((s) => s.name)];
  if (processStates.length > 0 && !validTabKeys.includes(statusTab)) {
    handleSetStatusTab("new");
  }

  // Tabs dinámicos: "Nuevo" + "Todos" + estados desde processStates ordenados
  const dynamicTabs = [
  { key: "all", label: "Todos", color: "#475569", icon: Users },
  { key: "new", label: "Nuevo", color: "#16a34a", icon: Users },
  ...processStates.map((s) => ({ key: s.name, label: s.display_name, color: s.color, icon: Users }))];


  const counts = dynamicTabs.reduce((acc, t) => {
    if (t.key === "new") acc[t.key] = clients.filter((c) => c.is_new).length;else
    if (t.key === "all") acc[t.key] = clients.length;else
    acc[t.key] = clients.filter((c) => c.status === t.key).length;
    return acc;
  }, {});

  const filtered = clients.filter((c) => {
    if (statusTab === "new" && !c.is_new) return false;
    if (statusTab !== "all" && statusTab !== "new" && c.status !== statusTab) return false;
    if (serviceFilter !== "all") {
      const matchesLegacy = c.service_type === serviceFilter;
      const matchesRelational = c.service_type_id && serviceTypes.some((st) => st.id === c.service_type_id && st.name === serviceFilter);
      if (!matchesLegacy && !matchesRelational) return false;
    }
    if (search && !c.full_name?.toLowerCase().includes(search.toLowerCase()) && !c.cc?.includes(search) && !c.phone?.includes(search)) return false;
    return true;
  });

  const totalAgreed = clients.reduce((s, c) => s + (c.agreed_value || 0), 0);
  const totalPending = clients.reduce((s, c) => s + (c.pending_balance || 0), 0);
  const totalCollected = totalAgreed - totalPending;
  const active = clients.filter((c) => !["finalizado", "perdido"].includes(c.status)).length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Module header */}
      







      

      {/* Status pipeline tabs — dinámicos desde processStates */}
       <div className="flex items-end gap-0 bg-white shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] border-b border-gray-300">
         {dynamicTabs.map((t, idx) => {
           const isActive = statusTab === t.key;
           return (
             <button
               key={t.key}
               onClick={() => handleSetStatusTab(t.key)}
               className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition-all whitespace-nowrap border-l border-r border-gray-300 ${
               isActive ? "bg-white text-slate-700 border-t-4 border-t-slate-700" : "bg-gray-100 text-gray-500 hover:bg-gray-150"}`
               }>

                <span>{t.label}</span>
                <span className={`px-1.5 py-0.5 rounded-none text-[9px] font-bold ${isActive ? "bg-slate-100 text-slate-700" : "bg-gray-200 text-gray-500"}`}>
                  {counts[t.key] ?? 0}
                </span>
              </button>);

        })}
       </div>

      <div className="flex-1 overflow-auto flex flex-col bg-white">
        {/* Toolbar consolidado */}
        <div className="bg-white border-b border-gray-400 shrink-0">






        <div className="flex items-center gap-0 px-0 py-2 pl-0 bg-gray-50 border-b border-gray-300">
          {/* Total Clientes KPI */}
          <div className="flex items-center gap-1.5 bg-white px-3 py-1 border-r border-gray-300 h-6">
            <Users className="h-3 w-3 text-gray-700" />
            <span className="text-[10px] font-bold uppercase text-gray-700">Total:</span>
            <span className="text-xs font-bold text-gray-900">{clients.length}</span>
          </div>

          {/* Buscador */}
          <div className="relative flex-1 min-w-[200px] border-r border-gray-300">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <Input placeholder="Buscar nombre, cédula, celular..." className="pl-7 h-6 text-xs border-0 rounded-none focus:ring-0 focus:outline-none px-1 bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Filtro de servicio - Dropdown */}
          <div className="flex items-center border-l border-gray-300 bg-white px-2 py-1 h-6">
            <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="text-xs text-gray-700 bg-white border-0 focus:ring-0 focus:outline-none appearance-none cursor-pointer font-medium">
                
              <option value="all">Todos los servicios</option>
              {Object.entries(SERVICE_CONFIG).map(([k, v]) =>
                <option key={k} value={k}>{v.label}</option>
                )}
              {serviceTypes.map((st) =>
                <option key={st.id} value={st.name}>{st.name}</option>
                )}
            </select>
          </div>

          {/* Contador registros */}
          <span className="text-[10px] font-semibold text-gray-600 ml-auto mr-3">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {isLoading ?
          <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" /></div> :
          filtered.length > 0 ?
          <div className="overflow-x-auto flex-1">
              <table className="w-full border-collapse text-xs">
                <colgroup>
                  <col className="w-24" />
                  <col />
                  <col className="w-32" />
                  <col className="w-32" />
                  <col className="w-40" />
                  <col className="w-40" />
                  <col className="w-28" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-700 border-b border-gray-200">
                    <th className="border-r border-gray-200 px-2 py-1.5 text-left uppercase text-[11px] font-bold tracking-widest text-white">Cédula</th>
                    <th className="border-r border-gray-200 px-2 py-1.5 text-left uppercase text-[11px] font-bold tracking-widest text-white">Cliente</th>
                    <th className="border-r border-gray-200 px-2 py-1.5 text-center uppercase text-[11px] font-bold tracking-widest text-white">Servicio</th>
                    <th className="border-r border-gray-200 px-2 py-1.5 text-center uppercase text-[11px] font-bold tracking-widest text-white">Estado</th>
                    <th className="border-r border-gray-200 px-2 py-1.5 text-left uppercase text-[11px] font-bold tracking-widest text-white">Canal</th>
                    <th className="border-r border-gray-200 px-2 py-1.5 text-center uppercase text-[11px] font-bold tracking-widest text-white">Fecha Ingreso</th>
                    <th className="px-2 py-1.5 text-center uppercase text-[11px] font-bold tracking-widest text-white">Tiempo</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, idx) => {
                  const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.prospecto;
                  const svc = c.service_type_id ?
                  serviceTypes.find((st) => st.id === c.service_type_id) :
                  null;
                  const sv = svc ? { label: svc.name, color: "bg-blue-100 text-blue-700" } : SERVICE_CONFIG[c.service_type];
                  const dynState = processStates.find((s) => s.name === c.status);
                  return (
                    <tr key={c.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? "bg-gray-50" : "bg-white"} hover:bg-blue-50`}>
                      <td className="border-r border-gray-200 px-2 py-1">
                        <Link to={`/client/${c.id}`} className="font-mono text-xs text-blue-600 font-semibold hover:underline">
                          {c.cc}
                        </Link>
                      </td>
                      <td className="border-r border-gray-200 px-2 py-1 text-gray-900 font-medium capitalize">{sanitizeName(c.full_name)}</td>
                      <td className="border-r border-gray-200 px-2 py-1 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-none text-[9px] font-semibold ${sv?.color || "bg-gray-100 text-gray-700"}`}>{sv?.label}</span>
                      </td>
                      <td className="border-r border-gray-200 px-2 py-1 text-center">
                        {c.is_new ?
                        <span className="inline-block px-1.5 py-0.5 rounded-none text-[9px] font-bold text-white" style={{ backgroundColor: "#16a34a" }}>NUEVO</span> :
                        dynState ?
                        <span className="inline-block px-1.5 py-0.5 rounded-none text-[9px] font-bold text-white" style={{ backgroundColor: dynState.color }}>
                            {dynState.display_name.toUpperCase()}
                          </span> :

                        <span className="inline-block px-1.5 py-0.5 rounded-none text-[9px] font-bold" style={{ backgroundColor: st.light.split(" ")[0], color: st.light.split(" ")[1] || "gray-700" }}>
                            {st.label.toUpperCase()}
                          </span>
                        }
                      </td>
                      <td className="border-r border-gray-200 px-2 py-1 text-gray-500 truncate">{c.referrer_name || "—"}</td>
                      <td className="border-r border-gray-200 px-2 py-1 text-center">
                        {c.created_date ? (() => {
                          const d = new Date(c.created_date);
                          return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
                        })() : "—"}
                      </td>
                      <td className="border-r border-gray-200 px-2 py-1 text-center font-semibold">
                        {c.created_date ? (() => {
                          const diffMs = now - new Date(c.created_date).getTime();
                          const diffMin = Math.floor(diffMs / 60000);
                          const diffH = Math.floor(diffMin / 60);
                          const diffD = Math.floor(diffH / 24);
                          let label, color;
                          if (diffH >= 72) {label = `${diffD}d`;color = "text-red-600";} else
                          if (diffH >= 24) {label = `${diffH}h`;color = "text-red-500";} else
                          if (diffH >= 12) {label = `${diffH}h`;color = "text-orange-500";} else
                          if (diffMin >= 60) {label = `${diffH}h`;color = "text-amber-500";} else
                          if (diffMin >= 1) {label = `${diffMin}m`;color = "text-green-600";} else
                          {label = "Ahora";color = "text-green-500";}
                          return <span className={`text-xs font-bold ${color}`}>{label}</span>;
                        })() : "—"}
                      </td>
                    </tr>);
                })}
                </tbody>
              </table>
            </div> :

          <div className="flex items-center justify-center py-14 flex-1">
            <div className="text-center">
              <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Sin registros para este filtro</p>
              {statusTab === "all" && !search && <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>Registrar primer cliente</Button>}
            </div>
          </div>
          }
        </div>
      </div>

      <ClientForm open={showForm} onOpenChange={setShowForm}
      onSuccess={() => {setShowForm(false);qc.invalidateQueries({ queryKey: ["clients"] });}} />

      <ClientForm
        open={!!editingClient}
        onOpenChange={(v) => {if (!v) setEditingClient(null);}}
        client={editingClient}
        onSuccess={() => {setEditingClient(null);qc.invalidateQueries({ queryKey: ["clients"] });}} />
      
    </div>);

}