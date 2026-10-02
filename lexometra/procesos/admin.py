from django.contrib import admin
from .models import Proceso, Actuacion, CasoJuridico, ProcesoInterno, Documento, Entidad


class ActuacionInline(admin.TabularInline):
    model = Actuacion
    extra = 0


class ProcesoInternoInline(admin.TabularInline):
    model = ProcesoInterno
    extra = 0
    fields = ['tipo', 'titulo', 'estado', 'fecha_inicio', 'abogado']


@admin.register(Proceso)
class ProcesoAdmin(admin.ModelAdmin):
    list_display = ['id', 'cliente', 'servicio', 'tipo_servicio', 'estado_comercial', 'fecha_creacion']
    list_filter = ['estado_comercial', 'servicio', 'tipo_servicio']
    search_fields = ['cliente__nombre', 'cliente__identificacion']
    inlines = [ActuacionInline]


@admin.register(CasoJuridico)
class CasoJuridicoAdmin(admin.ModelAdmin):
    list_display = [
        'titulo', 'tipo_proceso', 'estado', 'abogado_asignado',
        'prioridad', 'proximo_vencimiento',
    ]
    list_filter = ['estado', 'tipo_proceso', 'prioridad', 'abogado_asignado']
    search_fields = ['titulo', 'radicado_externo', 'cliente__nombre']
    autocomplete_fields = ['abogado_asignado', 'cliente']
    inlines = [ProcesoInternoInline]


@admin.register(ProcesoInterno)
class ProcesoInternoAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'tipo', 'estado', 'caso', 'fecha_inicio', 'abogado']
    list_filter = ['tipo', 'estado', 'abogado']
    search_fields = ['titulo', 'caso__titulo']


admin.site.register(Actuacion)


@admin.register(Entidad)
class EntidadAdmin(admin.ModelAdmin):
    list_display = ['razon_social', 'nit', 'complejidad', 'fecha_registro']
    search_fields = ['razon_social', 'nit']


@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'caso', 'proceso_interno', 'subido_por', 'fecha_subida']
    list_filter = ['fecha_subida', 'subido_por']
    search_fields = ['nombre', 'descripcion']
