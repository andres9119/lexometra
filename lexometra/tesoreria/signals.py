from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum

from .models import Factura, FacturaItem, Pago, NotaCreditoDebito

ESTADOS_CARTERA = ('EMITIDA', 'PAGO_PARCIAL', 'PENDIENTE', 'VENCIDA')


def _recalcular_totales(factura):
    """Recalcula subtotal, IVA, total y saldo de la factura desde sus ítems/pagos."""
    items = factura.items.all()
    subtotal = sum(i.subtotal for i in items)
    iva = sum(i.iva_valor for i in items)
    factura.subtotal = subtotal
    factura.iva = iva
    factura.total = subtotal + iva - factura.descuento
    # valor_pagado ya se mantiene desde Pago.save; saldo y estado los recalcula save()
    factura.save()


def _sync_proceso_saldo(proceso_id):
    """Mantiene Proceso.saldo_pendiente = suma del saldo de sus facturas en cartera."""
    if not proceso_id:
        return
    from procesos.models import Proceso
    total = Factura.objects.filter(
        proceso_id=proceso_id, estado__in=ESTADOS_CARTERA
    ).aggregate(s=Sum('saldo_pendiente'))['s'] or 0
    Proceso.objects.filter(pk=proceso_id).update(saldo_pendiente=total)


@receiver([post_save, post_delete], sender=FacturaItem, dispatch_uid='tesoreria_facturaitem_recalcular')
def facturaitem_recalcular_totales(sender, instance, **kwargs):
    _recalcular_totales(instance.factura)


@receiver(post_delete, sender=Pago, dispatch_uid='tesoreria_pago_post_delete')
def pago_post_delete_recalcular(sender, instance, **kwargs):
    factura = instance.factura
    total_pagado = factura.pagos.aggregate(total=Sum('valor'))['total'] or 0
    factura.valor_pagado = total_pagado
    factura.save()


@receiver(post_save, sender=Factura, dispatch_uid='tesoreria_factura_sync_proceso')
def factura_sync_proceso(sender, instance, **kwargs):
    if instance.proceso_id:
        _sync_proceso_saldo(instance.proceso_id)


@receiver([post_save, post_delete], sender=NotaCreditoDebito, dispatch_uid='tesoreria_nota_recalcular')
def nota_recalcular_saldo(sender, instance, **kwargs):
    factura = instance.factura
    factura.save()
