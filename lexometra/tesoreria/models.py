from django.db import models
from django.conf import settings
from datetime import date
from decimal import Decimal


class ProveedorFacturacion(models.Model):
    nombre = models.CharField(max_length=100)
    activo = models.BooleanField(default=False)
    api_url = models.URLField(blank=True, default='')
    api_key = models.CharField(max_length=255, blank=True, default='')
    configuracion = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Proveedor de facturación'
        verbose_name_plural = 'Proveedores de facturación'

    def __str__(self):
        return self.nombre


class Factura(models.Model):

    class Estados(models.TextChoices):
        BORRADOR = 'BORRADOR', 'Borrador'
        PENDIENTE = 'PENDIENTE', 'Pendiente DIAN'
        EMITIDA = 'EMITIDA', 'Emitida'
        RECHAZADA = 'RECHAZADA', 'Rechazada DIAN'
        PAGO_PARCIAL = 'PAGO_PARCIAL', 'Pago Parcial'
        PAGADA = 'PAGADA', 'Pagada'
        VENCIDA = 'VENCIDA', 'Vencida'
        ANULADA = 'ANULADA', 'Anulada'

    class TerminoPago(models.TextChoices):
        CONTADO = 'CONTADO', 'Contado'
        D15 = '15_DIAS', '15 Días'
        D30 = '30_DIAS', '30 Días'
        D45 = '45_DIAS', '45 Días'
        D60 = '60_DIAS', '60 Días'

    # Estados en los que una factura "bloquea" un proceso interno (no debe re-facturarse).
    # Una factura ANULADA libera el proceso interno para poder facturarlo de nuevo.
    ESTADOS_ACTIVOS = (
        'BORRADOR', 'PENDIENTE', 'EMITIDA', 'RECHAZADA',
        'PAGO_PARCIAL', 'PAGADA', 'VENCIDA',
    )

    numero = models.CharField(max_length=20, unique=True)
    cliente = models.ForeignKey(
        'comercial.Cliente', on_delete=models.PROTECT,
        related_name='facturas',
    )
    proceso = models.ForeignKey(
        'procesos.Proceso', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='facturas',
    )
    caso = models.ForeignKey(
        'procesos.CasoJuridico', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='facturas',
    )
    concepto = models.CharField(max_length=500)
    tipo_servicio = models.CharField(max_length=50, blank=True, default='')

    fecha_emision = models.DateField(default=date.today)
    fecha_vencimiento = models.DateField()
    termino_pago = models.CharField(
        max_length=20, choices=TerminoPago.choices, default=TerminoPago.CONTADO,
    )

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_pagado = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    saldo_pendiente = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    estado = models.CharField(
        max_length=20, choices=Estados.choices, default=Estados.BORRADOR,
    )
    notas_internas = models.TextField(blank=True, default='')

    numero_factus = models.CharField(max_length=30, blank=True, default='')
    cufe = models.CharField(max_length=200, blank=True, default='')
    cuds = models.CharField(max_length=200, blank=True, default='')
    xml_generado = models.TextField(blank=True, default='')
    respuesta_dian = models.TextField(blank=True, default='')
    codigo_qr = models.TextField(blank=True, default='')
    fecha_validacion_dian = models.DateTimeField(null=True, blank=True)
    proveedor_facturacion = models.ForeignKey(
        ProveedorFacturacion, on_delete=models.SET_NULL,
        null=True, blank=True,
    )

    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering = ['-fecha_emision']

    def save(self, *args, **kwargs):
        if self.proceso_id and self.estado in self.ESTADOS_ACTIVOS:
            qs = Factura.objects.filter(proceso_id=self.proceso_id, cliente_id=self.cliente_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.filter(estado__in=self.ESTADOS_ACTIVOS).exists():
                raise ValueError('Ya existe una factura activa para este proceso.')

        if not self.numero:
            today = date.today()
            prefix = f'FAC-{today.year}{today.month:02d}'
            last = Factura.objects.filter(numero__startswith=prefix).order_by('numero').last()
            if last:
                try:
                    seq = int(last.numero.split('-')[-1]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.numero = f'{prefix}-{seq:04d}'

        self.saldo_pendiente = self.total - self.valor_pagado
        # Las notas crédito reducen el saldo; las notas débito lo incrementan.
        credito = 0
        debito = 0
        if self.pk:
            aggr = NotaCreditoDebito.objects.filter(factura_id=self.pk).aggregate(
                credito=models.Sum('valor', filter=models.Q(tipo='CREDITO', anulada=False)),
                debito=models.Sum('valor', filter=models.Q(tipo='DEBITO', anulada=False)),
            )
            credito = aggr['credito'] or 0
            debito = aggr['debito'] or 0
        self.saldo_pendiente += debito - credito
        if self.saldo_pendiente < 0:
            self.saldo_pendiente = 0
        # Estados terminales: nunca se sobrescriben por el recálculo automático.
        estados_inmutables = (self.Estados.ANULADA, self.Estados.RECHAZADA)
        if self.estado not in estados_inmutables:
            if self.total > 0 and self.saldo_pendiente <= 0:
                self.estado = self.Estados.PAGADA
            elif self.fecha_vencimiento and date.today() > self.fecha_vencimiento:
                self.estado = self.Estados.VENCIDA
            elif self.valor_pagado > 0:
                self.estado = self.Estados.PAGO_PARCIAL
            elif self.estado in (self.Estados.PAGADA, self.Estados.PAGO_PARCIAL):
                # Si se eliminó un pago y quedó sin abonos, vuelve a un estado no derivado.
                self.estado = self.Estados.PENDIENTE

        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.numero} — {self.cliente.nombre}'


class FacturaItem(models.Model):
    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='items',
    )
    proceso_interno = models.ForeignKey(
        'procesos.ProcesoInterno', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='items_factura',
    )
    descripcion = models.CharField(max_length=300)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    valor_unitario = models.DecimalField(max_digits=14, decimal_places=2)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    iva_porcentaje = models.DecimalField(max_digits=5, decimal_places=2, default=19.00, help_text='Porcentaje de IVA aplicado (0 = exento)')
    iva_valor = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Ítem de factura'
        verbose_name_plural = 'Ítems de factura'

    def save(self, *args, **kwargs):
        self.subtotal = self.cantidad * self.valor_unitario
        iva_pct = Decimal(str(self.iva_porcentaje))
        self.iva_valor = self.subtotal * (iva_pct / Decimal('100'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.descripcion} — ${self.subtotal:,.0f}'


class Pago(models.Model):

    class MetodoPago(models.TextChoices):
        EFECTIVO = 'EFECTIVO', 'Efectivo'
        TRANSFERENCIA = 'TRANSFERENCIA', 'Transferencia bancaria'
        PSE = 'PSE', 'PSE'
        CONSIGNACION = 'CONSIGNACION', 'Consignación'
        TARJETA = 'TARJETA', 'Tarjeta'

    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='pagos',
    )
    fecha = models.DateField(default=date.today)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    metodo = models.CharField(
        max_length=20, choices=MetodoPago.choices, default=MetodoPago.TRANSFERENCIA,
    )
    referencia = models.CharField(max_length=100, blank=True, default='')
    observaciones = models.TextField(blank=True, default='')
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Pago'
        verbose_name_plural = 'Pagos'
        ordering = ['-fecha']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        factura = self.factura
        total_pagado = factura.pagos.aggregate(
            total=models.Sum('valor')
        )['total'] or 0
        factura.valor_pagado = total_pagado
        factura.save()

    def __str__(self):
        return f'${self.valor:,.0f} — {self.factura.numero} ({self.get_metodo_display()})'


class Egreso(models.Model):

    class Categoria(models.TextChoices):
        NOMINA = 'NOMINA', 'Nómina'
        PROVEEDORES = 'PROVEEDORES', 'Proveedores'
        SERVICIOS = 'SERVICIOS', 'Servicios'
        GASTOS_ADMIN = 'GASTOS_ADMIN', 'Gastos administrativos'
        OTRO = 'OTRO', 'Otro'

    concepto = models.CharField(max_length=300)
    categoria = models.CharField(
        max_length=20, choices=Categoria.choices, default=Categoria.OTRO,
    )
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    fecha = models.DateField(default=date.today)
    beneficiario = models.CharField(max_length=200, blank=True, default='')
    observaciones = models.TextField(blank=True, default='')
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Egreso'
        verbose_name_plural = 'Egresos'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.concepto} — ${self.valor:,.0f}'


class NotaCreditoDebito(models.Model):

    class Tipo(models.TextChoices):
        CREDITO = 'CREDITO', 'Nota Crédito'
        DEBITO = 'DEBITO', 'Nota Débito'

    factura = models.ForeignKey(
        Factura, on_delete=models.CASCADE,
        related_name='notas',
    )
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    motivo = models.CharField(max_length=300)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    fecha = models.DateField(default=date.today)
    anulada = models.BooleanField(default=False)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nota Crédito/Débito'
        verbose_name_plural = 'Notas Crédito/Débito'
        ordering = ['-fecha']

    def __str__(self):
        return f'{self.get_tipo_display()} — {self.factura.numero} (${self.valor:,.0f})'
