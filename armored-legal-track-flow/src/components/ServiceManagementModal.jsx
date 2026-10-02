import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Edit2, Check } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SERVICES = ["Eliminación de Reportes", "Acción de Tutela", "Proceso SIC", "Gestión de Cartera", "Otro"];

export default function ServiceManagementModal({ open, onOpenChange }) {
  const [newServiceName, setNewServiceName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Fetch services from the database
  const { data: dbServices = [], refetch } = useQuery({
    queryKey: ["service_types"],
    queryFn: async () => {
      const items = await base44.entities.ServiceType.list('-order');
      const dbNames = items.map(s => s.name);
      
      // Migrate services from localStorage if they don't exist in DB
      const storedServices = localStorage.getItem("custom_services");
      if (storedServices) {
        try {
          const storedNames = JSON.parse(storedServices);
          const missingServices = storedNames.filter(
            name => !dbNames.includes(name)
          );
          
          if (missingServices.length > 0) {
            const maxOrder = Math.max(...items.map(s => s.order || 0), 0);
            for (let i = 0; i < missingServices.length; i++) {
              await base44.entities.ServiceType.create({
                name: missingServices[i],
                is_default: false,
                order: maxOrder + i + 1
              });
            }
            // Refetch after migration
            return base44.entities.ServiceType.list('-order');
          }
        } catch (e) {
          console.error("Migration error:", e);
        }
      }
      
      // Sync localStorage with DB
      localStorage.setItem("custom_services", JSON.stringify(dbNames));
      return items;
    },
    enabled: open
  });

  const addMutation = useMutation({
   mutationFn: async (name) => {
     const order = Math.max(...(dbServices?.map(s => s.order || 0) || []), 0) + 1;
     return await base44.entities.ServiceType.create({
       name: name.trim(),
       is_default: false,
       order
     });
   },
   onSuccess: () => {
     setNewServiceName("");
     toast.success("Servicio añadido");
     refetch();
     window.dispatchEvent(new Event("customServicesUpdated"));
   },
   onError: (error) => {
     const msg = error?.message || "Error al añadir el servicio";
     toast.error(msg);
   }
  });

  const updateMutation = useMutation({
   mutationFn: async ({ service_id, new_name }) => {
     try {
       const res = await base44.functions.invoke('updateServiceType', {
         service_id,
         new_name
       });
       if (!res?.data?.success) {
         throw new Error(res?.data?.error || "Error al actualizar el servicio");
       }
       return res.data;
     } catch (err) {
       const statusCode = err?.response?.status;
       if (statusCode === 403) {
         throw new Error("No tiene permisos para actualizar este servicio");
       }
       throw err;
     }
   },
   onSuccess: () => {
     setEditingId(null);
     setEditValue("");
     toast.success("Servicio actualizado");
     refetch();
     window.dispatchEvent(new Event("customServicesUpdated"));
   },
   onError: (error) => {
     const msg = error?.message || "No se pudo actualizar el servicio";
     toast.error(msg);
     console.error("Update error:", error);
   }
  });

  const removeMutation = useMutation({
   mutationFn: async (service_id) => {
     try {
       const res = await base44.functions.invoke('deleteServiceType', {
         service_id
       });
       if (res?.data?.error) {
         throw new Error(res.data.error);
       }
       return res.data;
     } catch (err) {
       const statusCode = err?.response?.status;
       if (statusCode === 403) {
         throw new Error("No tiene permisos para eliminar este servicio");
       }
       throw err;
     }
   },
   onSuccess: () => {
     toast.success("Servicio eliminado correctamente");
     refetch();
     window.dispatchEvent(new Event("customServicesUpdated"));
   },
   onError: (error) => {
     const errorMsg = error?.message || "No se pudo eliminar el servicio";
     toast.error(errorMsg);
     console.error("Delete error:", error);
   }
  });

  const handleAddService = () => {
   try {
     if (!newServiceName.trim()) {
       toast.error("El nombre no puede estar vacío");
       return;
     }
     if (!dbServices?.length && dbServices.length === 0) {
       // First service
     } else if (!dbServices?.length) {
       toast.error("Error: no hay servicios cargados");
       return;
     }
     const isDuplicate = dbServices?.some?.(
       s => s.name.toLowerCase() === newServiceName.toLowerCase()
     );
     if (isDuplicate) {
       toast.error("Este servicio ya existe");
       return;
     }
     addMutation.mutate(newServiceName);
   } catch (err) {
     toast.error("Error al procesar la solicitud: " + (err?.message || "desconocido"));
   }
  };

  const handleSaveEdit = (serviceId) => {
   try {
     if (!editValue.trim()) {
       toast.error("El nombre no puede estar vacío");
       return;
     }
     if (!dbServices?.length) {
       toast.error("Error: no hay servicios cargados");
       return;
     }
     const isDuplicate = dbServices.some(
       s => s.id !== serviceId && s.name.toLowerCase() === editValue.toLowerCase()
     );
     if (isDuplicate) {
       toast.error("Este servicio ya existe");
       return;
     }
     updateMutation.mutate({ service_id: serviceId, new_name: editValue });
   } catch (err) {
     toast.error("Error al procesar la solicitud: " + (err?.message || "desconocido"));
   }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="max-w-md bg-white p-0 gap-0">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-700 border-b border-slate-600">
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            Gestionar Servicios
          </span>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-300 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Add new service */}
          <div className="flex gap-2">
            <Input
              placeholder="Nuevo servicio..."
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddService();
              }}
              className="text-sm h-8"
            />
            <Button
              size="sm"
              onClick={handleAddService}
              disabled={addMutation.isPending || !newServiceName.trim()}
              className="px-3 h-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Services list */}
          <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
            {dbServices.length > 0 ? (
              dbServices.map((svc) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm gap-2 hover:border-blue-300 transition-colors"
                >
                  {editingId === svc.id ? (
                    <Input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(svc.id);
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      className="h-7 text-xs flex-1"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium text-gray-700">{svc.name}</span>
                      {svc.is_default && (
                        <span className="text-[10px] text-gray-400 font-semibold">
                          POR DEFECTO
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {editingId === svc.id ? (
                      <>
                        <button
                          onClick={() => {
                            try {
                              if (!svc?.id) {
                                toast.error("Error: ID de servicio inválido");
                                return;
                              }
                              handleSaveEdit(svc.id);
                            } catch (err) {
                              toast.error("Error al guardar: " + (err?.message || "desconocido"));
                            }
                          }}
                          disabled={updateMutation.isPending}
                          className="text-green-600 hover:text-green-700 disabled:opacity-50"
                          title="Guardar"
                        >
                          {updateMutation.isPending ? (
                            <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={updateMutation.isPending}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                       <>
                         <button
                           onClick={() => {
                             setEditingId(svc.id);
                             setEditValue(svc.name);
                           }}
                           className="text-blue-500 hover:text-blue-700 transition-colors"
                           title="Editar servicio"
                         >
                           <Edit2 className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => {
                             try {
                               if (!svc?.id) {
                                 toast.error("Error: ID de servicio inválido");
                                 return;
                               }
                               if (confirm("¿Está seguro de que desea eliminar este servicio?")) {
                                 removeMutation.mutate(svc.id);
                               }
                             } catch (err) {
                               toast.error("Error al procesar eliminación: " + (err?.message || "desconocido"));
                             }
                           }}
                           disabled={svc?.is_default || removeMutation.isPending}
                           className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                           title={svc?.is_default ? "No se pueden eliminar servicios por defecto" : "Eliminar servicio"}
                         >
                           {removeMutation.isPending ? (
                             <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                           ) : (
                             <X className="h-4 w-4" />
                           )}
                         </button>
                       </>
                     )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 p-2 text-center">
                No hay servicios configurados
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-gray-200 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}