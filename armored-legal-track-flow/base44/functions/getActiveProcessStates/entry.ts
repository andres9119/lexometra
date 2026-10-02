import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const states = await base44.entities.ProcessState.list('order', 100);
    const active = states.filter(s => s.is_active !== false);

    return Response.json({
      states: active,
      total: active.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});