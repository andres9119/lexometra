from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Proceso, CasoJuridico, get_least_loaded_lawyer, TIPO_SERVICIO_TO_TIPO_PROCESO


@receiver(post_save, sender=Proceso, dispatch_uid='procesos_auto_crear_caso_juridico')
def auto_crear_caso_juridico(sender, instance, **kwargs):
    if instance.estado_comercial != 'CONTRATO_FIRMADO':
        return

    if instance.cliente_id is None:
        return

    already_exists = CasoJuridico.objects.filter(proceso=instance).exists()
    if already_exists:
        return

    tipo_servicio_val = instance.servicio.nombre if instance.servicio else instance.tipo_servicio
    tipo_proceso = TIPO_SERVICIO_TO_TIPO_PROCESO.get(
        tipo_servicio_val, 'OTRO'
    )

    CasoJuridico.objects.create(
        proceso=instance,
        cliente=instance.cliente,
        tipo_proceso=tipo_proceso,
        titulo=f"{instance.cliente.nombre} - {instance.tipo_servicio}",
        estado='ACTIVO',
        prioridad='MEDIA',
        abogado_asignado=get_least_loaded_lawyer(),
        demandante_accionante=instance.cliente.nombre,
        demandado_accionado='',
        juzgado_entidad=instance.juzgado,
        fecha_inicio=instance.fecha_inicio,
        proximo_vencimiento=instance.fecha_vencimiento,
        descripcion_caso=instance.observaciones,
        habilitado_modulo_juridico=True,
    )
