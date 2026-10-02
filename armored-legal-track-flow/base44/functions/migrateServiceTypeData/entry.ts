import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const log = [];

    // STEP 1: Ensure default ServiceType records exist
    log.push("=== STEP 1: Seeding default ServiceType records ===");
    
    const defaultServices = [
      { name: "Eliminación de Reportes", order: 1 },
      { name: "Acción de Tutela", order: 2 },
      { name: "Proceso SIC", order: 3 },
      { name: "Gestión de Cartera", order: 4 },
      { name: "Otro", order: 5 }
    ];

    const serviceMap = {};

    for (const svc of defaultServices) {
      const existing = await base44.asServiceRole.entities.ServiceType.filter({
        name: svc.name
      });

      if (existing && existing.length > 0) {
        serviceMap[svc.name] = existing[0].id;
        log.push(`✓ ServiceType "${svc.name}" already exists (ID: ${existing[0].id})`);
      } else {
        const created = await base44.asServiceRole.entities.ServiceType.create({
          name: svc.name,
          is_default: true,
          order: svc.order
        });
        serviceMap[svc.name] = created.id;
        log.push(`✓ Created ServiceType "${svc.name}" (ID: ${created.id})`);
      }
    }

    // STEP 2: Migrate Client records
    log.push("\n=== STEP 2: Migrating Client service_type references ===");
    
    const clients = await base44.asServiceRole.entities.Client.list('', 1000);
    let clientsUpdated = 0;
    
    for (const client of clients) {
      if (!client.service_type) continue;
      
      // Map old string values to new IDs
      const serviceId = serviceMap[client.service_type];
      
      if (serviceId) {
        // Store the service_type_id while keeping backward compatibility
        await base44.asServiceRole.entities.Client.update(client.id, {
          service_type_id: serviceId
        });
        clientsUpdated++;
        log.push(`✓ Updated Client ${client.id} (${client.full_name}): service_type_id = ${serviceId}`);
      } else if (client.service_type && client.service_type !== "") {
        // Try fuzzy match for custom services
        const fuzzyMatch = Object.entries(serviceMap).find(([key]) => 
          key.toLowerCase().includes(client.service_type.toLowerCase()) ||
          client.service_type.toLowerCase().includes(key.toLowerCase())
        );
        
        if (fuzzyMatch) {
          await base44.asServiceRole.entities.Client.update(client.id, {
            service_type_id: fuzzyMatch[1]
          });
          clientsUpdated++;
          log.push(`✓ Updated Client ${client.id} (fuzzy match): service_type_id = ${fuzzyMatch[1]}`);
        } else {
          log.push(`⚠ Skipped Client ${client.id}: no matching service found for "${client.service_type}"`);
        }
      }
    }

    log.push(`\nTotal Clients updated: ${clientsUpdated}`);

    // STEP 3: Migrate Process records
    log.push("\n=== STEP 3: Migrating Process service_type references ===");
    
    const processes = await base44.asServiceRole.entities.Process.list('', 1000);
    let processesUpdated = 0;

    // Map process type to service type
    const processTypeToServiceMap = {
      'eliminacion_reportes': 'Eliminación de Reportes',
      'tutela': 'Acción de Tutela',
      'sic': 'Proceso SIC',
      'ejecutivo': 'Gestión de Cartera',
      'cartera': 'Gestión de Cartera',
      'otro': 'Otro'
    };

    for (const process of processes) {
      if (!process.type) continue;

      const serviceName = processTypeToServiceMap[process.type];
      const serviceId = serviceName ? serviceMap[serviceName] : null;

      if (serviceId) {
        await base44.asServiceRole.entities.Process.update(process.id, {
          service_type_id: serviceId
        });
        processesUpdated++;
        log.push(`✓ Updated Process ${process.id}: service_type_id = ${serviceId}`);
      } else {
        log.push(`⚠ Skipped Process ${process.id}: no mapping for type "${process.type}"`);
      }
    }

    log.push(`\nTotal Processes updated: ${processesUpdated}`);

    // STEP 4: Summary
    log.push("\n=== MIGRATION COMPLETE ===");
    log.push(`ServiceType records created/verified: ${Object.keys(serviceMap).length}`);
    log.push(`Client records updated: ${clientsUpdated}`);
    log.push(`Process records updated: ${processesUpdated}`);

    return Response.json({
      success: true,
      message: "Data migration completed successfully",
      log: log.join("\n"),
      summary: {
        servicesSeeded: Object.keys(serviceMap).length,
        clientsMigrated: clientsUpdated,
        processesMigrated: processesUpdated
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});