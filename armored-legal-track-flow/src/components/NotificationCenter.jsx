import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const TIPO_ICONS = {
  mencion:    "💬",
  asignacion: "📋",
  vencimiento:"⏰",
  comentario: "🗒️",
  otro:       "🔔",
};

const fmtTime = (d) => {
  try { return format(parseISO(d), "d MMM, HH:mm", { locale: es }); } catch { return ""; }
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [userId, setUserId] = useState(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Get current user
  useEffect(() => {
    base44.auth.me().then(u => { if (u) setUserId(u.id); }).catch(() => {});
  }, []);

  // Subscribe to real-time changes on Notificacion entity
  useEffect(() => {
    if (!userId) return;
    const unsub = base44.entities.Notificacion.subscribe((event) => {
      if (event.data?.usuario_destino_id === userId) {
        qc.invalidateQueries({ queryKey: ["notificaciones", userId] });
      }
    });
    return unsub;
  }, [userId, qc]);

  // Fetch notifications for current user
  const { data: notificaciones = [] } = useQuery({
    queryKey: ["notificaciones", userId],
    queryFn: () => base44.entities.Notificacion.filter(
      { usuario_destino_id: userId },
      "-created_date",
      50
    ),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  const noLeidas = notificaciones.filter(n => !n.leido);
  const visibles = soloNoLeidas ? noLeidas : notificaciones;

  const markReadMut = useMutation({
    mutationFn: (id) => base44.entities.Notificacion.update(id, { leido: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones", userId] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: async () => {
      for (const n of noLeidas) {
        await base44.entities.Notificacion.update(n.id, { leido: true });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones", userId] }),
  });

  const handleClick = async (n) => {
    if (!n.leido) markReadMut.mutate(n.id);
    setOpen(false);
    if (n.url) {
      const authed = await base44.auth.isAuthenticated();
      if (authed) navigate(n.url);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-secondary transition-colors"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {noLeidas.length > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {noLeidas.length > 9 ? "9+" : noLeidas.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {noLeidas.length > 0 && (
                <button
                  onClick={() => markAllReadMut.mutate()}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  title="Marcar todas como leídas"
                >
                  <CheckCheck className="h-3 w-3" /> Todas leídas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <button
              onClick={() => setSoloNoLeidas(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${soloNoLeidas ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${soloNoLeidas ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-xs text-muted-foreground">Solo no leídas</span>
            {noLeidas.length > 0 && (
              <span className="ml-auto text-[10px] font-bold text-red-500">{noLeidas.length} nuevas</span>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80">
            {visibles.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                {soloNoLeidas ? "Sin notificaciones no leídas" : "Sin notificaciones"}
              </div>
            ) : (
              visibles.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`group w-full text-left px-4 py-3 border-b border-border last:border-0 transition-all duration-150 flex items-start gap-3
                    ${!n.leido ? "bg-blue-50/50 hover:bg-blue-100/60" : "hover:bg-muted/50"}
                    ${n.url ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span className="text-base shrink-0 mt-0.5">{TIPO_ICONS[n.tipo] || "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    {/* Expediente deep-link header */}
                    {n.process_id && (
                      <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wide mb-0.5 group-hover:text-primary transition-colors flex items-center gap-1">
                        📁 Expediente
                        <span className="font-mono text-[9px] text-muted-foreground normal-case tracking-normal">#{n.process_id.slice(-6)}</span>
                        <span className="ml-auto text-[9px] text-muted-foreground group-hover:text-primary transition-colors">Ver →</span>
                      </p>
                    )}
                    <p className="text-xs font-medium leading-snug line-clamp-2">{n.mensaje}</p>
                    {n.usuario_origen_nombre && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">por {n.usuario_origen_nombre}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">{fmtTime(n.created_date)}</p>
                  </div>
                  {!n.leido && <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}