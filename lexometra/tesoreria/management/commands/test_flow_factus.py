from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = "Flujo completo de prueba: cliente → proceso → recaudo → factura → Factus"

    def handle(self, *args, **options):
        proveedor = self._get_proveedor()
        admin = self._get_or_create_admin()
        comercial = self._get_or_create_comercial()
        abogado = self._get_or_create_abogado()
        referidor = self._get_or_create_referidor()
        cliente = self._create_cliente(comercial, referidor)
        proceso = self._create_proceso(cliente)
        caso = self._create_caso_juridico(proceso, cliente, abogado)
        recaudo = self._create_recaudo(cliente, admin)
        factura = self._create_factura(cliente, proveedor, admin)
        self._create_factura_items(factura)
        pago = self._create_pago(factura, admin)

        self.stdout.write(self.style.SUCCESS("\n=== FLUJO COMPLETO CREADO CON ÉXITO ==="))
        self.stdout.write(f"  Cliente:     {cliente.nombre} (ID: {cliente.id_comercial})")
        self.stdout.write(f"  Proceso:     #{proceso.pk} — {proceso.tipo_servicio}")
        self.stdout.write(f"  CasoJuridico: #{caso.pk} — {caso.titulo} (abogado: {abogado.get_full_name()})")
        self.stdout.write(f"  Recaudo:     ${recaudo.valor:.0f} — {recaudo.concepto}")
        self.stdout.write(f"  Factura:     {factura.numero} — ${factura.total:.0f}")
        self.stdout.write(f"  Pago:        ${pago.valor:.0f} ({pago.get_metodo_display()})")

        self.stdout.write("\n--- Emitiendo factura a Factus sandbox ---")
        from tesoreria.services.factus import emitir_factura
        resultado = emitir_factura(factura)

        if resultado["success"]:
            self.stdout.write(self.style.SUCCESS(f"  Factura emitida: CUFE={resultado['cufe']}"))
            self.stdout.write(f"  Numero Factus: {resultado['numero_factus']}")
            self.stdout.write(f"  Validada: {resultado['validated']}")
        else:
            self.stdout.write(self.style.ERROR(f"  Error: {resultado['error']}"))
            data = resultado.get("data", {})
            if data:
                import json
                self.stdout.write(f"  Respuesta: {json.dumps(data, indent=2, ensure_ascii=False)[:3000]}")

    # ── helpers ────────────────────────────────────────────────

    def _get_proveedor(self):
        from tesoreria.models import ProveedorFacturacion
        p = ProveedorFacturacion.objects.filter(activo=True).first()
        if not p:
            self.stdout.write(self.style.ERROR("No hay ProveedorFacturacion activo. Ejecuta: python manage.py setup_factus"))
            raise SystemExit(1)
        return p

    def _get_or_create_admin(self):
        user, _ = User.objects.get_or_create(
            username="admin_test",
            defaults={
                "email": "admin_test@lexometra.co",
                "first_name": "Admin",
                "last_name": "Prueba",
                "role": "ADMIN",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if _:
            user.set_password("test1234")
            user.save()
        return user

    def _get_or_create_comercial(self):
        user, _ = User.objects.get_or_create(
            username="comercial_test",
            defaults={
                "email": "comercial_test@lexometra.co",
                "first_name": "Comercial",
                "last_name": "Prueba",
                "role": "COMERCIAL",
            },
        )
        if _:
            user.set_password("test1234")
            user.save()
        return user

    def _get_or_create_abogado(self):
        user, _ = User.objects.get_or_create(
            username="abogado_test",
            defaults={
                "email": "abogado_test@lexometra.co",
                "first_name": "Abogado",
                "last_name": "Prueba",
                "role": "ABOGADO",
            },
        )
        if _:
            user.set_password("test1234")
            user.save()
        return user

    def _get_or_create_referidor(self):
        from referidos.models import Referidor
        ref, _ = Referidor.objects.get_or_create(
            cedula="9999999999",
            defaults={
                "nombre": "Referidor Prueba",
                "telefono": "3000000000",
                "comision": Decimal("5.00"),
            },
        )
        return ref

    def _create_cliente(self, comercial, referidor):
        from comercial.models import Cliente
        cliente, _ = Cliente.objects.get_or_create(
            identificacion="1122334455",
            defaults={
                "nombre": "Cliente Test Factus",
                "telefono": "3101112233",
                "email": "cliente_test@email.co",
                "direccion": "Calle 123 #45-67",
                "ciudad": "Medellín",
                "departamento": "Antioquia",
                "comercial": comercial,
                "referidor": referidor,
                "observaciones": "Creado por script de prueba Factus",
            },
        )
        return cliente

    def _create_proceso(self, cliente):
        from procesos.models import Proceso
        proc = Proceso.objects.create(
            cliente=cliente,
            tipo_servicio="TUTELA",
            estado_comercial="NUEVO",
            valor_pactado=Decimal("1500000.00"),
            saldo_pendiente=Decimal("1500000.00"),
            valor_expectativa_total=Decimal("2000000.00"),
            observaciones="Proceso de prueba para facturación Factus",
        )
        return proc

    def _create_caso_juridico(self, proceso, cliente, abogado):
        from procesos.models import CasoJuridico
        caso = CasoJuridico.objects.create(
            proceso=proceso,
            cliente=cliente,
            abogado_asignado=abogado,
            tipo_proceso="TUTELA",
            titulo=f"Tutela {cliente.nombre} — Prueba Factus",
            descripcion_caso="Caso jurídico de prueba para integración Factus",
            prioridad="MEDIA",
        )
        return caso

    def _create_recaudo(self, cliente, admin):
        from comercial.models import Recaudo
        rec = Recaudo.objects.create(
            cliente=cliente,
            concepto="Honorarios iniciales — Prueba Factus",
            valor=Decimal("1500000.00"),
            fecha=date.today(),
            registrado_por=admin,
            observaciones="Recaudo generado por script de prueba",
        )
        return rec

    def _create_factura(self, cliente, proveedor, admin):
        from tesoreria.models import Factura
        factura = Factura(
            cliente=cliente,
            concepto="Honorarios profesionales — Prueba Factus",
            tipo_servicio="TUTELA",
            fecha_emision=date.today(),
            fecha_vencimiento=date.today() + timedelta(days=30),
            termino_pago="30_DIAS",
            subtotal=Decimal("150000.00"),
            iva=Decimal("28500.00"),
            total=Decimal("178500.00"),
            proveedor_facturacion=proveedor,
            creado_por=admin,
            notas_internas="Factura de prueba para integración Factus sandbox",
        )
        factura.save()
        return factura

    def _create_factura_items(self, factura):
        from tesoreria.models import FacturaItem
        FacturaItem.objects.create(
            factura=factura,
            descripcion="Honorarios profesionales — Tutela",
            cantidad=1,
            valor_unitario=Decimal("150000.00"),
        )

    def _create_pago(self, factura, admin):
        from tesoreria.models import Pago
        pago = Pago.objects.create(
            factura=factura,
            fecha=date.today(),
            valor=Decimal("150000.00"),
            metodo="TRANSFERENCIA",
            referencia="PAGO-TEST-001",
            registrado_por=admin,
            observaciones="Pago de prueba — simulación",
        )
        return pago
