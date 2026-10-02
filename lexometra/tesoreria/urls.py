from django.urls import path
from . import views

urlpatterns = [
    path('tesoreria/', views.panel_facturacion_view, name='tesoreria_panel'),
    path('tesoreria/cartera/', views.cartera_view, name='tesoreria_cartera'),
    path('tesoreria/tesoreria/', views.tesoreria_view, name='tesoreria_tesoreria'),
    path('tesoreria/reportes/', views.reportes_view, name='tesoreria_reportes'),
    path('tesoreria/notas/', views.notas_view, name='tesoreria_notas'),
    path('tesoreria/factura/nueva/', views.crear_factura_view, name='tesoreria_crear_factura'),
    path('tesoreria/factura/<int:pk>/', views.detalle_factura_view, name='tesoreria_detalle'),
    path('tesoreria/factura/<int:pk>/editar/', views.editar_factura_view, name='tesoreria_editar'),
    path('tesoreria/factura/<int:pk>/anular/', views.anular_factura_view, name='tesoreria_anular'),
    path('tesoreria/factura/<int:pk>/emitir/', views.emitir_factura_view, name='tesoreria_emitir'),
    path('tesoreria/factura/<int:pk>/consultar-dian/', views.consultar_estado_dian_view, name='tesoreria_consultar_dian'),
    path('tesoreria/factura/<int:pk>/xml/', views.descargar_xml_factus_view, name='tesoreria_descargar_xml'),
    path('tesoreria/factura/<int:pk>/pdf-dian/', views.descargar_pdf_factus_view, name='tesoreria_descargar_pdf'),
    path('tesoreria/factura/<int:pk>/eliminar-factus/', views.eliminar_en_factus_view, name='tesoreria_eliminar_factus'),
    path('tesoreria/factus/', views.listar_factus_view, name='tesoreria_factus_list'),
    path('tesoreria/factura/<int:pk>/pdf/', views.exportar_pdf_view, name='tesoreria_pdf'),
    path('tesoreria/factura/<int:factura_pk>/pago/', views.registrar_pago_view, name='tesoreria_registrar_pago'),
    path('tesoreria/egreso/nuevo/', views.crear_egreso_view, name='tesoreria_crear_egreso'),
    path('tesoreria/nota/nueva/', views.crear_nota_view, name='tesoreria_crear_nota'),
    path('tesoreria/api/clientes/', views.json_clientes_view, name='tesoreria_api_clientes'),
    path('tesoreria/api/procesos/', views.json_procesos_view, name='tesoreria_api_procesos'),
    path('tesoreria/api/casos/', views.json_casos_view, name='tesoreria_api_casos'),
    path('tesoreria/generar-desde-pi/', views.generar_borrador_desde_pi_view, name='tesoreria_generar_pi'),
]
