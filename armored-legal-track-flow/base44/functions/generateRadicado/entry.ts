import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Generates a unique internal radicado: YYYY-SEQ
 * Sequence starts at 100 each year and increments by +1.
 * Called during Process creation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const currentYear = new Date().getFullYear();
    const yearPrefix = `${currentYear}-`;

    // Fetch all processes that have a radicado_interno for this year
    const allProcesses = await base44.asServiceRole.entities.Process.list();
    const thisYearRadicados = allProcesses
      .filter(p => p.radicado_interno && p.radicado_interno.startsWith(yearPrefix))
      .map(p => {
        const seq = parseInt(p.radicado_interno.replace(yearPrefix, ''), 10);
        return isNaN(seq) ? 0 : seq;
      });

    const maxSeq = thisYearRadicados.length > 0 ? Math.max(...thisYearRadicados) : 99;
    const nextSeq = Math.max(maxSeq + 1, 100); // minimum 100
    const radicado_interno = `${currentYear}-${nextSeq}`;

    return Response.json({ radicado_interno });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});