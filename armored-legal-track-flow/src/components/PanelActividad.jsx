import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Send, Loader2, Edit2, Check, X } from "lucide-react";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { es } from "date-fns/locale";

const fmtTime = (d) => {
  try { return format(parseISO(d), "d MMM yyyy, HH:mm", { locale: es }); } catch { return ""; }
};

// ── Mention-aware textarea ──────────────────────────────────────────────────
function MentionTextarea({ value, onChange, onKeyDown, placeholder, rows, users }) {
  const [mentionQ, setMentionQ] = useState(null); // string being typed after @
  const [mentionStart, setMentionStart] = useState(-1);
  const ref = useRef(null);

  const filtered = mentionQ !== null
    ? users.filter(u => u.full_name?.toLowerCase().includes(mentionQ.toLowerCase())).slice(0, 6)
    : [];

  const handleChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);

    // Detect @ mention
    const before = val.slice(0, pos);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQ(match[1]);
      setMentionStart(pos - match[1].length - 1);
    } else {
      setMentionQ(null);
    }
  };

  const insertMention = (user) => {
    const before = value.slice(0, mentionStart);
    const after = value.slice(ref.current.selectionStart);
    const newVal = `${before}@${user.full_name} ${after}`;
    onChange(newVal, user); // pass user for notification
    setMentionQ(null);
    setTimeout(() => {
      ref.current?.focus();
      const pos = before.length + user.full_name.length + 2;
      ref.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-sm resize-none rounded-md border border-input bg-transparent px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {filtered.length > 0 && mentionQ !== null && (
        <div className="absolute z-10 left-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 flex items-center gap-2"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                {u.full_name?.slice(0, 2).toUpperCase()}
              </span>
              {u.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function PanelActividad({ processId, processTitulo }) {
  const [text, setText] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [now, setNow] = useState(Date.now());
  const qc = useQueryClient();

  // Tick every 5s to re-evaluate 60s edit window
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users_all"],
    queryFn: async () => {
      const res = await base44.functions.invoke("listUsers", {});
      return res.data?.users || [];
    },
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["process_activity", processId],
    queryFn: async () => {
      const result = await base44.functions.invoke("getProcessTimeline", { process_id: processId });
      return result.data?.events || [];
    },
    enabled: !!processId,
    refetchInterval: 30000,
  });

  const createNotifications = useCallback(async (mentioned, commentText, authorName) => {
    const expedienteLabel = processTitulo || processId;
    for (const u of mentioned) {
      await base44.entities.Notificacion.create({
        usuario_destino_id: u.id,
        usuario_destino_nombre: u.full_name,
        usuario_origen_nombre: authorName,
        tipo: "mencion",
        mensaje: `${authorName} te mencionó en "${expedienteLabel}": "${commentText.slice(0, 80)}${commentText.length > 80 ? '…' : ''}"`,
        url: `/process/${processId}`,
        process_id: processId,
        leido: false,
        email_enviado: false,
      });
    }
  }, [processId, processTitulo]);

  const addMut = useMutation({
    mutationFn: async ({ comment, mentioned }) => {
      const user = currentUser;
      const record = await base44.entities.ClientActivity.create({
        client_id: processId,
        comment,
        activity_type: "comentario",
        author: user?.full_name || "Usuario",
      });
      if (mentioned.length > 0) {
        await createNotifications(mentioned, comment, user?.full_name || "Usuario");
      }
      return record;
    },
    onSuccess: () => {
      setText("");
      setMentionedUsers([]);
      qc.invalidateQueries({ queryKey: ["process_activity", processId] });
      toast.success("Comentario agregado");
    },
  });

  const editMut = useMutation({
    mutationFn: async ({ id, comment }) => {
      const act = activities.find(a => a.id === id);
      const secsElapsed = differenceInSeconds(new Date(), new Date(act?.created_date || 0));
      if (secsElapsed > 60) throw new Error("Han pasado más de 60 segundos. Ya no puedes editar este comentario.");
      return base44.entities.ClientActivity.update(id, { comment });
    },
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["process_activity", processId] });
      toast.success("Comentario actualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    addMut.mutate({ comment: text.trim(), mentioned: mentionedUsers });
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSubmit(e);
  };

  const handleTextChange = (val, mentionedUser) => {
    setText(val);
    if (mentionedUser) {
      setMentionedUsers(prev => prev.find(u => u.id === mentionedUser.id) ? prev : [...prev, mentionedUser]);
    }
  };

  const sorted = [...activities].sort((a, b) =>
    new Date(b.created_date || b.date) - new Date(a.created_date || a.date)
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Input */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 pb-2 border-b border-border">
        <MentionTextarea
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKey}
          placeholder="Agrega un comentario... usa @ para mencionar (Ctrl+Enter enviar)"
          rows={3}
          users={users}
        />
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Usa @ para mencionar a un colega</p>
          <Button type="submit" size="sm" className="gap-1.5" disabled={!text.trim() || addMut.isPending}>
            {addMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar
          </Button>
        </div>
      </form>

      {/* Feed */}
      <div className="space-y-3 pr-0.5">
        {isLoading && <p className="text-xs text-center text-muted-foreground py-4">Cargando actividad...</p>}
        {!isLoading && sorted.length === 0 && (
          <p className="text-xs text-center text-muted-foreground py-8">Sin actividad registrada</p>
        )}
        {sorted.map((event, i) => {
          const isManual = event.type === "comentario";
          const isOwn = isManual && currentUser && event.author === currentUser.full_name;
          const secsElapsed = isOwn
            ? differenceInSeconds(new Date(now), new Date(event.created_date || 0))
            : 999;
          const canEdit = isOwn && secsElapsed <= 60;
          const isEditing = editingId === event.id;

          return (
            <div key={event.id || i} className={`flex gap-2.5 ${isManual ? "" : "opacity-70"}`}>
              <div className={`mt-0.5 shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold
                ${isManual ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {isManual
                  ? (event.author ? event.author.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?")
                  : <Bot className="h-3 w-3" />}
              </div>
              <div className={`flex-1 rounded-lg px-3 py-2 text-sm ${isManual ? "bg-card border border-border" : "bg-muted/50"}`}>
                {isManual && event.author && (
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] font-bold text-primary">{event.author}</p>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => { setEditingId(event.id); setEditText(event.comment || ""); }}
                        className="text-muted-foreground hover:text-foreground"
                        title="Editar (disponible 60s)"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                {!isManual && event.label && (
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{event.label}</p>
                )}

                {isEditing ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      className="w-full text-sm resize-none rounded border border-input bg-transparent px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 px-2 text-xs gap-1"
                        onClick={() => editMut.mutate({ id: event.id, comment: editText })}
                        disabled={editMut.isPending}>
                        <Check className="h-3 w-3" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                        onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {(event.comment || event.content || event.description || event.summary || "—")
                      .split(/(@[\w][\w\s]*)/g)
                      .map((part, idx) =>
                        part.startsWith("@")
                          ? <span key={idx} className="inline-block bg-gray-100 text-foreground rounded-md px-1.5 py-0.5 text-[12px] font-medium leading-tight">{part}</span>
                          : part
                      )}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {fmtTime(event.created_date || event.date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}