import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import AutomationRulePanel from './AutomationRulePanel';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const StateCard = ({ state, onEdit, onDelete, index }) => {
  return (
    <Draggable draggableId={state.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={"bg-card border border-border rounded-lg p-4 flex items-center justify-between select-none transition-all " + (snapshot.isDragging ? "bg-primary/5 shadow-lg" : "")}
        >
          <div className="flex items-center gap-3 flex-1">
            <button {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1">
              <p className="font-semibold text-sm">{state.display_name}</p>
              <p className="text-xs text-muted-foreground">{state.name}</p>
            </div>
            <div
              className="h-6 w-6 rounded border border-border shadow-sm"
              style={{ backgroundColor: state.color }}
              title={state.color}
            />
            {state.is_terminal && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Terminal</span>}
            {!state.is_active && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Inactivo</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(state)} className="h-7"><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => onDelete(state.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default function AdminStateManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [formData, setFormData] = useState({ display_name: '', name: '', color: '#10b981', is_terminal: false, allowed_transitions: [] });
  const qc = useQueryClient();

  const { data: states = [] } = useQuery({
    queryKey: ['process_states'],
    queryFn: () => base44.entities.ProcessState.list('order', 100),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingState) {
        return base44.entities.ProcessState.update(editingState.id, data);
      }
      const maxOrder = states.length > 0 ? Math.max(...states.map(s => s.order || 0)) : 0;
      return base44.entities.ProcessState.create({ ...data, order: maxOrder + 1 });
    },
    onSuccess: () => {
      toast.success(editingState ? 'Estado actualizado' : 'Estado creado');
      setShowForm(false);
      setEditingState(null);
      setFormData({ display_name: '', name: '', color: '#10b981', is_terminal: false, allowed_transitions: [] });
      qc.invalidateQueries({ queryKey: ['process_states'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (stateId) => base44.entities.ProcessState.delete(stateId),
    onSuccess: () => {
      toast.success('Estado eliminado');
      qc.invalidateQueries({ queryKey: ['process_states'] });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (newOrder) => {
      const updates = newOrder.map((stateId, idx) => ({
        stateId,
        order: idx + 1,
      }));
      for (const { stateId, order } of updates) {
        await base44.entities.ProcessState.update(stateId, { order });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['process_states'] });
    },
  });

  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.index === destination.index && source.droppableId === destination.droppableId)) {
      return;
    }
    const newOrder = Array.from(states);
    const [movedState] = newOrder.splice(source.index, 1);
    newOrder.splice(destination.index, 0, movedState);
    reorderMutation.mutate(newOrder.map(s => s.id));
  };

  const handleEdit = (state) => {
    setEditingState(state);
    setFormData({ display_name: state.display_name, name: state.name, color: state.color, is_terminal: state.is_terminal, allowed_transitions: state.allowed_transitions || [] });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.display_name.trim() || !formData.name.trim()) {
      toast.error('Completa todos los campos');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Estados del Proceso</h2>
        <Button size="sm" onClick={() => { setEditingState(null); setShowForm(true); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nuevo Estado
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="process-states">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={"space-y-3 transition-colors " + (snapshot.isDraggingOver ? "bg-primary/5 rounded-lg p-2" : "")}
            >
              {states.map((state, idx) => (
                <StateCard
                  key={state.id}
                  state={state}
                  index={idx}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingState ? 'Editar Estado' : 'Nuevo Estado'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre Mostrado *</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="Ej: Petición Radicada"
              />
            </div>
            <div>
              <Label>Nombre Interno *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: peticion_radicada"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="h-10 w-10 rounded border border-border cursor-pointer"
                />
                <span className="text-sm font-mono text-muted-foreground">{formData.color}</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_terminal}
                onChange={(e) => setFormData({ ...formData, is_terminal: e.target.checked })}
              />
              <span className="text-sm">¿Estado final del proceso?</span>
            </label>

            {/* Transiciones permitidas */}
            <div>
              <Label className="mb-1.5 block">Transiciones permitidas desde este estado</Label>
              <p className="text-[11px] text-muted-foreground mb-2">Si no marcas ninguno, se permite ir a cualquier estado.</p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto border border-border rounded-lg p-3">
                {states.filter(s => s.id !== editingState?.id).map(s => {
                  const checked = formData.allowed_transitions.includes(s.name);
                  return (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded px-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? formData.allowed_transitions.filter(n => n !== s.name)
                            : [...formData.allowed_transitions, s.name];
                          setFormData({ ...formData, allowed_transitions: next });
                        }}
                        className="rounded"
                      />
                      <span className="h-3 w-3 rounded-sm inline-block shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-sm">{s.display_name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}