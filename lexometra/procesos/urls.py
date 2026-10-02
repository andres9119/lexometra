from django.urls import path
from . import views

urlpatterns = [
    path('procesos/', views.lista_casos_view, name='procesos_lista'),
    path('procesos/<int:pk>/', views.detalle_caso_view, name='procesos_detalle'),
    path('procesos/<int:pk>/editar/', views.editar_caso_view, name='procesos_editar_caso'),
    path('procesos/cliente/<int:cliente_pk>/nuevo/', views.crear_caso_juridico, name='procesos_crear_caso'),
    path('procesos/<int:caso_pk>/interno/nuevo/', views.crear_proceso_interno, name='procesos_crear_interno'),
    path('servicios/proceso/<int:proceso_pk>/nuevo/', views.crear_servicio_desde_proceso, name='procesos_crear_servicio'),
    path('servicios/proceso/<int:proceso_pk>/listos/', views.servicios_listos_para_facturar, name='procesos_servicios_listos'),
    path('procesos/interno/<int:pk>/estado/', views.cambiar_estado_interno, name='procesos_cambiar_estado_interno'),
    path('procesos/documento/subir/', views.subir_documento, name='procesos_subir_documento'),
    path('procesos/documento/<int:pk>/eliminar/', views.eliminar_documento, name='procesos_eliminar_documento'),
    path('calendario/', views.calendario_view, name='calendario'),
    path('entidades/', views.directorio_entidades, name='directorio_entidades'),
    path('entidades/crear/', views.crear_entidad, name='crear_entidad'),
    path('entidades/<int:pk>/editar/', views.editar_entidad, name='editar_entidad'),
    path('entidades/<int:pk>/eliminar/', views.eliminar_entidad, name='eliminar_entidad'),
    path('procesos-internos/', views.lista_procesos_internos, name='lista_procesos_internos'),
    path('procesos-internos/<int:pk>/', views.detalle_proceso_interno, name='detalle_proceso_interno'),
    path('procesos-internos/<int:pk>/editar/', views.editar_proceso_interno, name='editar_proceso_interno'),
    path('reasignar-abogados/', views.reasignacion_abogados, name='reasignacion_abogados'),
]
