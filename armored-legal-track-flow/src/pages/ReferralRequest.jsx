import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Loader2, UserCircle } from "lucide-react";

const SERVICE_LABELS = {
  eliminacion_reportes: "Eliminación de Reportes Negativos",
  tutela: "Tutela",
  sic: "Queja ante SIC",
  cartera: "Gestión de Cartera",
  otro: "Otro",
};

export default function ReferralRequest() {
  const params = new URLSearchParams(window.location.search);
  const referrerId = params.get("ref");

  const [form, setForm] = useState({
    full_name: "", cc: "", phone: "", email: "",
    city: "", service_type: "eliminacion_reportes", notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const { data: referrer, isLoading: loadingRef } = useQuery({
    queryKey: ["referrer_public", referrerId],
    queryFn: () => base44.entities.Referrer.filter({ id: referrerId }),
    enabled: !!referrerId,
    select: (data) => data?.[0],
  });

  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Client.create({
        full_name: form.full_name.trim(),
        cc: form.cc.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        city: form.city.trim(),
        service_type: form.service_type,
        status: "prospecto",
        referrer_id: referrer?.id || null,
        referrer_name: referrer?.full_name || null,
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: () => setError("Ocurrió un error al enviar tu solicitud. Por favor intenta de nuevo."),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim() || !form.cc.trim() || !form.phone.trim()) {
      setError("Por favor completa los campos obligatorios: nombre, cédula y teléfono.");
      return;
    }
    mutation.mutate();
  };

  if (!referrerId || (!loadingRef && !referrer)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Enlace no válido</h2>
          <p className="text-slate-500 text-sm">Este enlace de referido no existe o ha expirado.</p>
        </div>
      </div>
    );
  }

  if (loadingRef) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Solicitud enviada!</h2>
          <p className="text-slate-600 text-sm mb-1">
            Recibimos tu información correctamente. Uno de nuestros asesores se comunicará contigo pronto.
          </p>
          <p className="text-slate-400 text-xs mt-4">Referido por: <span className="font-semibold text-slate-600">{referrer?.full_name}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-5">
          <h1 className="text-xl font-bold text-white">Solicita tu asesoría</h1>
          <p className="text-amber-100 text-sm mt-0.5">Completa tus datos para que un asesor te contacte</p>
        </div>

        {/* Referrer badge */}
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2.5 flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-700">
            Referido por: <span className="font-semibold">{referrer?.full_name}</span>
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nombre completo *</Label>
              <Input value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Tu nombre completo" />
            </div>
            <div>
              <Label>Cédula *</Label>
              <Input value={form.cc} onChange={e => set("cc", e.target.value)} placeholder="1234567890" inputMode="numeric" />
            </div>
            <div>
              <Label>Teléfono / Celular *</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="3001234567" inputMode="tel" />
            </div>
            <div>
              <Label>Correo electrónico</Label>
              <Input value={form.email} onChange={e => set("email", e.target.value)} placeholder="tu@correo.com" type="email" />
            </div>
            <div>
              <Label>Ciudad</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Bogotá" />
            </div>
          </div>

          <div>
            <Label>Servicio de interés *</Label>
            <Select value={form.service_type} onValueChange={v => set("service_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SERVICE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>¿Cuéntanos tu situación? <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Describe brevemente tu caso..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={mutation.isPending} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold">
            {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enviando...</> : "Enviar solicitud"}
          </Button>

          <p className="text-[10px] text-center text-muted-foreground">
            Tus datos son tratados con total confidencialidad conforme a la Ley 1581 de 2012.
          </p>
        </form>
      </div>
    </div>
  );
}