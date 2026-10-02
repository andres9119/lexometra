import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { service_id } = body;

    if (!service_id) {
      return Response.json({ error: 'service_id is required' }, { status: 400 });
    }

    // Fetch the service to check if it's default
    const service = await base44.asServiceRole.entities.ServiceType.filter({ id: service_id });
    if (!service || service.length === 0) {
      return Response.json({ error: 'Service not found' }, { status: 404 });
    }

    const svc = service[0];
    
    // Prevent deletion of default services
    if (svc.is_default) {
      return Response.json({
        error: 'Cannot delete default service',
        code: 'DEFAULT_SERVICE_PROTECTED'
      }, { status: 403 });
    }

    // Check if service is in use by Clients
    const clientsUsing = await base44.asServiceRole.entities.Client.filter({ service_type_id: service_id });
    if (clientsUsing && clientsUsing.length > 0) {
      return Response.json({
        error: `No se puede eliminar: Este servicio ya está asignado a ${clientsUsing.length} cliente(s).`,
        code: 'SERVICE_IN_USE',
        clients_count: clientsUsing.length
      }, { status: 409 });
    }

    // Check if service is in use by Processes
    const processesUsing = await base44.asServiceRole.entities.Process.filter({ service_type_id: service_id });
    if (processesUsing && processesUsing.length > 0) {
      return Response.json({
        error: `No se puede eliminar: Este servicio ya está asignado a ${processesUsing.length} expediente(s).`,
        code: 'SERVICE_IN_USE',
        processes_count: processesUsing.length
      }, { status: 409 });
    }

    // Safe to delete
    await base44.asServiceRole.entities.ServiceType.delete(service_id);

    return Response.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});