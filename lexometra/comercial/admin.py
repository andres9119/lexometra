from django.contrib import admin
from .models import Cliente, ReporteNegativo, Recaudo, PerfilEmpresa, Actividad


@admin.register(Actividad)
class ActividadAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'fecha', 'descripcion', 'usuario', 'fecha_creacion')
    list_filter = ('cliente', 'usuario')
    search_fields = ('cliente__nombre', 'descripcion')


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    search_fields = ['nombre', 'identificacion']
    list_display = ['nombre', 'identificacion', 'id_comercial', 'comercial', 'fecha_registro']


admin.site.register(Recaudo)
admin.site.register(ReporteNegativo)
admin.site.register(PerfilEmpresa)
