import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { service_id, new_name } = await req.json();

    if (!service_id || !new_name || !new_name.trim()) {
      return Response.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Update the service
    const updated = await base44.asServiceRole.entities.ServiceType.update(
      service_id,
      { name: new_name.trim() }
    );

    return Response.json({ success: true, service: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});