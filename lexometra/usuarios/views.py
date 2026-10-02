from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count
from comercial.models import Cliente, Recaudo
from procesos.models import Proceso, Actuacion, CasoJuridico, ProcesoInterno
from tesoreria.models import Factura, Egreso, Pago
from referidos.models import Referidor
from django.utils import timezone
from .mixins import efective_role
import json

Usuario = get_user_model()


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')

    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, 'Usuario o contraseña incorrectos.')

    return render(request, 'usuarios/login.html')


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def dashboard_view(request):
    user = request.user

    if efective_role(user) == 'ADMIN':
        today = timezone.localdate()

        # ── Users ──
        usuarios_activos = Usuario.objects.filter(is_active=True).count()
        abogados_count = Usuario.objects.filter(is_active=True, role='ABOGADO').count()
        comerciales_count = Usuario.objects.filter(is_active=True, role='COMERCIAL').count()

        # ── Clientes ──
        clientes_count = Cliente.objects.count()
        clientes_con_proceso = Cliente.objects.filter(procesos__isnull=False).distinct().count()
        clientes_referidos = Cliente.objects.filter(referidor__isnull=False).count()

        # ── Procesos ──
        procesos_count = Proceso.objects.count()
        procesos_activos = Proceso.objects.filter(estado_legal='ACTIVO').count()
        procesos_terminados = Proceso.objects.filter(estado_legal='TERMINADO').count()

        # ── Casos Jurídicos ──
        casos_count = CasoJuridico.objects.count()
        casos_activos = CasoJuridico.objects.filter(estado='ACTIVO').count()
        casos_por_vencer = CasoJuridico.objects.filter(
            proximo_vencimiento__isnull=False,
            estado='ACTIVO',
        ).order_by('proximo_vencimiento')[:5]

        # ── Procesos Internos ──
        internos_activos = ProcesoInterno.objects.filter(estado='ACTIVO').count()

        # ── Actuaciones ──
        actuaciones_mes = Actuacion.objects.filter(
            fecha__year=today.year, fecha__month=today.month
        ).count()

        # ── Next vencimientos (procesos) ──
        venc_qs = Proceso.objects.filter(
            fecha_vencimiento__isnull=False
        ).order_by('fecha_vencimiento')[:10]
        vencimientos = []
        for p in venc_qs:
            days = (p.fecha_vencimiento - today).days
            if days < 0:
                label = 'VENCIDO'
                cls = 'status-vencido'
            elif days == 0:
                label = 'HOY'
                cls = 'status-hoy'
            elif days <= 2:
                label = f'{days}d'
                cls = 'status-dias'
            else:
                label = f'{days}d'
                cls = 'status-ok'
            vencimientos.append({'proceso': p, 'days': days, 'label': label, 'cls': cls})

        # ── Charts: Procesos por estado legal ──
        procesos_estado_counts = [
            Proceso.objects.filter(estado_legal='ACTIVO').count(),
            Proceso.objects.filter(estado_legal='SUSPENDIDO').count(),
            Proceso.objects.filter(estado_legal='TERMINADO').count(),
            Proceso.objects.filter(estado_legal='ARCHIVADO').count(),
        ]

        # ── Charts: Casos por tipo ──
        casos_tipo_labels = ['Tutela', 'SIC', 'Cartera', 'Elim. Reportes', 'Otro']
        casos_tipo_counts = [
            CasoJuridico.objects.filter(tipo_proceso='TUTELA').count(),
            CasoJuridico.objects.filter(tipo_proceso='SIC').count(),
            CasoJuridico.objects.filter(tipo_proceso='CARTERA').count(),
            CasoJuridico.objects.filter(tipo_proceso='ELIMINACION_REPORTES').count(),
            CasoJuridico.objects.exclude(tipo_proceso__in=['TUTELA', 'SIC', 'CARTERA', 'ELIMINACION_REPORTES']).count(),
        ]

        # ── Charts: Procesos por estado comercial ──
        from procesos.models import EstadoProceso
        estados_comerciales_db = EstadoProceso.objects.filter(activo=True).order_by('orden')[:8]
        com_labels = [e.nombre for e in estados_comerciales_db]
        com_counts = [Proceso.objects.filter(estado_comercial=e.nombre).count() for e in estados_comerciales_db]

        # ── Financials ──
        valor_pactado_total = Proceso.objects.aggregate(total=Sum('valor_pactado'))['total'] or 0
        saldo_por_cobrar = Proceso.objects.aggregate(total=Sum('saldo_pendiente'))['total'] or 0
        recaudado_total = Recaudo.objects.aggregate(total=Sum('valor'))['total'] or 0
        total_facturado = Factura.objects.aggregate(total=Sum('total'))['total'] or 0
        total_pagado = Pago.objects.aggregate(total=Sum('valor'))['total'] or 0
        total_egresos = Egreso.objects.aggregate(total=Sum('valor'))['total'] or 0
        facturas_pendientes = Factura.objects.filter(estado__in=['EMITIDA', 'PAGO_PARCIAL', 'VENCIDA']).count()
        facturas_vencidas = Factura.objects.filter(estado='VENCIDA').count()

        # ── Referidos ──
        referidores_activos = Referidor.objects.filter(estado='ACTIVO').count()

        # ── Recent ──
        recent_procesos = Proceso.objects.order_by('-fecha_creacion').select_related('cliente')[:5]
        recent_casos = CasoJuridico.objects.order_by('-fecha_creacion').select_related('cliente', 'abogado_asignado')[:5]
        recent_clients = Cliente.objects.order_by('-fecha_registro')[:5]

        balance_neto = total_pagado - total_egresos

        context = {
            'user': user,
            'today': today,
            # Users
            'usuarios_activos': usuarios_activos,
            'abogados_count': abogados_count,
            'comerciales_count': comerciales_count,
            # Clientes
            'clientes_count': clientes_count,
            'clientes_con_proceso': clientes_con_proceso,
            'clientes_referidos': clientes_referidos,
            # Procesos
            'procesos_count': procesos_count,
            'procesos_activos': procesos_activos,
            'procesos_terminados': procesos_terminados,
            # Casos
            'casos_count': casos_count,
            'casos_activos': casos_activos,
            'casos_por_vencer': casos_por_vencer,
            'internos_activos': internos_activos,
            'actuaciones_mes': actuaciones_mes,
            'referidores_activos': referidores_activos,
            # Vencimientos
            'vencimientos': vencimientos,
            # Charts
            'procesos_estado_json': json.dumps(procesos_estado_counts),
            'casos_tipo_labels_json': json.dumps(casos_tipo_labels),
            'casos_tipo_counts_json': json.dumps(casos_tipo_counts),
            'com_labels_json': json.dumps(com_labels),
            'com_counts_json': json.dumps(com_counts),
            # Financial
            'valor_pactado_total': valor_pactado_total,
            'saldo_por_cobrar': saldo_por_cobrar,
            'recaudado_total': recaudado_total,
            'total_facturado': total_facturado,
            'total_pagado': total_pagado,
            'total_egresos': total_egresos,
            'balance_neto': balance_neto,
            'facturas_pendientes': facturas_pendientes,
            'facturas_vencidas': facturas_vencidas,
            # Recent
            'recent_procesos': recent_procesos,
            'recent_casos': recent_casos,
            'recent_clients': recent_clients,
        }

        return render(request, 'dashboard/admin.html', context)

    elif efective_role(user) == 'COMERCIAL':
        today = timezone.localdate()
        mis_procesos = Proceso.objects.filter(cliente__comercial=user)
        mis_clientes = Cliente.objects.filter(comercial=user)

        prospectos = mis_procesos.filter(estado_comercial='PROSPECTO').count()
        contratos = mis_procesos.filter(estado_comercial='CONTRATO_FIRMADO').count()
        clientes_activos = mis_clientes.count()
        recaudos_mes = Recaudo.objects.filter(
            cliente__comercial=user,
            fecha__year=today.year,
            fecha__month=today.month,
        ).aggregate(total=Sum('valor'))['total'] or 0
        valor_pactado = mis_procesos.aggregate(total=Sum('valor_pactado'))['total'] or 0
        saldo_pendiente = mis_procesos.aggregate(total=Sum('saldo_pendiente'))['total'] or 0

        venc_prox = mis_procesos.filter(
            fecha_vencimiento__isnull=False,
            estado_legal='ACTIVO',
        ).order_by('fecha_vencimiento')[:5]

        recent = mis_clientes.order_by('-fecha_registro')[:5]

        context = {
            'user': user,
            'prospectos': prospectos,
            'contratos': contratos,
            'clientes_activos': clientes_activos,
            'recaudos_mes': recaudos_mes,
            'valor_pactado': valor_pactado,
            'saldo_pendiente': saldo_pendiente,
            'venc_prox': venc_prox,
            'recent': recent,
            'today': today,
        }
        return render(request, 'dashboard/comercial.html', context)

    elif efective_role(user) == 'ABOGADO':
        today = timezone.localdate()
        casos_asignados = CasoJuridico.objects.filter(abogado_asignado=user)
        casos_activos = casos_asignados.filter(estado='ACTIVO').count()
        internos_activos = ProcesoInterno.objects.filter(abogado=user, estado='ACTIVO').count()
        procesos_asignados = Proceso.objects.filter(colaborador=user).count()

        prox_vencer = casos_asignados.filter(
            proximo_vencimiento__isnull=False,
            estado='ACTIVO',
        ).order_by('proximo_vencimiento')[:5]

        actuaciones_mes = Actuacion.objects.filter(
            registrado_por=user,
            fecha__year=today.year,
            fecha__month=today.month,
        ).count()

        casos_recientes = casos_asignados.order_by('-fecha_creacion').select_related('cliente')[:5]

        context = {
            'user': user,
            'casos_count': casos_asignados.count(),
            'casos_activos': casos_activos,
            'internos_activos': internos_activos,
            'procesos_asignados': procesos_asignados,
            'prox_vencer': prox_vencer,
            'actuaciones_mes': actuaciones_mes,
            'casos_recientes': casos_recientes,
            'today': today,
        }
        return render(request, 'dashboard/colaborador.html', context)

    else:  # COLABORADOR
        today = timezone.localdate()
        procesos_asignados = Proceso.objects.filter(colaborador=user)
        activos = procesos_asignados.filter(estado_legal='ACTIVO').count()

        venc_prox = procesos_asignados.filter(
            fecha_vencimiento__isnull=False,
            estado_legal='ACTIVO',
        ).order_by('fecha_vencimiento')[:5]

        actuaciones_mes = Actuacion.objects.filter(
            registrado_por=user,
            fecha__year=today.year,
            fecha__month=today.month,
        ).count()

        recent = procesos_asignados.order_by('-fecha_creacion').select_related('cliente')[:5]

        context = {
            'user': user,
            'procesos_asignados': procesos_asignados.count(),
            'activos': activos,
            'venc_prox': venc_prox,
            'actuaciones_mes': actuaciones_mes,
            'recent': recent,
            'today': today,
        }
        return render(request, 'dashboard/colaborador.html', context)
