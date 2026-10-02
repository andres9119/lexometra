from django.urls import path
from . import views

urlpatterns = [
    path('referidos/', views.panel_referidos_view, name='panel_referidos'),
    path('referidos/nuevo/', views.crear_referidor_view, name='crear_referidor'),
    path('referidos/comisiones/', views.comisiones_view, name='comisiones_view'),
    path('referidos/comisiones/<int:pk>/pagar/', views.marcar_comision_pagada, name='marcar_comision_pagada'),
    path('referidos/<int:pk>/nuevo-cliente/', views.nuevo_cliente_referido, name='nuevo_cliente_referido'),
    path('registro/', views.registro_referido_publico, name='registro_referido'),
]
