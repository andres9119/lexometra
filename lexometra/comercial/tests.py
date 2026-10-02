from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from procesos.models import Proceso, Servicio, EstadoProceso, AnticipoCuota, CambioEstado, CasoJuridico, Documento
from referidos.models import Referidor, Comision
from tesoreria.models import Factura

from .models import Cliente, Recaudo, ReporteNegativo, ESTADOS_SIN_SALDO
from .views import recalcular_anticipo_y_saldo

User = get_user_model()


class FlujoCompletoTest(TestCase):
    """Cubre los 18 requisitos del flujo comercial → jurídico → referidos → tesorería."""

    def setUp(self):
        self.admin = User.objects.create_user('admin', password='x', role='ADMIN', is_staff=True)
        self.comercial = User.objects.create_user('comercial', password='x', role='COMERCIAL')
        self.abogado = User.objects.create_user('abogado', password='x', role='ABOGADO', is_active=True)

        EstadoProceso.objects.get_or_create(nombre='NUEVO')
        EstadoProceso.objects.get_or_create(nombre='CONTRATO_FIRMADO')

        self.servicio = Servicio.objects.create(nombre='Eliminación de Reportes')

        self.referidor = Referidor.objects.create(
            nombre='Juan Referidor', cedula='12345', comision=Decimal('10.00'), estado='ACTIVO'
        )

        self.cliente = Cliente.objects.create(
            nombre='Cliente Prueba', identificacion='999999', telefono='3000000000',
            email='prueba@mail.com', comercial=self.comercial, referidor=self.referidor,
            canal_origen='REDES_SOCIALES',
        )
        self.cliente.refresh_from_db()

        self.proceso = Proceso.objects.create(
            cliente=self.cliente, servicio=self.servicio, tipo_servicio=self.servicio.nombre,
            estado_comercial='NUEVO', valor_expectativa_total=Decimal('1000000.00'),
            porcentaje_anticipo=Decimal('50.00'), cuotas_anticipo=2, cantidad_reportes=2,
        )

    # ── Req 15: id_comercial auto (AAAAMM###) y canal de origen ─────────────
    def test_cliente_genera_id_y_canal(self):
        self.assertRegex(self.cliente.id_comercial, r'^\d{6}\d{3}$')
        self.assertEqual(self.cliente.canal_origen, 'REDES_SOCIALES')

    # ── Req 7: valor pasado == expectativa (un único valor) ─────────────────
    def test_valor_pactado_sincronizado(self):
        self.proceso.refresh_from_db()
        self.assertEqual(self.proceso.valor_pactado, Decimal('1000000.00'))

    # ── Req 5: cronograma de cuotas del anticipo ───────────────────────────
    def test_anticipo_genera_cronograma(self):
        resumen = recalcular_anticipo_y_saldo(self.proceso)
        cuotas = list(AnticipoCuota.objects.filter(proceso=self.proceso).order_by('numero'))
        self.assertEqual(len(cuotas), 2)
        self.assertEqual(resumen['anticipo_total'], Decimal('500000.00'))
        self.assertEqual(cuotas[0].valor, Decimal('250000.00'))

    # ── Req 5: recaudo es_anticipo marca cuota pagada y recalcula saldo ────
    def test_recaudo_anticipo_marca_cuota_y_saldo(self):
        recalcular_anticipo_y_saldo(self.proceso)
        Recaudo.objects.create(
            cliente=self.cliente, concepto='Cuota 1 anticipo', valor=Decimal('250000.00'),
            fecha=date.today(), es_anticipo=True, registrado_por=self.comercial,
        )
        resumen = recalcular_anticipo_y_saldo(self.proceso)
        cuotas = list(AnticipoCuota.objects.filter(proceso=self.proceso).order_by('numero'))
        self.assertTrue(cuotas[0].pagada)
        self.assertFalse(cuotas[1].pagada)
        self.assertEqual(resumen['anticipo_pagado'], Decimal('250000.00'))
        self.assertEqual(resumen['saldo_pendiente'], Decimal('750000.00'))

    # ── Req (referidos): recaudo con referidor activo genera comisión ──────
    def test_recaudo_genera_comision_referidor(self):
        Recaudo.objects.create(
            cliente=self.cliente, concepto='Pago', valor=Decimal('1000000.00'),
            fecha=date.today(), registrado_por=self.comercial,
        )
        comision = Comision.objects.filter(cliente=self.cliente, referidor=self.referidor).first()
        self.assertIsNotNone(comision)
        self.assertEqual(comision.monto_base, Decimal('1000000.00'))
        self.assertEqual(comision.monto_comision, Decimal('100000.00'))

    # ── Req 12: estados sin saldo fuerzan saldo = 0 y gestión SALDADO ──────
    def test_reporte_estado_sin_saldo(self):
        rn = ReporteNegativo.objects.create(
            cliente=self.cliente, entidad='Banco X', numero_obligacion='001',
            obligation_status='PAGO_VOL_MX', saldo=Decimal('500000.00'), gestion='PENDIENTE',
        )
        self.assertEqual(rn.saldo, 0)
        self.assertEqual(rn.gestion, 'SALDADO')

    def test_reporte_con_mora_mantiene_saldo(self):
        rn = ReporteNegativo.objects.create(
            cliente=self.cliente, entidad='Banco Y', numero_obligacion='002',
            obligation_status='MORA', saldo=Decimal('300000.00'),
        )
        self.assertEqual(rn.saldo, Decimal('300000.00'))
        self.assertNotIn(rn.obligation_status, ESTADOS_SIN_SALDO)

    # ── Req 14: cambiar estado exige observación; Req 2: no volver a NUEVO ─
    def test_cambiar_estado_requiere_observacion(self):
        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/comercial/proceso/{self.proceso.pk}/estado/',
            {'estado': 'CONTRATO_FIRMADO'}, HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(resp.status_code, 400)
        self.client.force_login(self.admin)
        resp = self.client.post(
            f'/comercial/proceso/{self.proceso.pk}/estado/',
            {'estado': 'CONTRATO_FIRMADO', 'observacion': 'Firma de contrato'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(resp.status_code, 200)

    def test_no_se_puede_volver_a_nuevo(self):
        self.client.force_login(self.admin)
        self.client.post(
            f'/comercial/proceso/{self.proceso.pk}/estado/',
            {'estado': 'CONTRATO_FIRMADO', 'observacion': 'ok', 'fecha_contrato': '2026-06-01'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        resp = self.client.post(
            f'/comercial/proceso/{self.proceso.pk}/estado/',
            {'estado': 'NUEVO', 'observacion': 'intento'}, HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.assertEqual(resp.status_code, 400)

    # ── Req 3: CONTRATO_FIRMADO autocompleta fecha de contrato ─────────────
    # ── Req 16: y dispara la señal que auto-crea el CasoJurídico ───────────
    def test_contrato_firmado_fecha_y_caso_automatico(self):
        self.client.force_login(self.admin)
        self.client.post(
            f'/comercial/proceso/{self.proceso.pk}/estado/',
            {'estado': 'CONTRATO_FIRMADO', 'observacion': 'ok',
             'fecha_contrato': '2026-06-01'},
            HTTP_X_REQUESTED_WITH='XMLHttpRequest',
        )
        self.proceso.refresh_from_db()
        self.assertEqual(str(self.proceso.fecha_contrato), '2026-06-01')
        self.assertIsNotNone(CambioEstado.objects.filter(proceso=self.proceso).first())
        caso = CasoJuridico.objects.filter(proceso=self.proceso).first()
        self.assertIsNotNone(caso)
        self.assertEqual(caso.cliente, self.cliente)
        self.assertEqual(caso.abogado_asignado, self.abogado)

    # ── Req 8: generar factura BORRADOR (sin emitir a DIAN) ────────────────
    def test_generar_factura_borrador_cobro(self):
        # Se firma el contrato para que exista caso jurídico
        case_id = CasoJuridico.objects.create(
            proceso=self.proceso, cliente=self.cliente,
            tipo_proceso='ELIMINACION_REPORTES', titulo='CasoT',
            estado='ACTIVO', prioridad='MEDIA', abogado_asignado=self.abogado,
        ).pk
        self.client.force_login(self.admin)
        resp = self.client.post(f'/comercial/cliente/{self.cliente.pk}/facturar-cobro/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data['success'])
        fac = Factura.objects.get(pk=data['factura_id'])
        self.assertEqual(fac.estado, 'BORRADOR')
        self.assertEqual(fac.saldo_pendiente, Decimal('1000000.00'))
        self.assertEqual(fac.total, Decimal('1000000.00'))
        self.assertEqual(fac.caso_id, case_id)


class ContratoExpedienteValidationTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user('admin', password='x', role='ADMIN', is_staff=True)
        self.comercial = User.objects.create_user('comercial', password='x', role='COMERCIAL')
        self.servicio = Servicio.objects.create(nombre='Eliminación de Reportes')
        self.cliente = Cliente.objects.create(
            nombre='Cliente Contrato', identificacion='987654', telefono='3000001111',
            email='contrato@test.com', comercial=self.comercial, canal_origen='TELECOMERCIAL',
        )
        self.proceso = Proceso.objects.create(
            cliente=self.cliente,
            servicio=self.servicio,
            tipo_servicio=self.servicio.nombre,
            estado_comercial='NUEVO',
            valor_expectativa_total=Decimal('500000.00'),
            porcentaje_anticipo=Decimal('50.00'),
            cuotas_anticipo=2,
        )
        self.client.force_login(self.admin)

    def test_generar_contrato_requiere_proceso_firmado(self):
        response = self.client.get(f'/comercial/cliente/{self.cliente.pk}/contrato/')
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Documento.objects.filter(cliente=self.cliente).exists())

    def test_generar_contrato_crea_documento_en_expediente(self):
        self.proceso.estado_comercial = 'CONTRATO_FIRMADO'
        self.proceso.fecha_contrato = date.today()
        self.proceso.save(update_fields=['estado_comercial', 'fecha_contrato'])

        response = self.client.get(f'/comercial/cliente/{self.cliente.pk}/contrato/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Documento.objects.filter(cliente=self.cliente, nombre__icontains='contrato').exists())
