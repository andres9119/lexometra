from django.db import models
from django.conf import settings
from datetime import date, datetime

from referidos.models import Referidor


class PerfilEmpresa(models.Model):
    razon_social = models.CharField(max_length=255, default='Diego Andrés Viloria Carpintero')
    nit = models.CharField(max_length=50, default='1.005.512.876-1')
    tipo_documento = models.CharField(max_length=50, default='Cédula de Ciudadanía')
    representante_legal = models.CharField(max_length=255, default='Diego Andrés Viloria Carpintero')
    ciudad = models.CharField(max_length=200, default='Barranquilla')
    departamento = models.CharField(max_length=200, default='Atlántico')
    direccion = models.CharField(max_length=255, default='Calle 117 #42 - 56, Barranquilla (Atlántico)')
    telefono = models.CharField(max_length=50, default='3146159776')
    email = models.EmailField(default='Viloria542@gmail.com')
    banco = models.CharField(max_length=200, blank=True, default='')
    tipo_cuenta = models.CharField(max_length=50, blank=True, default='')
    numero_cuenta = models.CharField(max_length=100, blank=True, default='')
    logo = models.ImageField(upload_to='empresa/', blank=True)

    class Meta:
        verbose_name = 'Perfil de Empresa'
        verbose_name_plural = 'Perfiles de Empresa'

    def __str__(self):
        return self.razon_social

class CanalOrigen(models.TextChoices):
    REFERIDO = 'REFERIDO', 'Referido'
    REDES_SOCIALES = 'REDES_SOCIALES', 'Redes Sociales'
    WEB = 'WEB', 'Sitio Web'
    LLAMADA = 'LLAMADA', 'Llamada / Telefónico'
    PUBLICIDAD = 'PUBLICIDAD', 'Publicidad'
    CAMPAÑA = 'CAMPAÑA', 'Campaña'
    OTRO = 'OTRO', 'Otro'


class Cliente(models.Model):
    id_comercial = models.CharField(max_length=20, unique=True, blank=True)
    nombre = models.CharField(max_length=200, verbose_name="Nombre completo")
    identificacion = models.CharField(max_length=20, unique=True, verbose_name="Cédula")
    telefono = models.CharField(max_length=20, blank=True, verbose_name="Celular")
    email = models.EmailField(blank=True, verbose_name="Correo electrónico")

    # Origen del cliente (visual en ficha)
    canal_origen = models.CharField(
        max_length=30, choices=CanalOrigen.choices,
        blank=True, default='', verbose_name='Canal de origen',
        help_text='Origen del cliente (solo informativo en la ficha).',
    )
    fecha_contrato = models.DateField(
        null=True, blank=True, verbose_name='Fecha de firma del contrato',
        help_text='Obligatoria cuando el estado es CONTRATO_FIRMADO.',
    )
    
    # Domicilio
    departamento = models.CharField(max_length=100, blank=True)
    ciudad = models.CharField(max_length=100, blank=True, verbose_name="Ciudad / Municipio")
    direccion = models.CharField(max_length=200, blank=True)
    barrio = models.CharField(max_length=100, blank=True)
    vereda = models.CharField(max_length=100, blank=True, verbose_name="Vereda (zona rural)")
    
    # Condiciones Especiales
    es_victima_conflicto = models.BooleanField(default=False)
    es_indigena = models.BooleanField(default=False)
    es_adulto_mayor = models.BooleanField(default=False)
    es_afectacion_psicologica = models.BooleanField(default=False)
    es_madre_cabeza_familia = models.BooleanField(default=False)

    comercial = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'role': 'COMERCIAL'},
        related_name='clientes',
    )
    referidor = models.ForeignKey(
        Referidor,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='clientes_referidos',
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        ordering = ['-fecha_registro']

    def save(self, *args, **kwargs):
        if not self.id_comercial:
            today = datetime.now()
            prefix = today.strftime('%Y%m')
            
            # Buscar el último ID de este mes
            last_client = Cliente.objects.filter(id_comercial__startswith=prefix).order_by('id_comercial').last()
            
            if last_client and last_client.id_comercial:
                try:
                    sequence = int(last_client.id_comercial[-3:]) + 1
                except ValueError:
                    sequence = 1
            else:
                sequence = 1
                
            self.id_comercial = f"{prefix}{sequence:03d}"
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nombre} - {self.identificacion}"


class Recaudo(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='recaudos')
    concepto = models.CharField(max_length=300)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    fecha = models.DateField()
    es_anticipo = models.BooleanField(
        default=False, verbose_name='Abono a anticipo',
        help_text='Marcar si este recaudo corresponde a una cuota del anticipo pactado.',
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recaudos_registrados',
    )
    observaciones = models.TextField(blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Recaudo'
        verbose_name_plural = 'Recaudos'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.cliente.nombre} — ${self.valor:,.0f} ({self.fecha})"


class GestionReporte(models.TextChoices):
    PENDIENTE = 'PENDIENTE', 'Pendiente'
    GESTIONADO = 'GESTIONADO', 'Gestionado'
    ACUERDO = 'ACUERDO', 'Acuerdo de pago'
    ELIMINADO = 'ELIMINADO', 'Eliminado'
    ELIMINADO_EXITO = 'ELIMINADO_EXITO', 'Eliminado con éxito'
    INVIABLE = 'INVIABLE', 'Inviable'
    SALDADO = 'SALDADO', 'Saldado'


class EstadoObligacion(models.TextChoices):
    MORA = 'MORA', 'En mora'
    DUDOSO_RECAUDO = 'DUDOSO_RECAUDO', 'Dudoso recaudo'
    CARTERA_CASTIGADA = 'CARTERA_CASTIGADA', 'Cartera castigada'
    SALDADO = 'SALDADO', 'Saldado'
    INACTIVA = 'INACTIVA', 'Inactiva'
    CAN_MAL_MANEJO = 'CAN_MAL_MANEJO', 'Cancelada por mal manejo'
    PAGO_VOL = 'PAGO_VOL', 'Pago voluntario'
    PAGO_VOL_MX = 'PAGO_VOL_MX', 'Pago voluntario (máximo)'
    PAGO_JUR = 'PAGO_JUR', 'Pago jurídico'
    LIQ_PAT = 'LIQ_PAT', 'Liquidación patrimonial'
    CAN_PRESCR = 'CAN_PRESCR', 'Cancelada por prescripción'
    CAN_VOL = 'CAN_VOL', 'Cancelada voluntariamente'
    CAN_VOL_MM = 'CAN_VOL_MM', 'Cancelada voluntariamen. (mal manejo)'
    T_EXTRAVIADA = 'T_EXTRAVIADA', 'Tarjeta extraviada'
    NO_ENTREG = 'NO_ENTREG', 'No entregada'
    TARJETA_NO_RENOVADA = 'TARJETA_NO_RENOVADA', 'Tarjeta no renovada'
    T_ROBADA = 'T_ROBADA', 'Tarjeta robada'
    REESTRUCTURADA = 'REESTRUCTURADA', 'Reestructurada'
    REFINANCIADA = 'REFINANCIADA', 'Refinanciada'
    TRANSF_PRODUCTO = 'TRANSF_PRODUCTO', 'Transferencia de producto'
    NORMAL = 'NORMAL', 'Normal'
    COMPRADA = 'COMPRADA', 'Comprada'
    CANCELADA = 'CANCELADA', 'Cancelada'
    OTRO = 'OTRO', 'Otro'


# Estados que reflejan que el pago se hizo → no puede haber saldo pendiente.
ESTADOS_SIN_SALDO = (
    'SALDADO', 'PAGO_VOL', 'PAGO_VOL_MX', 'PAGO_JUR', 'LIQ_PAT',
    'CAN_PRESCR', 'CAN_VOL', 'CAN_VOL_MM', 'T_EXTRAVIADA', 'NO_ENTREG',
    'TARJETA_NO_RENOVADA', 'T_ROBADA', 'NORMAL', 'TRANSF_PRODUCTO',
    'CANCELADA', 'INACTIVA',
)


class ReporteNegativo(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='reportes_negativos')
    entidad = models.CharField(max_length=200, verbose_name="Entidad / Obligación")
    numero_obligacion = models.CharField(max_length=100, blank=True, verbose_name="No. Obligación")
    obligation_status = models.CharField(
        max_length=30, choices=EstadoObligacion.choices,
        default=EstadoObligacion.OTRO, verbose_name='Estado de la obligación',
    )
    estado_central = models.CharField(max_length=100, blank=True, verbose_name="Estado Central")
    gestion = models.CharField(max_length=50, choices=GestionReporte.choices, default='PENDIENTE')
    saldo = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    permiso_negativa_hasta = models.DateField(null=True, blank=True, verbose_name="Perm. Negativa hasta")
    notas = models.TextField(blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Reporte Negativo'
        verbose_name_plural = 'Reportes Negativos'
        ordering = ['-fecha_creacion']

    def save(self, *args, **kwargs):
        # Req 12: si el estado de la obligación indica que el pago se hizo,
        # no se permite dejar saldo pendiente.
        if self.obligation_status in ESTADOS_SIN_SALDO:
            self.saldo = 0
        if self.saldo <= 0 and self.obligation_status in ESTADOS_SIN_SALDO:
            if self.gestion == GestionReporte.PENDIENTE:
                self.gestion = GestionReporte.SALDADO
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.entidad} — ${self.saldo:,.0f}"


class Actividad(models.Model):
    """Registro manual de una novedad de un cliente (se une al historial)."""
    cliente = models.ForeignKey(
        Cliente, on_delete=models.CASCADE, related_name='actividades_manuales'
    )
    fecha = models.DateField(default=date.today, verbose_name='Fecha de la novedad')
    descripcion = models.TextField(verbose_name='Novedad / observación')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='actividades_manuales_registradas',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Actividad manual'
        verbose_name_plural = 'Actividades manuales'
        ordering = ['-fecha', '-fecha_creacion']

    def __str__(self):
        return f"{self.cliente.nombre} — {self.fecha} — {self.descripcion[:50]}"
