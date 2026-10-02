import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export default function EmailListInput({ emails = [], onChange, required = false }) {
  const [draft, setDraft] = useState("");

  const addEmail = () => {
    const val = draft.trim().toLowerCase();
    if (!val) return;
    if (emails.includes(val)) return;
    onChange([...emails, val]);
    setDraft("");
  };

  const removeEmail = (idx) => {
    onChange(emails.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addEmail(); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="email"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="correo@entidad.com"
          className="flex-1"
        />
        <Button type="button" size="icon" variant="outline" onClick={addEmail} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {emails.map((email, idx) => (
            <span key={idx} className="flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-mono px-2 py-1 rounded-full">
              {email}
              <button type="button" onClick={() => removeEmail(idx)} className="hover:text-red-500 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {required && emails.length === 0 && (
        <p className="text-[10px] text-red-500">Agrega al menos un correo</p>
      )}
    </div>
  );
}