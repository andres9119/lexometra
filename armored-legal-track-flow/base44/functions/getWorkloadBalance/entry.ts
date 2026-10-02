import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * GET /api/equipo/carga-laboral
 * Retorna abogados ordenados de menor a mayor carga de procesos activos.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Obtener todos los usuarios y procesos activos/en trámite en paralelo
    const [users, activosRaw, tramiteRaw] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Process.filter({ status: 'activo' }),
      base44.asServiceRole.entities.Process.filter({ status: 'en_tramite' }),
    ]);

    const allActive = [...activosRaw, ...tramiteRaw];

    // Contar procesos por abogado asignado
    const countMap = {};
    allActive.forEach(p => {
      if (p.assigned_lawyer_id) {
        countMap[p.assigned_lawyer_id] = (countMap[p.assigned_lawyer_id] || 0) + 1;
      }
    });

    // Construir array de carga laboral
    const workload = users.map(u => ({
      id: u.id,
      nombre: u.full_name || u.email || 'Sin nombre',
      email: u.email || '',
      activos: countMap[u.id] || 0,
    }));

    // Ordenar de menor a mayor carga
    workload.sort((a, b) => a.activos - b.activos);

    return Response.json({ workload });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});