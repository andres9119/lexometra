import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, MessageSquare, Zap, FileText, TrendingUp, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const ICON_CONFIG = {
  system: { icon: Settings, color: 'bg-slate-100 text-slate-600', label: 'Sistema' },
  legal: { icon: FileText, color: 'bg-blue-100 text-blue-600', label: 'Evento Legal' },
  financial: { icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600', label: 'Financiero' },
  manual_note: { icon: MessageSquare, color: 'bg-amber-100 text-amber-600', label: 'Nota Manual' },
};

export default function ProcessTimeline({ processId }) {
  const [offset, setOffset] = useState(0);
  const [allEvents, setAllEvents] = useState([]);
  const [newNote, setNewNote] = useState('');
  const qc = useQueryClient();

  const { data: timelineData, isLoading } = useQuery({
    queryKey: ['timeline', processId, offset],
    queryFn: () => base44.functions.invoke('getProcessTimeline', { process_id: processId, offset, limit: 10 }),
    enabled: !!processId,
  });

  useEffect(() => {
    if (timelineData?.data?.events) {
      if (offset === 0) {
        setAllEvents(timelineData.data.events);
      } else {
        setAllEvents(prev => [...prev, ...timelineData.data.events]);
      }
    }
  }, [timelineData, offset]);

  const addNote = useMutation({
    mutationFn: (comment) => base44.entities.ClientActivity.create({
      client_id: processId,
      comment,
      activity_type: 'comentario',
    }),
    onSuccess: (newActivity) => {
      const newEvent = {
        id: newActivity.id,
        created_date: newActivity.created_date,
        type: 'comentario',
        title: 'Nota Manual',
        description: newNote,
        author: 'Tú',
        source: 'activity',
        icon_type: 'manual_note',
      };
      setAllEvents(prev => [newEvent, ...prev]);
      setNewNote('');
      toast.success('Nota agregada a la bitácora');
      qc.invalidateQueries({ queryKey: ['timeline', processId] });
    },
    onError: () => toast.error('Error al agregar la nota'),
  });

  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: es });
    } catch {
      return '—';
    }
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + 10);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) {
      toast.error('Escribe una nota antes de guardar');
      return;
    }
    addNote.mutate(newNote);
  };

  return (
    <div className="space-y-6">
      {/* Input Rápido */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
          Agregar a la Bitácora
        </label>
        <Textarea
          placeholder="Escribe una nota, actualización o novedad del caso..."
          rows={3}
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          className="text-sm resize-none mb-2"
        />
        <Button
          size="sm"
          disabled={addNote.isPending || !newNote.trim()}
          onClick={handleAddNote}
          className="gap-1.5"
        >
          {addNote.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Agregar a Bitácora
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {isLoading && allEvents.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sin eventos registrados aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {allEvents.map((event, idx) => {
              const config = ICON_CONFIG[event.icon_type] || ICON_CONFIG.system;
              const IconComponent = config.icon;
              return (
                <div key={event.id} className="flex gap-4">
                  {/* Timeline line + node */}
                  <div className="flex flex-col items-center">
                    <div className={`h-10 w-10 rounded-full ${config.color} flex items-center justify-center shadow-sm`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    {idx < allEvents.length - 1 && (
                      <div className="w-0.5 bg-border h-12 mt-2" />
                    )}
                  </div>

                  {/* Event card */}
                  <div className="flex-1 pb-4">
                    <div className="bg-card border border-border rounded-lg p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{event.title}</h4>
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap ml-auto">
                          {fmtDate(event.created_date)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{event.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">👤 {event.author}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more button */}
        {timelineData?.data?.hasMore && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="text-xs"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Cargar más historial...
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}