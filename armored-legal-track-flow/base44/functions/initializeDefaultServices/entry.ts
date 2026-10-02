import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if services already exist
    const existingServices = await base44.asServiceRole.entities.ServiceType.list();

    if (existingServices.length > 0) {
      return Response.json({
        success: true,
        message: "Services already initialized",
        count: existingServices.length
      });
    }

    // Initialize default services
    const defaultServices = [
      { name: "Eliminación de Reportes", order: 1 },
      { name: "Acción de Tutela", order: 2 },
      { name: "Proceso SIC", order: 3 },
      { name: "Gestión de Cartera", order: 4 },
      { name: "Otro", order: 5 }
    ];

    const created = [];
    for (const svc of defaultServices) {
      const result = await base44.asServiceRole.entities.ServiceType.create({
        ...svc,
        is_default: true
      });
      created.push(result);
    }

    return Response.json({
      success: true,
      message: "Default services initialized",
      services: created
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});