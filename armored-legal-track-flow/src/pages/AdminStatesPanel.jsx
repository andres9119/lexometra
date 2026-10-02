import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Settings } from 'lucide-react';
import AdminStateManager from '@/components/AdminStateManager';
import AutomationRulePanel from '@/components/AutomationRulePanel';

export default function AdminStatesPanel() {
  const [selectedStateId, setSelectedStateId] = useState(null);
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/"><Button variant="ghost" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5" /> Panel Administrador
          </h1>
          <p className="text-sm text-muted-foreground">Gestiona estados y automatizaciones del proceso</p>
        </div>
      </div>

      <Tabs defaultValue="states">
        <TabsList>
          <TabsTrigger value="states">Estados</TabsTrigger>
          <TabsTrigger value="docs">Documentación</TabsTrigger>
        </TabsList>

        <TabsContent value="states" className="mt-6">
          <AdminStateManager />
        </TabsContent>

        <TabsContent value="docs" className="mt-6">
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold">Estructura del Webhook</h2>
            <p className="text-sm text-muted-foreground">
              Cuando se dispara una automatización de tipo "Webhook", el sistema envía el siguiente JSON estándar:
            </p>
            <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs overflow-auto font-mono">
{`{
  "evento": {
    "tipo": "CAMBIO_ESTADO",
    "fecha_disparo": "2026-05-31T19:58:29-05:00",
    "origen": "Plataforma_LegalTrack"
  },
  "estado_transicion": {
    "estado_anterior": "Petición Radicada",
    "estado_nuevo": "En Trámite",
    "es_terminal": false
  },
  "cliente": {
    "id_cliente": "1005512876",
    "nombre_completo": "CAMELL ENRIQUE CAUSIL CURE",
    "email": "viloria542@gmail.com",
    "celular": "3146159776"
  },
  "proceso": {
    "id_proceso": "6a1cbcf5fe57f5268917faf0",
    "tipo_servicio": "Eliminación de Reportes",
    "valor_expectativa": 1000000.00,
    "saldo_pendiente": 0.00
  },
  "metadatos_personalizados": {
    "jurisdiccion": "San Benito Abad, Sucre",
    "entidades_afectadas": ["SISTECRÉDITO", "COLOMBIA TELECOMUNICACIONES S.A."]
  }
}`}
            </pre>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-2">💡 Notas de Integración:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>El timeout es de 5 segundos. Si no hay respuesta, el sistema lo reintentar automáticamente.</li>
                <li>Usa Power Automate o Zapier para capturar estas variables y crear acciones downstream (crear carpetas, enviar correos, etc).</li>
                <li>Puedes usar el botón "Enviar JSON de Prueba" para validar tu URL destino antes de activar en producción.</li>
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AutomationRulePanel stateId={selectedStateId} open={showRules} onOpenChange={setShowRules} />
    </div>
  );
}