from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from comercial.models import Recaudo, Cliente
from tesoreria.models import Pago
from .models import Comision, Referidor


def generar_comision_para_cliente(cliente, monto, fecha=None):
    if not cliente or not cliente.referidor_id:
        return
    referidor = cliente.referidor
    if referidor.estado != 'ACTIVO':
        return
    from decimal import Decimal
    monto = Decimal(str(monto))
    porcentaje = referidor.comision
    monto_comision = monto * (porcentaje / 100)
    if monto_comision <= 0:
        return
    # Deduplicación: evitar generar una comisión idéntica dos veces sobre el mismo cobro.
    ya_existe = Comision.objects.filter(
        referidor=referidor,
        cliente=cliente,
        monto_base=monto,
        fecha_generacion=fecha or timezone.localdate(),
    ).exists()
    if ya_existe:
        return
    Comision.objects.create(
        referidor=referidor,
        cliente=cliente,
        monto_base=monto,
        porcentaje=porcentaje,
        monto_comision=monto_comision,
        fecha_generacion=fecha or timezone.localdate(),
    )


@receiver(post_save, sender=Recaudo, dispatch_uid='referidos_recaudo_post_save')
def recaudo_post_save(sender, instance, created, **kwargs):
    if created:
        generar_comision_para_cliente(
            cliente=instance.cliente,
            monto=instance.valor,
            fecha=instance.fecha,
        )


@receiver(post_save, sender=Pago, dispatch_uid='referidos_pago_post_save')
def pago_post_save(sender, instance, created, **kwargs):
    if created and instance.factura.cliente_id:
        generar_comision_para_cliente(
            cliente=instance.factura.cliente,
            monto=instance.valor,
            fecha=instance.fecha,
        )
