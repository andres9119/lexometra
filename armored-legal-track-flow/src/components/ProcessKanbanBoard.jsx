import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ProcessKanbanCard from "./ProcessKanbanCard";
import { LayoutGrid } from "lucide-react";

const SIN_ETAPA = "__sin_etapa__";
const SIN_ETAPA_LABEL = "Sin etapa";

// Derive columns from unique current_stage values in the processes list
function buildColumns(processes) {
  const stageSet = new Set();
  const withoutStage = [];

  processes.forEach(p => {
    if (p.current_stage?.trim()) {
      stageSet.add(p.current_stage.trim());
    } else {
      withoutStage.push(p);
    }
  });

  const columns = [...stageSet].map(stage => ({
    id: stage,
    label: stage,
    cards: processes.filter(p => p.current_stage?.trim() === stage),
  }));

  if (withoutStage.length > 0) {
    columns.push({ id: SIN_ETAPA, label: SIN_ETAPA_LABEL, cards: withoutStage });
  }

  return columns;
}

export default function ProcessKanbanBoard({ processes }) {
  const qc = useQueryClient();
  const columns = buildColumns(processes);

  const onDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId === SIN_ETAPA ? "" : destination.droppableId;

    try {
      await base44.entities.Process.update(draggableId, { current_stage: newStage });
      qc.invalidateQueries({ queryKey: ["processes"] });
    } catch {
      toast.error("Error al mover el proceso");
    }
  };

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <LayoutGrid className="h-10 w-10 opacity-20" />
        <p className="text-sm">No hay procesos. Crea uno y asígnale una etapa para verlo aquí.</p>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 h-full items-start">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-64">
            <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
              {/* Column header */}
              <div className="px-3 py-2 bg-muted/60 border-b border-border flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate max-w-[150px]">
                  {col.label}
                </span>
                <span className="bg-border/80 text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 shrink-0">
                  {col.cards.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[160px] max-h-[calc(100vh-280px)] overflow-y-auto p-2 space-y-2 transition-colors
                      ${snapshot.isDraggingOver ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : ""}`}
                  >
                    {col.cards.map((p, idx) => (
                      <Draggable key={p.id} draggableId={p.id} index={idx}>
                        {(prov, snap) => (
                          <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                            <ProcessKanbanCard process={p} isDragging={snap.isDragging} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {col.cards.length === 0 && !snapshot.isDraggingOver && (
                      <p className="text-center text-[11px] text-muted-foreground/40 py-6">Arrastra aquí</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}