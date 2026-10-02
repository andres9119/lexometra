import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all unread + unsent notifications
    const pendientes = await base44.asServiceRole.entities.Notificacion.filter({
      leido: false,
      email_enviado: false,
    });

    if (!pendientes || pendientes.length === 0) {
      return Response.json({ ok: true, enviados: 0, message: "Sin notificaciones pendientes" });
    }

    // Group by destination user
    const byUser = {};
    for (const n of pendientes) {
      if (!byUser[n.usuario_destino_id]) {
        byUser[n.usuario_destino_id] = {
          nombre: n.usuario_destino_nombre || "Usuario",
          email: null,
          notificaciones: [],
        };
      }
      byUser[n.usuario_destino_id].notificaciones.push(n);
    }

    // Fetch user emails
    const users = await base44.asServiceRole.entities.User.list();
    for (const u of users) {
      if (byUser[u.id]) {
        byUser[u.id].email = u.email;
        byUser[u.id].nombre = u.full_name || byUser[u.id].nombre;
      }
    }

    let enviados = 0;
    const appUrl = "https://app.base44.com"; // base URL for links

    for (const [userId, data] of Object.entries(byUser)) {
      if (!data.email) continue;

      const items = data.notificaciones;
      const tipoIconos = {
        mencion: "💬",
        asignacion: "📋",
        vencimiento: "⏰",
        comentario: "🗒️",
        otro: "🔔",
      };

      const filas = items.map(n => {
        const icono = tipoIconos[n.tipo] || "🔔";
        const link = n.url ? `${appUrl}${n.url}` : appUrl;
        return `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 16px;font-size:13px;">${icono} ${n.mensaje}</td>
            <td style="padding:12px 16px;font-size:12px;color:#64748b;">${n.tipo}</td>
            <td style="padding:12px 16px;">
              <a href="${link}" style="font-size:12px;color:#1e40af;text-decoration:none;">Ver →</a>
            </td>
          </tr>`;
      }).join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">⚖️ LegalTrack</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">Resumen de actividad pendiente</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;color:#334155;font-size:15px;">Hola <strong>${data.nombre}</strong>,</p>
      <p style="margin:0 0 20px;color:#64748b;font-size:13px;">
        Tienes <strong>${items.length} notificación${items.length !== 1 ? "es" : ""}</strong> pendiente${items.length !== 1 ? "s" : ""} en LegalTrack:
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Notificación</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Tipo</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Acción</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
          Ir a LegalTrack →
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:11px;">
        Este resumen se envía automáticamente cada hora para notificaciones no leídas.<br/>
        Si ya las revisaste en el sistema, no recibirás más correos por ellas.
      </p>
    </div>
  </div>
</body>
</html>`;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: data.email,
        from_name: "LegalTrack",
        subject: `📬 Tienes ${items.length} notificación${items.length !== 1 ? "es" : ""} pendiente${items.length !== 1 ? "s" : ""} en LegalTrack`,
        body: html,
      });

      // Mark as email_enviado = true
      const ids = items.map(n => n.id);
      for (const nid of ids) {
        await base44.asServiceRole.entities.Notificacion.update(nid, { email_enviado: true });
      }

      enviados++;
    }

    return Response.json({ ok: true, enviados, usuarios: Object.keys(byUser).length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});