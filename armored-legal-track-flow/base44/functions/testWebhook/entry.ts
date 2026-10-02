import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { webhook_url } = await req.json();

    if (!webhook_url) {
      return Response.json({ error: 'webhook_url required' }, { status: 400 });
    }

    // Test payload
    const testPayload = {
      evento: {
        tipo: 'TEST_WEBHOOK',
        fecha_disparo: new Date().toISOString(),
        origen: 'Plataforma_LegalTrack_TEST'
      },
      mensaje: 'Este es un mensaje de prueba para validar la conexión'
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      return Response.json({
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Conexión exitosa' : `Error: ${response.status}`,
        timestamp: new Date().toISOString()
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      return Response.json({
        success: false,
        error: fetchError.name === 'AbortError' ? 'Timeout (5s)' : fetchError.message,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});