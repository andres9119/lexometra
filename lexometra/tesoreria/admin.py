from django.contrib import admin
from .models import ProveedorFacturacion, Factura, FacturaItem, Pago, Egreso, NotaCreditoDebito


class FacturaItemInline(admin.TabularInline):
    model = FacturaItem
    extra = 0


class PagoInline(admin.TabularInline):
    model = Pago
    extra = 0


@admin.register(ProveedorFacturacion)
class ProveedorFacturacionAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'activo', 'api_url', 'token_status']
    fields = ['nombre', 'activo', 'api_url', 'configuracion']

    @admin.display(description='Token')
    def token_status(self, obj):
        cfg = obj.configuracion
        token = cfg.get('access_token', '')
        expires = cfg.get('token_expires_at', '')
        if token and expires:
            return '✅ Válido' if token else '❌ Sin token'
        return '⚪ No autenticado'


@admin.register(Factura)
class FacturaAdmin(admin.ModelAdmin):
    list_display = ['numero', 'cliente', 'total', 'valor_pagado', 'saldo_pendiente', 'estado', 'fecha_emision', 'fecha_vencimiento']
    list_filter = ['estado', 'tipo_servicio', 'termino_pago']
    search_fields = ['numero', 'cliente__nombre', 'cliente__identificacion']
    inlines = [FacturaItemInline, PagoInline]


@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ['factura', 'fecha', 'valor', 'metodo', 'referencia']


@admin.register(Egreso)
class EgresoAdmin(admin.ModelAdmin):
    list_display = ['concepto', 'categoria', 'valor', 'fecha', 'beneficiario']
    list_filter = ['categoria']


@admin.register(NotaCreditoDebito)
class NotaCreditoDebitoAdmin(admin.ModelAdmin):
    list_display = ['factura', 'tipo', 'motivo', 'valor', 'fecha', 'anulada']
    list_filter = ['tipo', 'anulada']
