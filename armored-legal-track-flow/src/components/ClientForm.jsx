import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DEPARTAMENTOS, getCiudades } from "@/utils/colombiaGeo";
import { UserCheck, AlertCircle } from "lucide-react";
import { sanitizeFormData, sanitizeName } from "@/utils/textFormat";
import CondicionesEspeciales from "@/components/CondicionesEspeciales";
import { Lbl, Val } from "@/components/ClientFormGridCells";
import ServiceManagementModal from "@/components/ServiceManagementModal";
import { Settings } from "lucide-react";

const empty = {
  full_name: "", cc: "", phone: "", email: "",
  address: "", neighborhood: "", department: "", city: "", vereda: "",
  jurisdiction_dept: "", jurisdiction: "",
  service_type: "eliminacion_reportes", service_type_custom: "", status: "prospecto",
  referrer_id: "", referrer_name: "",
  agreed_value: "", pending_balance: "",
  datacredito_key: "", transunion_key: "", score_data: "", score_transunion: "",
  victim_conflict: "", indigenous: "", elderly: "",
  psychological_impact: "", single_mother: "",
  notes: "", contract_date: "",
  valor_expectativa_total: "", porcentaje_anticipo: 0.5, total_reportes_objetivo: "",
  anticipo_cuotas: 1, anticipo_dates: [],
  ejecutivo_juzgado: "", ejecutivo_cuantia: "", ejecutivo_acreedor: "", ejecutivo_deudor: "", ejecutivo_titulo: ""
};

function fillFromClient(c) {
  return {
    ...empty, ...c,
    agreed_value: c.agreed_value ?? "",
    pending_balance: c.pending_balance ?? "",
    score_data: c.score_data ?? "",
    score_transunion: c.score_transunion ?? "",
    victim_conflict: c.victim_conflict ?? "",
    indigenous: c.indigenous ?? "",
    elderly: c.elderly ?? "",
    psychological_impact: c.psychological_impact ?? "",
    single_mother: c.single_mother ?? "",
    jurisdiction_dept: c.jurisdiction_dept ?? "",
    jurisdiction: c.jurisdiction ?? "",
    address: c.address ?? "",
    neighborhood: c.neighborhood ?? "",
    department: c.department ?? "",
    city: c.city ?? "",
    vereda: c.vereda ?? "",
    transunion_key: c.transunion_key ?? "",
    valor_expectativa_total: c.valor_expectativa_total ?? "",
    porcentaje_anticipo: c.porcentaje_anticipo ?? 0.5,
    total_reportes_objetivo: c.total_reportes_objetivo ?? "",
    anticipo_cuotas: c.anticipo_cuotas ?? 1,
    anticipo_dates: c.anticipo_dates ?? []
  };
}

export default function ClientForm({ open, onOpenChange, client, onSuccess }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [existingClient, setExistingClient] = useState(null);
  const [ccSearching, setCcSearching] = useState(false);
  const [ccAutoFilled, setCcAutoFilled] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [customServices, setCustomServices] = useState(() => {
    const stored = localStorage.getItem("custom_services");
    return stored ? JSON.parse(stored) : ["Eliminación de Reportes", "Acción de Tutela", "Proceso SIC", "Gestión de Cartera", "Otro"];
  });
  const ccTimer = useRef(null);
  const fieldRefs = { cc: useRef(null), full_name: useRef(null), referrer_id: useRef(null), total_reportes_objetivo: useRef(null), anticipo_dates: useRef(null) };

  const { data: referrers = [] } = useQuery({ queryKey: ["referrers"], queryFn: () => base44.entities.Referrer.list() });
  const { data: processStates = [] } = useQuery({
    queryKey: ["process_states"],
    queryFn: () => base44.functions.invoke('getActiveProcessStates', {}).then((res) => res.data.states || [])
  });

  // Reset when dialog opens/closes or edit target changes
  useEffect(() => {
    if (client) {
      setForm(fillFromClient(client));
      setExistingClient(null);
      setCcAutoFilled(false);
    } else {
      setForm(empty);
      setExistingClient(null);
      setCcAutoFilled(false);
    }
    setErrors({});
  }, [client, open]);

  // Reload custom services when modal closes or services are updated
  useEffect(() => {
    if (!showServiceModal) {
      const stored = localStorage.getItem("custom_services");
      if (stored) {
        setCustomServices(JSON.parse(stored));
      }
    }
  }, [showServiceModal]);

  // Listen for service updates from ServiceManagementModal
  useEffect(() => {
    const handleServicesUpdated = () => {
      const stored = localStorage.getItem("custom_services");
      if (stored) {
        setCustomServices(JSON.parse(stored));
      }
    };

    window.addEventListener("customServicesUpdated", handleServicesUpdated);
    return () => window.removeEventListener("customServicesUpdated", handleServicesUpdated);
  }, []);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ── CC lookup (only for new records) ──────────────────────────────────────
  const clearAutoFilled = () => {
    setExistingClient(null);
    setCcAutoFilled(false);
    setForm((p) => ({
      ...p,
      full_name: "", phone: "", email: "",
      address: "", neighborhood: "", department: "", city: "", vereda: "",
      jurisdiction_dept: "", jurisdiction: ""
    }));
  };

  const handleCcBlur = async (val) => {
    if (client || !val.trim() || val.trim().length < 5) return;
    try {
      setCcSearching(true);
      const results = await base44.entities.Client.filter({ cc: val.trim() });
      if (results && results.length > 0) {
        const found = results[0];
        setExistingClient(found);
        setCcAutoFilled(true);
        // Auto-fill personal + domicile info
        setForm((p) => ({
          ...p,
          full_name: found.full_name ?? p.full_name,
          phone: found.phone ?? p.phone,
          email: found.email ?? p.email,
          address: found.address ?? p.address,
          neighborhood: found.neighborhood ?? p.neighborhood,
          department: found.department ?? p.department,
          city: found.city ?? p.city,
          vereda: found.vereda ?? p.vereda,
          jurisdiction_dept: found.jurisdiction_dept ?? p.jurisdiction_dept,
          jurisdiction: found.jurisdiction ?? p.jurisdiction
        }));
      } else {
        setExistingClient(null);
      }
    } catch {/* ignore */}
    setCcSearching(false);
  };

  const mutation = useMutation({
    mutationFn: async (d) => {
      const sanitized = sanitizeFormData(d, ["full_name", "address", "neighborhood", "vereda", "ejecutivo_acreedor", "ejecutivo_deudor", "ejecutivo_juzgado"]);
      const data = {
        ...sanitized,
        agreed_value: parseFloat(d.agreed_value) || 0,
        pending_balance: parseFloat(d.pending_balance) || 0,
        score_data: d.score_data !== "" && d.score_data !== null ? parseInt(d.score_data) : null,
        score_transunion: d.score_transunion !== "" && d.score_transunion !== null ? parseInt(d.score_transunion) : null,
        valor_expectativa_total: parseFloat(d.valor_expectativa_total) || 0,
        total_reportes_objetivo: parseInt(d.total_reportes_objetivo) || 0
      };
      const clientResult = client ?
      await base44.entities.Client.update(client.id, { ...data, is_new: data.status !== client.status ? false : client.is_new ?? false }) :
      await base44.entities.Client.create({ ...data, is_new: true });

      if (!client && d.valor_expectativa_total && d.total_reportes_objetivo) {
        const montoAnticipo = parseFloat(d.valor_expectativa_total) * (d.porcentaje_anticipo || 0.5);
        const montoCuota = montoAnticipo / d.anticipo_cuotas;

        let radicado_interno = null;
        try {
          const radRes = await base44.functions.invoke("generateRadicado", {});
          radicado_interno = radRes?.data?.radicado_interno || null;
        } catch {}

        const datos_especificos = {};
        if (d.service_type === "tutela" || d.service_type === "otro") datos_especificos.tipo_accion = d.service_type;
        if (d.ejecutivo_juzgado) datos_especificos.juzgado_ejecutivo = d.ejecutivo_juzgado;
        if (d.ejecutivo_cuantia) datos_especificos.cuantia = parseFloat(d.ejecutivo_cuantia);
        if (d.ejecutivo_acreedor) datos_especificos.acreedor = d.ejecutivo_acreedor;
        if (d.ejecutivo_deudor) datos_especificos.deudor = d.ejecutivo_deudor;
        if (d.ejecutivo_titulo) datos_especificos.titulo_ejecutivo = d.ejecutivo_titulo;

        const processTypeMap = { eliminacion_reportes: "eliminacion_reportes", tutela: "tutela", sic: "sic", cartera: "ejecutivo", otro: "otro" };

        const process = await base44.entities.Process.create({
          title: `Proceso ${d.full_name}`,
          type: processTypeMap[d.service_type] || "otro",
          status: "activo",
          habilitado_juridico: false,
          contrato_autenticado: false,
          radicado_interno,
          client_id: clientResult.id,
          valor_expectativa_total: parseFloat(d.valor_expectativa_total),
          porcentaje_anticipo: d.porcentaje_anticipo,
          total_reportes_objetivo: parseInt(d.total_reportes_objetivo),
          anticipo_cuotas: d.anticipo_cuotas,
          anticipo_dates: d.anticipo_dates,
          datos_especificos
        });

        for (let i = 0; i < d.anticipo_cuotas; i++) {
          const conceptText = `Anticipo ${i + 1}/${d.anticipo_cuotas} - ${d.service_type === "eliminacion_reportes" ? "Gestión de Eliminación de Reportes" : "Servicio Legal"}`;
          await base44.entities.Invoice.create({
            client_id: clientResult.id,
            client_name: d.full_name,
            process_id: process.id,
            concept: conceptText,
            amount: montoCuota,
            status: "pendiente",
            issue_date: new Date().toISOString().split("T")[0],
            due_date: d.anticipo_dates[i] || new Date().toISOString().split("T")[0],
            payment_terms: "manual",
            service_type: d.service_type,
            items: [{ id: crypto.randomUUID(), type: "honorarios_fijo", concept: conceptText, amount: String(montoCuota) }]
          });
        }
      }
      return clientResult;
    },
    onSuccess: () => {
      toast.success(client ? "Cliente actualizado" : "Cliente registrado con facturas de anticipo");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onSuccess?.();
    }
  });

  const handleReferrerChange = (rid) => {
    const r = referrers.find((x) => x.id === rid);
    set("referrer_id", rid || "");
    set("referrer_name", r ? r.full_name : "");
  };

  const scrollToRef = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      ref.current.focus?.();
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!form.cc.trim()) newErrors.cc = true;
    if (!form.full_name.trim()) newErrors.full_name = true;
    if (!form.phone.trim()) newErrors.phone = true;
    if (!form.email.trim()) newErrors.email = true;
    if (!form.referrer_id) newErrors.referrer_id = true;
    if (!client && form.valor_expectativa_total && (!form.total_reportes_objetivo || form.total_reportes_objetivo < 1))
    newErrors.total_reportes_objetivo = true;
    if (form.anticipo_cuotas > 1 && form.anticipo_dates.some((d) => !d))
    newErrors.anticipo_dates = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Scroll to first error field
      const order = ["cc", "full_name", "phone", "email", "referrer_id", "total_reportes_objetivo", "anticipo_dates"];
      const first = order.find((k) => newErrors[k]);
      if (first) {
        toast.error(
          first === "cc" || first === "full_name" ? "Cédula y nombre son requeridos" :
          first === "phone" ? "El celular es requerido" :
          first === "email" ? "El correo electrónico es requerido" :
          first === "referrer_id" ? "El referidor / canal de origen es requerido" :
          first === "total_reportes_objetivo" ? "Completa la cantidad de reportes a gestionar" :
          "Completa todas las fechas de vencimiento del anticipo"
        );
        scrollToRef(fieldRefs[first]);
      }
      return;
    }

    setErrors({});
    mutation.mutate(form);
  };

  const ciudades = getCiudades(form.department);
  const inp = "w-full bg-transparent border-none focus:ring-0 focus:outline-none px-2 py-1 text-xs text-gray-900 placeholder-gray-400";

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-700 border-b border-gray-500">
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            {client ? "Editar Cliente" : "Nuevo Cliente / Caso"}
          </span>
        </div>

        <form onSubmit={submit} className="space-y-3 bg-white px-4 py-3 my-1">

          {/* ── BLOQUE 1: Datos Personales ── */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">I. Identificación y Contacto</span>
            </div>
            <div className="border-l border-t border-gray-400 grid grid-cols-4">
              <Lbl error={errors.cc}>CÉDULA *</Lbl>
              <Val>
                <div className="relative w-full h-full flex items-center">
                  <input ref={fieldRefs.cc} className={inp + " font-mono"} value={form.cc}
                  onChange={(e) => {set("cc", e.target.value);setErrors((p) => ({ ...p, cc: false }));}}
                  onBlur={(e) => handleCcBlur(e.target.value)}
                  placeholder="No. cédula" autoComplete="off" spellCheck="false" />
                  {ccSearching && <span className="absolute right-1 text-[9px] text-gray-400 animate-pulse">...</span>}
                </div>
              </Val>
              <Lbl error={errors.full_name}>NOMBRE COMPLETO *</Lbl>
              <Val>
                <input ref={fieldRefs.full_name} className={inp} value={form.full_name}
                onChange={(e) => {set("full_name", e.target.value);setErrors((p) => ({ ...p, full_name: false }));}}
                placeholder="Nombre completo" autoComplete="off" spellCheck="false" />
              </Val>

              <Lbl error={errors.phone}>CELULAR *</Lbl>
              <Val>
                <input className={inp + " font-mono"} value={form.phone}
                onChange={(e) => {set("phone", e.target.value);setErrors((p) => ({ ...p, phone: false }));}} placeholder="3001234567" autoComplete="off" />
              </Val>
              <Lbl error={errors.email}>CORREO ELECTRÓNICO *</Lbl>
              <Val>
                <input className={inp} type="email" value={form.email}
                onChange={(e) => {set("email", e.target.value);setErrors((p) => ({ ...p, email: false }));}} placeholder="correo@ejemplo.com" autoComplete="off" />
              </Val>
            </div>
          </div>

          {/* Banner cliente encontrado */}
          {existingClient &&
          <div className="flex items-center gap-2 bg-sky-50 border border-sky-300 px-3 py-2">
              <UserCheck className="h-3.5 w-3.5 text-sky-600 shrink-0" />
              <span className="text-[11px] font-semibold text-sky-800">Cliente encontrado: {existingClient.full_name} — datos auto-completados.</span>
            </div>
          }

          {/* ── BLOQUE 2: Domicilio ── */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">II. Domicilio</span>
            </div>
            <div className="border-l border-t border-gray-400 grid grid-cols-4">
              <Lbl>DEPARTAMENTO</Lbl>
              <Val>
                <select className={inp} value={form.department || ""}
                onChange={(e) => {set("department", e.target.value);set("city", "");}} autoComplete="off">
                  <option value="">— Seleccionar —</option>
                  {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Val>
              <Lbl>CIUDAD / MUNICIPIO</Lbl>
              <Val>
                <select className={inp} value={form.city || ""} disabled={!form.department}
                onChange={(e) => set("city", e.target.value)} autoComplete="off">
                  <option value="">— Seleccionar —</option>
                  {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Val>

              <Lbl>DIRECCIÓN</Lbl>
              <Val>
                <input className={inp} value={form.address}
                onChange={(e) => set("address", e.target.value)} placeholder="Calle 15 #22-34" autoComplete="off" />
              </Val>
              <Lbl>BARRIO</Lbl>
              <Val>
                <input className={inp} value={form.neighborhood}
                onChange={(e) => set("neighborhood", e.target.value)} placeholder="Nombre del barrio" autoComplete="off" />
              </Val>

              <Lbl>VEREDA</Lbl>
              <Val span={3}>
                <input className={inp} value={form.vereda}
                onChange={(e) => set("vereda", e.target.value)} placeholder="Zona rural — opcional" autoComplete="off" />
              </Val>
            </div>
          </div>

          {/* ── BLOQUE 3: Servicio, Estado y Canal ── */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">III. Servicio y Estado</span>
            </div>
            <div className="border-l border-t border-gray-400 grid grid-cols-4">
              <Lbl>TIPO DE SERVICIO</Lbl>
              <Val span={3} className="flex items-center gap-0">
                <select className={inp} value={form.service_type} onChange={(e) => set("service_type", e.target.value)} autoComplete="off">
                  <option value="">— Seleccionar servicio —</option>
                  {customServices.map((svc) => (
                    <option key={svc} value={svc.toLowerCase().replace(/\s+/g, "_")}>{svc}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowServiceModal(true)}
                  className="flex items-center justify-center w-8 h-8 border-l border-gray-300 bg-gray-100 hover:bg-gray-200 transition-colors"
                  title="Gestionar servicios"
                >
                  <Settings className="h-4 w-4 text-gray-600" />
                </button>
              </Val>

              <Lbl error={errors.referrer_id}>CANAL / REFERIDOR *</Lbl>
              <Val span={3}>
                <select
                  ref={fieldRefs.referrer_id}
                  className={inp}
                  value={form.referrer_id || ""}
                  onChange={(e) => {handleReferrerChange(e.target.value);setErrors((p) => ({ ...p, referrer_id: false }));}}
                  autoComplete="off">
                  
                  <option value="">— Seleccionar referidor —</option>
                  {referrers.map((r) => <option key={r.id} value={r.id}>{sanitizeName(r.full_name)}</option>)}
                </select>
              </Val>
            </div>
          </div>

          {/* ── BLOQUE 4: Condiciones Especiales ── */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">IV. Condiciones Especiales</span>
            </div>
            <div className="border-l border-t border-gray-400 grid grid-cols-4">
              <Lbl>CONDICIONES</Lbl>
              <Val span={3} className="py-1 px-2">
                <CondicionesEspeciales mode="edit" values={form} onChange={(field, val) => set(field, val)} />
              </Val>
            </div>
          </div>

          {/* ── BLOQUE 5: Proceso Ejecutivo (condicional) ── */}
          {(form.service_type === "cartera" || form.service_type === "otro") &&
          <div>
              <div className="bg-amber-700 text-white px-2 py-1 border border-gray-400">
                <span className="text-[10px] font-bold uppercase tracking-widest">V. Proceso Ejecutivo / Cartera</span>
              </div>
              <div className="border-l border-t border-gray-400 grid grid-cols-4">
                <Lbl>JUZGADO</Lbl>
                <Val span={3}>
                  <input className={inp} value={form.ejecutivo_juzgado}
                onChange={(e) => set("ejecutivo_juzgado", e.target.value)} placeholder="Juzgado Civil del Circuito de..." autoComplete="off" />
                </Val>
                <Lbl>ACREEDOR</Lbl>
                <Val>
                  <input className={inp} value={form.ejecutivo_acreedor}
                onChange={(e) => set("ejecutivo_acreedor", e.target.value)} placeholder="Nombre del acreedor" autoComplete="off" />
                </Val>
                <Lbl>DEUDOR</Lbl>
                <Val>
                  <input className={inp} value={form.ejecutivo_deudor}
                onChange={(e) => set("ejecutivo_deudor", e.target.value)} placeholder="Nombre del deudor" autoComplete="off" />
                </Val>
                <Lbl>CUANTÍA (COP)</Lbl>
                <Val>
                  <input className={inp + " font-mono"} type="number" value={form.ejecutivo_cuantia}
                onChange={(e) => set("ejecutivo_cuantia", e.target.value)} placeholder="0" autoComplete="off" />
                </Val>
                <Lbl>TÍTULO EJECUTIVO</Lbl>
                <Val>
                  <input className={inp} value={form.ejecutivo_titulo}
                onChange={(e) => set("ejecutivo_titulo", e.target.value)} placeholder="Pagaré, letra, sentencia..." autoComplete="off" />
                </Val>
              </div>
            </div>
          }

          {/* ── BLOQUE 6: Observaciones ── */}
          <div>
            <div className="bg-gray-600 text-white px-2 py-1 border border-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-widest">VI. Observaciones</span>
            </div>
            <div className="border-l border-b border-r border-gray-400">
            <textarea
                className={inp + " resize-none w-full h-full"}
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Observaciones generales del caso..."
                autoComplete="off" />
              
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-gray-200">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={mutation.isPending} className="px-6">
              {mutation.isPending ? "Guardando..." : client ? "Actualizar Cliente" : "Registrar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>

      <ServiceManagementModal open={showServiceModal} onOpenChange={setShowServiceModal} />
    </Dialog>);

}