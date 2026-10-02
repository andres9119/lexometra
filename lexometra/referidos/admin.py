from django.contrib import admin
from .models import Referidor


@admin.register(Referidor)
class ReferidorAdmin(admin.ModelAdmin):
    list_display = ['nombre', 'cedula', 'estado', 'comision', 'telefono', 'fecha_creacion']
    list_filter = ['estado', 'tipo_cuenta']
    search_fields = ['nombre', 'cedula', 'telefono', 'correo']
