from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Crea datos de prueba completos para todo el sistema'

    def handle(self, *args, **options):
        today = date.today()

        # ── USUARIOS ──────────────────────────────────────────────────────────
        admin, created = User.objects.get_or_create(
            username='admin', defaults={'role': 'ADMIN', 'is_staff': True, 'is_superuser': True,
                                         'first_name': 'Diego Andrés', 'last_name': 'Viloria Carpintero'})
        if created:
            admin.set_password('admin')
            admin.save()

        comercial, _ = User.objects.get_or_create(
            username='comercial1', defaults={'role': 'COMERCIAL'})
        comercial.set_password('comercial1')
        comercial.first_name = 'Carlos'
        comercial.last_name = 'Mendoza'
        comercial.save()

        comercial2, _ = User.objects.get_or_create(
            username='comercial2', defaults={'role': 'COMERCIAL'})
        comercial2.set_password('comercial2')
        comercial2.first_name = 'María'
        comercial2.last_name = 'González'
        comercial2.save()

        abo1, _ = User.objects.get_or_create(
            username='abogado1', defaults={'role': 'ABOGADO'})
        abo1.set_password('abogado1')
        abo1.first_name = 'Laura'
        abo1.last_name = 'Peñaranda'
        abo1.save()

        abo2, _ = User.objects.get_or_create(
            username='abogado2', defaults={'role': 'ABOGADO'})
        abo2.set_password('abogado2')
        abo2.first_name = 'Andrés'
        abo2.last_name = 'Quintero'
        abo2.save()

        abo3, _ = User.objects.get_or_create(
            username='abogado3', defaults={'role': 'ABOGADO'})
        abo3.set_password('abogado3')
        abo3.first_name = 'Carmen'
        abo3.last_name = 'Restrepo'
        abo3.save()

        colab, _ = User.objects.get_or_create(
            username='colaborador1', defaults={'role': 'COLABORADOR'})
        colab.set_password('colaborador1')
        colab.first_name = 'Pedro'
        colab.last_name = 'López'
        colab.save()

        self.stdout.write(self.style.SUCCESS(f'Usuarios: {User.objects.count()}'))

        # ── REFERIDORES ──────────────────────────────────────────────────────
        from referidos.models import Referidor
        ref_data = [
            ('Ricardo Díaz', '1002003001', '3001112233', 'rdiaz@mail.com', Decimal('10.00')),
            ('Ana María Torres', '1002003002', '3004445566', 'atorres@mail.com', Decimal('7.50')),
            ('Felipe Rojas', '1002003003', '3007778899', 'frojas@mail.com', Decimal('12.00')),
        ]
        for nombre, cedula, tel, correo, comision in ref_data:
            Referidor.objects.get_or_create(
                cedula=cedula,
                defaults=dict(nombre=nombre, telefono=tel, correo=correo, comision=comision))
        self.stdout.write(self.style.SUCCESS(f'Referidores: {Referidor.objects.count()}'))

        # ── ENTIDADES (ya hay 7 seed, crear 3 más si no existen) ────────────
        from procesos.models import Entidad
        extra_entidades = [
            ('Bancolombia S.A.', '890903938-8', 'MUY_ALTA',
             'notificaciones@bancolombia.com\nsolicitudes@bancolombia.com', ''),
            ('Colpatria S.A.', '860012678-1', 'ALTA',
             'juridico@colpatria.com', 'Exige carta de eliminación'),
            ('Financiera Juriscoop', '900123456-7', 'MEDIA',
             'info@juriscoop.com', 'Responde en 15 días hábiles'),
        ]
        for razon, nit, comp, emails, notas in extra_entidades:
            Entidad.objects.get_or_create(nit=nit, defaults=dict(
                razon_social=razon, complejidad=comp, emails=emails, notas=notas))
        self.stdout.write(self.style.SUCCESS(f'Entidades: {Entidad.objects.count()}'))

        # ── CLIENTES ─────────────────────────────────────────────────────────
        from comercial.models import Cliente, ReporteNegativo
        comerciales = [comercial, comercial2]
        referidores = list(Referidor.objects.all())

        clientes_data = [
            ('Luis Alberto Fernández', '1005001001', '3101112233',
             'luis.fernandez@mail.com', 'Calle 50 #20-30', 'Barranquilla',
             'Atlántico', True, False, False, False, False),
            ('Martha Cecilia Hurtado', '1005001002', '3104445566',
             'mhurtado@mail.com', 'Cra 45 #80-10', 'Barranquilla',
             'Atlántico', False, True, True, False, True),
            ('Pedro Antonio Ruiz', '1005001003', '3107778899',
             'pedro.ruiz@mail.com', 'Calle 30 #10-05', 'Soledad',
             'Atlántico', False, False, False, True, False),
            ('Diana Patricia Moreno', '1005001004', '3109990011',
             'dmoreno@mail.com', 'Calle 75 #35-22', 'Barranquilla',
             'Atlántico', True, False, False, False, False),
            ('Jorge Eliécer Navarro', '1005001005', '3102223344',
             'jenavarro@mail.com', 'Cra 12 #85-40', 'Malambo',
             'Atlántico', False, False, True, False, False),
            ('Rosa Inés Camargo', '1005001006', '3105556677',
             'rosa.camargo@mail.com', 'Calle 100 #50-60', 'Barranquilla',
             'Atlántico', False, False, False, False, False),
        ]

        created_clients = []
        for (nombre, cc, tel, email, dir, ciudad, depto,
             victima, indigena, adulto, afectacion, madre) in clientes_data:
            cli, _ = Cliente.objects.get_or_create(
                identificacion=cc,
                defaults=dict(
                    nombre=nombre, telefono=tel, email=email,
                    direccion=dir, ciudad=ciudad, departamento=depto,
                    comercial=random.choice(comerciales),
                    referidor=random.choice(referidores) if random.random() < 0.6 else None,
                    es_victima_conflicto=victima, es_indigena=indigena,
                    es_adulto_mayor=adulto, es_afectacion_psicologica=afectacion,
                    es_madre_cabeza_familia=madre,
                    observaciones='Cliente generado automáticamente para pruebas',
                ))
            created_clients.append(cli)

        self.stdout.write(self.style.SUCCESS(f'Clientes: {Cliente.objects.count()}'))

        # ── REPORTES NEGATIVOS ──────────────────────────────────────────────
        entidades_list = list(Entidad.objects.all())
        gestiones = ['PENDIENTE', 'PENDIENTE', 'PENDIENTE', 'GESTIONADO', 'ACUERDO']
        for cli in created_clients:
            for _ in range(random.randint(1, 4)):
                ent = random.choice(entidades_list)
                ReporteNegativo.objects.get_or_create(
                    cliente=cli, entidad=ent.razon_social,
                    numero_obligacion=f'O{random.randint(10000, 99999)}-{random.randint(1, 9)}',
                    defaults=dict(
                        estado_central=random.choice(['ACTIVO', 'EN_MORA', 'CASTIGADA', 'AL_DIA']),
                        gestion=random.choice(gestiones),
                        saldo=Decimal(random.randint(50000, 5000000)),
                        permiso_negativa_hasta=today + timedelta(days=random.randint(30, 365)),
                        notas=f'Reporte de prueba — {ent.razon_social}',
                    ))
        self.stdout.write(self.style.SUCCESS(f'ReportesNegativos: {ReporteNegativo.objects.count()}'))

        # ── PROCESOS ─────────────────────────────────────────────────────────
        from procesos.models import Proceso, EstadoProceso
        # Ensure some estados exist
        estados_default = ['NUEVO', 'CONTACTO_INICIAL', 'EN_GESTION', 'CONTRATO_FIRMADO', 'FINALIZADO']
        for i, nombre in enumerate(estados_default):
            EstadoProceso.objects.get_or_create(nombre=nombre, defaults={'orden': i})

        estados_activos = list(EstadoProceso.objects.filter(activo=True))
        tipos_servicio = ['ELIMINACION_REPORTES', 'TUTELA', 'SIC', 'CARTERA', 'OTRO']

        procesos_created = []
        for cli in created_clients:
            for _ in range(random.randint(1, 2)):
                fec_inicio = today - timedelta(days=random.randint(10, 180))
                dias_venc = random.randint(30, 180)
                valor = random.choice([600000, 800000, 1200000, 1500000, 2000000])
                pct_anticipo = random.choice([30, 50, 60])
                anticipo = int(valor * pct_anticipo / 100)
                p, _ = Proceso.objects.get_or_create(
                    cliente=cli,
                    tipo_servicio=random.choice(tipos_servicio),
                    fecha_inicio=fec_inicio,
                    defaults=dict(
                        estado_comercial=random.choice(estados_activos).nombre,
                        valor_pactado=Decimal(valor),
                        saldo_pendiente=Decimal(valor - anticipo),
                        valor_expectativa_total=Decimal(valor),
                        porcentaje_anticipo=Decimal(pct_anticipo),
                        cantidad_reportes=random.randint(1, 5),
                        cuotas_anticipo=random.choice([1, 2, 3]),
                        fecha_vencimiento=fec_inicio + timedelta(days=dias_venc),
                        observaciones=f'Proceso de prueba para {cli.nombre}',
                    ))
                procesos_created.append(p)

        self.stdout.write(self.style.SUCCESS(f'Procesos: {Proceso.objects.count()}'))

        # ── CASOS JURIDICOS ─────────────────────────────────────────────────
        from procesos.models import CasoJuridico
        abogados = [abo1, abo2, abo3]
        for proc in procesos_created:
            if random.random() < 0.7:  # 70% tienen caso jurídico
                CasoJuridico.objects.get_or_create(
                    proceso=proc, cliente=proc.cliente,
                    defaults=dict(
                        abogado_asignado=random.choice(abogados),
                        tipo_proceso=random.choice(
                            ['TUTELA', 'SIC', 'CARTERA', 'ELIMINACION_REPORTES', 'OTRO']),
                        estado=random.choice(['ACTIVO', 'ACTIVO', 'ACTIVO', 'SUSPENDIDO']),
                        titulo=f"{proc.cliente.nombre} — {proc.tipo_servicio}",
                        prioridad=random.choice(['ALTA', 'MEDIA', 'BAJA']),
                        demandante_accionante=proc.cliente.nombre,
                        demandado_accionado=random.choice([
                            'Bancolombia S.A.', 'Datacrédito', 'TransUnion', 'SISTECREDITO S.A.S.']),
                        fecha_inicio=proc.fecha_inicio or today,
                        proximo_vencimiento=today + timedelta(days=random.randint(15, 90)),
                        descripcion_caso=f"Caso jurídico derivado del proceso de {proc.cliente.nombre}",
                        habilitado_modulo_juridico=True,
                    ))

        self.stdout.write(self.style.SUCCESS(f'CasosJuridicos: {CasoJuridico.objects.count()}'))

        # ── PROCESOS INTERNOS ────────────────────────────────────────────────
        from procesos.models import ProcesoInterno, TipoProcesoInterno, EstadoInterno
        tipos_pi = [t[0] for t in TipoProcesoInterno.choices]
        estados_pi = [t[0] for t in EstadoInterno.choices]
        for caso in CasoJuridico.objects.all():
            for _ in range(random.randint(2, 5)):
                fec_inicio = caso.fecha_inicio or today
                fec_venc = fec_inicio + timedelta(days=random.randint(5, 60))
                ProcesoInterno.objects.get_or_create(
                    caso=caso,
                    titulo=f"{caso.titulo} — {random.choice(['Presentación', 'Respuesta', 'Apelación', 'Seguimiento', 'Notificación'])}",
                    defaults=dict(
                        tipo=random.choice(tipos_pi),
                        estado=random.choice(estados_pi),
                        abogado=random.choice(abogados),
                        precio=Decimal(random.randint(50000, 500000)),
                        fecha_inicio=fec_inicio,
                        fecha_vencimiento=fec_venc,
                        fecha_resolucion=fec_venc + timedelta(days=random.randint(1, 15))
                        if random.random() < 0.4 else None,
                        descripcion=f"Proceso interno generado automáticamente para {caso.titulo}",
                        resultado='Resuelto favorablemente' if random.random() < 0.3 else '',
                    ))

        self.stdout.write(self.style.SUCCESS(f'ProcesosInternos: {ProcesoInterno.objects.count()}'))

        # ── FACTURAS ─────────────────────────────────────────────────────────
        from tesoreria.models import Factura, FacturaItem, Pago
        estados_factura = ['BORRADOR', 'EMITIDA', 'PENDIENTE', 'PAGADA', 'PAGO_PARCIAL', 'VENCIDA']
        for proc in procesos_created:
            if random.random() < 0.6:
                cli = proc.cliente
                if not cli:
                    continue
                total = proc.valor_pactado or Decimal(random.randint(300000, 3000000))
                fec_emision = (proc.fecha_inicio or today) - timedelta(days=random.randint(0, 5))
                fec_venc = fec_emision + timedelta(days=random.randint(15, 60))
                estado = random.choice(estados_factura)
                pagado = Decimal(0)
                if estado == 'PAGADA':
                    pagado = total
                elif estado == 'PAGO_PARCIAL':
                    pagado = total * Decimal(random.choice([0.3, 0.5, 0.7]))
                fact = Factura.objects.create(
                    cliente=cli,
                    proceso=proc,
                    concepto=f'Honorarios por gestión — {cli.nombre}',
                    tipo_servicio=proc.tipo_servicio,
                    fecha_emision=fec_emision,
                    fecha_vencimiento=fec_venc,
                    subtotal=total,
                    total=total,
                    valor_pagado=pagado,
                    saldo_pendiente=total - pagado,
                    estado=estado if estado != 'PAGADA' or pagado >= total else 'PAGADA',
                    creado_por=admin,
                )
                # Un item
                FacturaItem.objects.create(
                    factura=fact,
                    descripcion=proc.tipo_servicio,
                    cantidad=1,
                    valor_unitario=total,
                    subtotal=total,
                )
                # Pago if applicable
                if pagado > 0:
                    Pago.objects.create(
                        factura=fact, fecha=fec_emision + timedelta(days=3),
                        valor=pagado, metodo=random.choice(['TRANSFERENCIA', 'EFECTIVO', 'TARJETA']),
                        registrado_por=admin)

        self.stdout.write(self.style.SUCCESS(f'Facturas: {Factura.objects.count()}'))
        self.stdout.write(self.style.SUCCESS(f'Pagos: {Pago.objects.count()}'))

        # ── RECAUDOS ─────────────────────────────────────────────────────────
        from comercial.models import Recaudo
        for cli in created_clients:
            if random.random() < 0.5:
                Recaudo.objects.create(
                    cliente=cli,
                    concepto=f'Abono a proceso — {cli.nombre}',
                    valor=Decimal(random.randint(100000, 500000)),
                    fecha=today - timedelta(days=random.randint(1, 60)),
                    registrado_por=admin,
                    observaciones='Recaudo de prueba',
                )

        self.stdout.write(self.style.SUCCESS(f'Recaudos: {Recaudo.objects.count()}'))

        # ── EGRESOS ──────────────────────────────────────────────────────────
        from tesoreria.models import Egreso
        categorias = ['HONORARIOS', 'NOTARIALES', 'TRANSPORTE', 'OTRO']
        for _ in range(5):
            Egreso.objects.create(
                concepto=f'Gasto de prueba #{random.randint(1, 100)}',
                categoria=random.choice(categorias),
                valor=Decimal(random.randint(20000, 200000)),
                fecha=today - timedelta(days=random.randint(1, 30)),
                beneficiario=random.choice(['Notaría X', 'Abogado externo', 'Servicios varios']),
                registrado_por=admin,
            )

        self.stdout.write(self.style.SUCCESS(f'Egresos: {Egreso.objects.count()}'))

        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('SEED COMPLETO — TODOS LOS DATOS DE PRUEBA CREADOS'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
