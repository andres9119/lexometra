from django.db import models
from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db.models import Count


class EstadoProceso(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)
    orden = models.IntegerField(default=0)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Estado Proceso'
        verbose_name_plural = 'Estados Proceso'
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre


class EstadoLegal(models.TextChoices):
    ACTIVO = 'ACTIVO', 'Activo'
    SUSPENDIDO = 'SUSPENDIDO', 'Suspendido'
    TERMINADO = 'TERMINADO', 'Terminado'
    ARCHIVADO = 'ARCHIVADO', 'Archivado'


class TipoServicio(models.TextChoices):
    ELIMINACION_REPORTES = 'ELIMINACION_REPORTES', 'Eliminación de Reportes'
    TUTELA = 'TUTELA', 'Tutela'
    SIC = 'SIC', 'SIC'
    CARTERA = 'CARTERA', 'Cartera'
    OTRO = 'OTRO', 'Otro'


class Servicio(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Servicio'
        verbose_name_plural = 'Servicios'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class TipoProcesoJuridico(models.TextChoices):
    TUTELA = 'TUTELA', 'Acción de Tutela'
    SIC = 'SIC', 'SIC'
    CARTERA = 'CARTERA', 'Cartera'
    ELIMINACION_REPORTES = 'ELIMINACION_REPORTES', 'Eliminación de Reportes'
    OTRO = 'OTRO', 'Otro'


class Prioridad(models.TextChoices):
    ALTA = 'ALTA', 'Alta'
    MEDIA = 'MEDIA', 'Media'
    BAJA = 'BAJA', 'Baja'


class Proceso(models.Model):
    ESTADO_LEGAL_CHOICES = EstadoLegal.choices

    radicado = models.CharField(max_length=100, unique=True, blank=True, null=True)
    nombre = models.CharField(max_length=300, blank=True, default='', verbose_name="Nombre / Título del proceso")
    tipo_servicio = models.CharField(max_length=100, default='OTRO')
    servicio = models.ForeignKey(
        Servicio, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='procesos',
    )
    estado_comercial = models.CharField(max_length=100, default='NUEVO')
    estado_legal = models.CharField(max_length=20, choices=ESTADO_LEGAL_CHOICES, default='ACTIVO')

    referidor = models.CharField(max_length=200, blank=True, verbose_name="Referidor / Canal de origen")

    cliente = models.ForeignKey(
        'comercial.Cliente',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='procesos',
    )
    colaborador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'role': 'COLABORADOR'},
        related_name='procesos_asignados',
    )

    clave_datacredito = models.CharField(max_length=100, blank=True)
    score_datacredito = models.IntegerField(null=True, blank=True)
    clave_transunion = models.CharField(max_length=100, blank=True)
    score_transunion = models.IntegerField(null=True, blank=True)

    # Req 7: "valor pactado" es el mismo campo que "expectativa". Se mantiene
    # valor_pactado en BD (para no romper contrato/datos existentes) pero queda
    # sincronizado a valor_expectativa_total. NO editar de forma independiente.
    valor_pactado = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name="Valor pactado (= expectativa)")
    saldo_pendiente = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    valor_expectativa_total = models.DecimalField(max_digits=14, decimal_places=2, default=0, verbose_name="Expectativa total (COP)")
    porcentaje_anticipo = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name="% Anticipo inicial")
    cantidad_reportes = models.IntegerField(default=0, verbose_name="Cantidad reportes a gestionar")
    cuotas_anticipo = models.IntegerField(default=1, verbose_name="Dividir anticipo en X cuotas")

    fecha_contrato = models.DateField(
        null=True, blank=True, verbose_name='Fecha de firma del contrato',
        help_text='Obligatoria cuando el estado comercial es CONTRATO_FIRMADO.',
    )

    departamento_competente = models.CharField(max_length=100, blank=True)
    ciudad_juzgado_competente = models.CharField(max_length=200, blank=True)

    juzgado = models.CharField(max_length=200, blank=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    observaciones = models.TextField(blank=True)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Req 7: mantener valor_pactado == valor_expectativa_total (un único valor).
        if self.valor_expectativa_total != self.valor_pactado:
            self.valor_pactado = self.valor_expectativa_total
        super().save(*args, **kwargs)

    @property
    def dias_restantes(self):
        """Días que faltan para la fecha_vencimiento. Negativo = vencido. None = sin fecha."""
        from django.utils import timezone
        if self.fecha_vencimiento:
            today = timezone.localdate()
            return (self.fecha_vencimiento - today).days
        return None

    @property
    def dias_ingreso(self):
        """Días desde el registro del cliente (legado)."""
        from django.utils import timezone
        if self.cliente and self.cliente.fecha_registro:
            delta = timezone.now() - self.cliente.fecha_registro
            return max(0, delta.days)
        return 0

    class Meta:
        verbose_name = 'Proceso'
        verbose_name_plural = 'Procesos'
        ordering = ['-fecha_creacion']

    @property
    def tipo_servicio_display(self):
        return self.servicio.nombre if self.servicio else self.tipo_servicio

    def __str__(self):
        return f"{self.tipo_servicio_display} - {self.cliente.nombre if self.cliente else 'Sin cliente'}"


class AnticipoCuota(models.Model):
    """Cronograma de cuotas del anticipo de un proceso (Req 5).

    El anticipo se divide en N cuotas; cada recaudo marcado como 'es_anticipo'
    va abonando a estas cuotas. Permite saber cuánto del anticipo se ha pagado
    y cuánto queda pendiente.
    """
    proceso = models.ForeignKey(
        Proceso, on_delete=models.CASCADE,
        related_name='anticipo_cuotas',
    )
    numero = models.PositiveIntegerField(verbose_name='N° de cuota')
    valor = models.DecimalField(max_digits=14, decimal_places=2, verbose_name='Valor de la cuota')
    fecha_vencimiento = models.DateField(null=True, blank=True)
    pagada = models.BooleanField(default=False)
    fecha_pago = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Cuota de anticipo'
        verbose_name_plural = 'Cuotas de anticipo'
        ordering = ['numero']

    def __str__(self):
        return f"Cuota {self.numero} — ${self.valor:,.0f} ({'Pagada' if self.pagada else 'Pendiente'})"


class CambioEstado(models.Model):
    """Auditoría de cambios de estado de un proceso (Req 13 y 14).

    Registra quién, desde qué estado, a cuál, con la observación obligatoria
    y la fecha. Alimenta el historial de actividades de la ficha.
    """
    proceso = models.ForeignKey(
        Proceso, on_delete=models.CASCADE,
        related_name='cambios_estado',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    estado_anterior = models.CharField(max_length=100, blank=True, default='')
    estado_nuevo = models.CharField(max_length=100)
    observacion = models.TextField(blank=True, default='')
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Cambio de estado'
        verbose_name_plural = 'Cambios de estado'
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.estado_anterior} → {self.estado_nuevo} ({self.fecha:%d/%m/%Y %H:%M})"


class Actuacion(models.Model):
    proceso = models.ForeignKey(Proceso, on_delete=models.CASCADE, related_name='actuaciones')
    fecha = models.DateField()
    descripcion = models.TextField()
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='actuaciones_registradas',
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Actuación'
        verbose_name_plural = 'Actuaciones'
        ordering = ['-fecha']

    def __str__(self):
        return f"Actuación {self.fecha} - Proceso {self.proceso.id}"


def get_least_loaded_lawyer():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.filter(
        role='ABOGADO', is_active=True
    ).annotate(
        num_casos=Count('casos_asignados')
    ).order_by('num_casos').first()


TIPO_SERVICIO_TO_TIPO_PROCESO = {
    'TUTELA': 'TUTELA',
    'SIC': 'SIC',
    'CARTERA': 'CARTERA',
    'ELIMINACION_REPORTES': 'ELIMINACION_REPORTES',
    'OTRO': 'OTRO',
}


class CasoJuridico(models.Model):
    proceso = models.ForeignKey(
        Proceso, on_delete=models.CASCADE,
        related_name='casos_juridicos',
    )
    cliente = models.ForeignKey(
        'comercial.Cliente',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='casos_juridicos',
    )
    abogado_asignado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'role': 'ABOGADO'},
        related_name='casos_asignados',
    )

    tipo_proceso = models.CharField(
        max_length=50, choices=TipoProcesoJuridico.choices,
        default='OTRO',
    )
    estado = models.CharField(
        max_length=20, choices=EstadoLegal.choices,
        default='ACTIVO',
    )
    titulo = models.CharField(max_length=255)
    radicado_externo = models.CharField(max_length=100, blank=True, null=True)
    prioridad = models.CharField(
        max_length=10, choices=Prioridad.choices,
        default='MEDIA',
    )
    demandante_accionante = models.CharField(max_length=255, blank=True, default='')
    demandado_accionado = models.CharField(max_length=255, blank=True, default='')
    juzgado_entidad = models.CharField(max_length=255, blank=True, default='')
    etapa_actual = models.CharField(max_length=100, blank=True, default='')
    fecha_inicio = models.DateField(null=True, blank=True)
    proximo_vencimiento = models.DateField(null=True, blank=True)
    descripcion_caso = models.TextField(blank=True, default='')
    notas_adicionales = models.TextField(blank=True, null=True)
    url_sharepoint = models.URLField(blank=True, null=True)
    contrato_autenticado_recibido = models.BooleanField(default=False)
    habilitado_modulo_juridico = models.BooleanField(default=False)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Caso Jurídico'
        verbose_name_plural = 'Casos Jurídicos'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.titulo} — {self.get_tipo_proceso_display()}"

    def save(self, *args, **kwargs):
        if not self.cliente_id and self.proceso_id and self.proceso.cliente_id:
            self.cliente = self.proceso.cliente
        super().save(*args, **kwargs)


class TipoProcesoInterno(models.TextChoices):
    TUTELA = 'TUTELA', 'Acción de Tutela'
    DERECHO_PETICION = 'DERECHO_PETICION', 'Derecho de Petición'
    DEMANDA = 'DEMANDA', 'Demanda'
    RECURSO = 'RECURSO', 'Recurso'
    CONCILIACION = 'CONCILIACION', 'Conciliación'
    PRUEBA = 'PRUEBA', 'Práctica de Prueba'
    NOTIFICACION = 'NOTIFICACION', 'Notificación'
    OTRO = 'OTRO', 'Otro'


class EstadoInterno(models.TextChoices):
    ACTIVO = 'ACTIVO', 'Activo'
    EN_PROCESO = 'EN_PROCESO', 'En Proceso'
    RESUELTO = 'RESUELTO', 'Resuelto'
    ARCHIVADO = 'ARCHIVADO', 'Archivado'
    APELACION = 'APELACION', 'En Apelación'


class ProcesoInterno(models.Model):
    caso = models.ForeignKey(
        CasoJuridico, on_delete=models.CASCADE,
        related_name='procesos_internos',
    )
    codigo_interno = models.CharField(max_length=30, unique=True, null=True, blank=True)
    tipo = models.CharField(
        max_length=30, choices=TipoProcesoInterno.choices,
        default='OTRO',
    )
    titulo = models.CharField(max_length=255)
    estado = models.CharField(
        max_length=20, choices=EstadoInterno.choices,
        default='ACTIVO',
    )
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    fecha_resolucion = models.DateField(null=True, blank=True)
    descripcion = models.TextField(blank=True, default='')
    resultado = models.TextField(blank=True, default='')
    abogado = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        limit_choices_to={'role': 'ABOGADO'},
        related_name='procesos_internos',
    )
    precio = models.DecimalField(max_digits=14, decimal_places=2, default=0, null=True, blank=True, help_text='Valor facturable de este proceso interno')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Proceso Interno'
        verbose_name_plural = 'Procesos Internos'
        ordering = ['-fecha_creacion']

    def save(self, *args, **kwargs):
        if not self.codigo_interno:
            from datetime import datetime
            prefix = datetime.now().strftime('PI-%Y%m')
            last = ProcesoInterno.objects.filter(codigo_interno__startswith=prefix).order_by('codigo_interno').last()
            if last and last.codigo_interno:
                try:
                    seq = int(last.codigo_interno[-4:]) + 1
                except (ValueError, IndexError):
                    seq = 1
            else:
                seq = 1
            self.codigo_interno = f"{prefix}-{seq:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.codigo_interno}] {self.get_tipo_display()} — {self.titulo}"


class ComplejidadEntidad(models.TextChoices):
    BAJA = 'BAJA', 'Baja'
    MEDIA_BAJA = 'MEDIA_BAJA', 'Media-Baja'
    MEDIA = 'MEDIA', 'Media'
    ALTA = 'ALTA', 'Alta'
    MUY_ALTA = 'MUY_ALTA', 'Muy Alta'


class Entidad(models.Model):
    razon_social = models.CharField(max_length=300)
    nit = models.CharField(max_length=50, unique=True)
    complejidad = models.CharField(
        max_length=20, choices=ComplejidadEntidad.choices,
        blank=True, default='',
    )
    emails = models.TextField(blank=True, help_text='Uno por linea')
    notas = models.TextField(blank=True)
    archivo = models.FileField(
        upload_to='entidades/',
        blank=True, null=True,
        verbose_name='Archivo adjunto',
        help_text='Doc, PDF, imagen u otro archivo asociado a la entidad.',
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Entidad'
        verbose_name_plural = 'Entidades'
        ordering = ['razon_social']

    def __str__(self):
        return self.razon_social


class Documento(models.Model):
    caso = models.ForeignKey(
        CasoJuridico, on_delete=models.CASCADE,
        null=True, blank=True, related_name='documentos',
    )
    proceso_interno = models.ForeignKey(
        ProcesoInterno, on_delete=models.CASCADE,
        null=True, blank=True, related_name='documentos',
    )
    proceso = models.ForeignKey(
        Proceso, on_delete=models.CASCADE,
        null=True, blank=True, related_name='documentos',
    )
    cliente = models.ForeignKey(
        'comercial.Cliente', on_delete=models.CASCADE,
        null=True, blank=True, related_name='documentos',
    )
    archivo = models.FileField(
        upload_to='documentos/%Y/%m/',
        validators=[FileExtensionValidator(
            allowed_extensions=['pdf', 'doc', 'docx', 'xls', 'xlsx',
                                'jpg', 'jpeg', 'png', 'gif', 'tiff',
                                'txt', 'csv', 'msg', 'eml',
                                'zip', 'rar', '7z'],
        )],
    )
    nombre = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default='')
    subido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    fecha_subida = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Documento'
        verbose_name_plural = 'Documentos'
        ordering = ['-fecha_subida']

    def __str__(self):
        return self.nombre
