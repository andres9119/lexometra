import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const processId = body.process_id;

    if (!processId) {
      return Response.json({ error: 'process_id is required' }, { status: 400 });
    }

    const events = [];

    // 1. Comentarios manuales guardados con client_id = processId
    const activities = await base44.entities.ClientActivity.filter({ client_id: processId }, '-created_date', 200);

    // Resolver nombres reales de usuarios
    let usersMap = {};
    try {
      const users = await base44.asServiceRole.entities.User.list();
      usersMap = Object.fromEntries(users.map(u => [u.full_name, u.full_name]));
      // También indexar por id por si acaso
      users.forEach(u => { usersMap[u.id] = u.full_name; });
    } catch (_) { /* si falla, usamos el nombre guardado */ }

    const manualNotes = activities.map(act => ({
      id: act.id,
      created_date: act.created_date,
      type: 'comentario',
      comment: act.comment,
      author: usersMap[act.created_by_id] || act.author || 'Usuario',
      activity_type: 'comentario',
    }));
    events.push(...manualNotes);

    // 2. Audit logs del proceso
    const auditLogs = await base44.asServiceRole.entities.ClientAuditLog.filter({ entity_id: processId }, '-created_date', 100);
    const systemLogs = auditLogs.map(log => ({
      id: log.id,
      created_date: log.created_date,
      type: 'system',
      label: log.field_label || 'Cambio',
      comment: `${log.old_value || '—'} → ${log.new_value || '—'}`,
      author: log.user_name || 'Sistema',
    }));
    events.push(...systemLogs);

    // Ordenar cronológicamente (más recientes primero)
    events.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    return Response.json({ events });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});