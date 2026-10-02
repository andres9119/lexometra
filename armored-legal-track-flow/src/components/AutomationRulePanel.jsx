import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AutomationRulePanel({ stateId, open, onOpenChange }) {
  const [rules, setRules] = useState([]);
  const [newRule, setNewRule] = useState({ rule_type: 'send_webhook', webhook_url: '' });
  const [testResult, setTestResult] = useState(null);
  const qc = useQueryClient();

  const { data: automations = [] } = useQuery({
    queryKey: ['automations', stateId],
    queryFn: () => base44.entities.StateAutomation.filter({ process_state_id: stateId }, 'order'),
    enabled: !!stateId && open,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StateAutomation.create({
      process_state_id: stateId,
      ...data,
      order: (automations?.length || 0) + 1,
    }),
    onSuccess: () => {
      toast.success('Regla agregada');
      setNewRule({ rule_type: 'send_webhook', webhook_url: '' });
      setTestResult(null);
      qc.invalidateQueries({ queryKey: ['automations', stateId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StateAutomation.delete(id),
    onSuccess: () => {
      toast.success('Regla eliminada');
      qc.invalidateQueries({ queryKey: ['automations', stateId] });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (url) => base44.functions.invoke('testWebhook', { webhook_url: url }),
    onSuccess: (res) => {
      const data = res.data;
      setTestResult({
        success: data.success,
        status: data.status,
        message: data.message || data.error,
        timestamp: data.timestamp,
      });
      toast[data.success ? 'success' : 'error'](data.message || data.error);
    },
  });

  const handleAddRule = () => {
    if (!newRule.webhook_url.trim()) {
      toast.error('Ingresa una URL válida');
      return;
    }
    createMutation.mutate(newRule);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Reglas de Automatización</DialogTitle></DialogHeader>
        
        <div className="space-y-4">
          {/* Reglas existentes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Reglas Actuales</p>
            {automations?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Sin reglas configuradas</p>
            ) : (
              <div className="space-y-2">
                {automations.map(rule => (
                  <div key={rule.id} className="bg-muted/30 border border-border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{rule.rule_type.replace('_', ' ')}</p>
                      {rule.webhook_url && (
                        <p className="text-xs text-muted-foreground truncate font-mono">{rule.webhook_url}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-destructive shrink-0"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar nueva regla */}
          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <Label className="text-xs font-semibold">Tipo de Regla</Label>
              <Select value={newRule.rule_type} onValueChange={(v) => setNewRule({ ...newRule, rule_type: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_webhook">Disparar Webhook</SelectItem>
                  <SelectItem value="change_color">Cambiar Color</SelectItem>
                  <SelectItem value="send_email">Enviar Email</SelectItem>
                  <SelectItem value="log_event">Registrar Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newRule.rule_type === 'send_webhook' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">URL del Webhook</Label>
                <Input
                  placeholder="https://your-webhook.example.com/api/..."
                  value={newRule.webhook_url}
                  onChange={(e) => setNewRule({ ...newRule, webhook_url: e.target.value })}
                  className="text-sm h-8"
                />

                {/* Test button */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testWebhookMutation.mutate(newRule.webhook_url)}
                  disabled={!newRule.webhook_url.trim() || testWebhookMutation.isPending}
                  className="h-7 text-xs gap-1.5"
                >
                  {testWebhookMutation.isPending ? '...' : '🧪 Enviar JSON de Prueba'}
                </Button>

                {/* Test result */}
                {testResult && (
                  <div
                    className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.status && <p className="text-[10px] opacity-80">Status: {testResult.status}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleAddRule}
              disabled={createMutation.isPending || !newRule.webhook_url.trim()}
              className="w-full h-8 text-sm gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar Regla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}