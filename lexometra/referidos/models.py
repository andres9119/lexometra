from django.db import models
from django.conf import settings


class Comision(models.Model):
    referidor = models.ForeignKey(
        'Referidor', on_delete=models.CASCADE,
        related_name='comisiones',
    )
    cliente = models.ForeignKey(
        'comercial.Cliente', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='comisiones',
    )
    monto_base = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Monto del pago")
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, verbose_name="% comisión aplicado")
    monto_comision = models.DecimalField(max_digits=14, decimal_places=2, verbose_name="Comisión generada")
    pagada = models.BooleanField(default=False)
    fecha_generacion = models.DateField(auto_now_add=True)
    fecha_pago = models.DateField(null=True, blank=True)
    nota = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = 'Comisión'
        verbose_name_plural = 'Comisiones'
        ordering = ['-fecha_generacion']

    def __str__(self):
        return f"{self.referidor.nombre} — ${self.monto_comision:,.0f} ({'Pagada' if self.pagada else 'Pendiente'})"


class Referidor(models.Model):
    TIPO_CUENTA_CHOICES = [
        ('AHORROS', 'Ahorros'),
        ('CORRIENTE', 'Corriente'),
    ]
    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo'),
    ]

    nombre = models.CharField(max_length=200)
    cedula = models.CharField(max_length=20, unique=True)
    telefono = models.CharField(max_length=20, blank=True, default='')
    correo = models.EmailField(blank=True, default='')
    comision = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    banco = models.CharField(max_length=100, blank=True, default='')
    numero_cuenta = models.CharField(max_length=50, blank=True, default='')
    tipo_cuenta = models.CharField(
        max_length=10, choices=TIPO_CUENTA_CHOICES, default='AHORROS'
    )
    estado = models.CharField(
        max_length=10, choices=ESTADO_CHOICES, default='ACTIVO'
    )
    notas = models.TextField(blank=True, default='')
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Referidor'
        verbose_name_plural = 'Referidores'
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f'{self.nombre} ({self.cedula})'
