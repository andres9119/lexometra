from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.contrib.auth import get_user_model

from comercial.models import Cliente
from procesos.models import Proceso, Servicio
from tesoreria.models import Factura

User = get_user_model()


class FacturaValidationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('admin', password='x', role='ADMIN', is_staff=True)
        self.comercial = User.objects.create_user('comercial', password='x', role='COMERCIAL')
        self.servicio = Servicio.objects.create(nombre='Eliminación de Reportes')
        self.cliente = Cliente.objects.create(
            nombre='Cliente Factura', identificacion='654321', telefono='3007654321',
            email='factura@test.com', comercial=self.comercial, canal_origen='TELECOMERCIAL',
        )
        self.proceso = Proceso.objects.create(
            cliente=self.cliente,
            servicio=self.servicio,
            tipo_servicio=self.servicio.nombre,
            estado_comercial='CONTRATO_FIRMADO',
            valor_expectativa_total=Decimal('1000000.00'),
            porcentaje_anticipo=Decimal('50.00'),
            cuotas_anticipo=2,
            fecha_contrato=date.today(),
        )

    def test_no_permite_facturas_activas_dobles_para_un_proceso(self):
        Factura.objects.create(
            cliente=self.cliente,
            proceso=self.proceso,
            concepto='Factura 1',
            tipo_servicio='ELIMINACION_REPORTES',
            fecha_vencimiento=date.today(),
            total=Decimal('1000000.00'),
            subtotal=Decimal('1000000.00'),
            iva=Decimal('0.00'),
            estado='BORRADOR',
            creado_por=self.user,
            numero='FAC-202601-0001',
        )

        with self.assertRaises(ValueError):
            Factura.objects.create(
                cliente=self.cliente,
                proceso=self.proceso,
                concepto='Factura 2',
                tipo_servicio='ELIMINACION_REPORTES',
                fecha_vencimiento=date.today(),
                total=Decimal('1000000.00'),
                subtotal=Decimal('1000000.00'),
                iva=Decimal('0.00'),
                estado='BORRADOR',
                creado_por=self.user,
                numero='FAC-202601-0002',
            )
