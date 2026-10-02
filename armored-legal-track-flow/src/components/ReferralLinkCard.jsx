import { useState } from "react";
import { Link2, Copy, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ReferralLinkCard({ referrerId }) {
  const [copied, setCopied] = useState(false);

  const baseUrl = window.location.origin;
  const link = `${baseUrl}/referral?ref=${referrerId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1.5 flex items-center gap-1">
        <Link2 className="h-3 w-3" /> Enlace de referido
      </p>
      <div className="flex items-center gap-2">
        <p className="text-xs text-blue-800 truncate flex-1 font-mono bg-blue-100 rounded px-2 py-1">{link}</p>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100" onClick={handleCopy}>
          {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <a href={link} target="_blank" rel="noreferrer">
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </a>
      </div>
    </div>
  );
}