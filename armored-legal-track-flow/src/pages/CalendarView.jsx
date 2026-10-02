import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO, getDay } from "date-fns";
import { es } from "date-fns/locale";

const TC = { tutela: "bg-blue-500", sic: "bg-amber-500", otro: "bg-slate-400" };

export default function CalendarView() {
  const [month, setMonth] = useState(new Date());
  const { data: processes = [] } = useQuery({ queryKey: ["processes"], queryFn: () => base44.entities.Process.list() });
  const { data: stages = [] } = useQuery({ queryKey: ["all-stages"], queryFn: () => base44.entities.ProcessStage.list() });

  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const pad = getDay(start);

  const eventsFor = (day) => {
    const dl = processes.filter(p => p.next_deadline && isSameDay(parseISO(p.next_deadline), day));
    const st = stages.filter(s => s.date && isSameDay(parseISO(s.date), day));
    return { dl, st };
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth(p => subMonths(p, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold capitalize">{format(month, "MMMM yyyy", { locale: es })}</h2>
        <Button variant="ghost" size="icon" onClick={() => setMonth(p => addMonths(p, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(d => (
            <div key={d} className="p-2 text-xs font-medium text-muted-foreground text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: pad }).map((_, i) => <div key={`e-${i}`} className="min-h-[80px] md:min-h-[100px] border-b border-r bg-muted/20" />)}
          {days.map(day => {
            const { dl, st } = eventsFor(day);
            const today = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-[80px] md:min-h-[100px] border-b border-r p-1.5 ${today ? "bg-primary/5" : ""}`}>
                <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${today ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dl.slice(0, 2).map(p => (
                    <Link key={p.id} to={`/process/${p.id}`}><div className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${TC[p.type]}`}>{p.title}</div></Link>
                  ))}
                  {st.slice(0, 1).map(s => (
                    <div key={s.id} className="text-[10px] px-1 py-0.5 rounded truncate bg-secondary text-secondary-foreground">{s.stage_name}</div>
                  ))}
                  {(dl.length + st.length > 3) && <span className="text-[10px] text-muted-foreground">+{dl.length + st.length - 3}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}