from datetime import date
from decimal import Decimal
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Sum, Q
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from .models import Referidor, Comision
from comercial.models import Recaudo
from tesoreria.models import Pago
from usuarios.mixins import efective_role, rol_requerido


@rol_requerido('ADMIN', 'COMERCIAL')
def panel_referidos_view(request):
    referidores = Referidor.objects.annotate(
        total_referidos=Count('clientes_referidos'),
    )

    # Per-referidor commission totals (una sola consulta agregada)
    comision_agg = Comision.objects.values('referidor_id').annotate(
        comision_total=Sum('monto_comision'),
        monto_base_total=Sum('monto_base'),
        comision_pendiente=Sum('monto_comision', filter=Q(pagada=False)),
    )
    agg_map = {a['referidor_id']: a for a in comision_agg}
    for ref in referidores:
        a = agg_map.get(ref.id) or {}
        ref.comision_total = a.get('comision_total') or 0
        ref.monto_base_total = a.get('monto_base_total') or 0
        ref.comision_pendiente = a.get('comision_pendiente') or 0

    # Totals from Comision model
    comisiones_pendientes = Comision.objects.filter(pagada=False).aggregate(
        total=Sum('monto_comision'),
    )['total'] or 0
    comisiones_pagadas = Comision.objects.filter(pagada=True).aggregate(
        total=Sum('monto_comision'),
    )['total'] or 0

    stats = {
        'activos': referidores.filter(estado='ACTIVO').count(),
        'total_clientes': sum(r.total_referidos for r in referidores),
        'comisiones_pendientes': comisiones_pendientes,
        'comisiones_pagadas': comisiones_pagadas,
    }

    return render(request, 'referidos/panel_referidos.html', {
        'referidores': referidores,
        'stats': stats,
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def comisiones_view(request):
    comisiones = Comision.objects.select_related('referidor', 'cliente').all()

    # Aggregate per referidor
    por_referidor = Comision.objects.values('referidor__nombre', 'referidor_id').annotate(
        total_comision=Sum('monto_comision'),
        total_pagado=Sum('monto_comision', filter=Q(pagada=True)),
        total_pendiente=Sum('monto_comision', filter=Q(pagada=False)),
        cantidad=Count('id'),
    ).order_by('-total_comision')

    totals = {
        'total_comision': sum(r['total_comision'] or 0 for r in por_referidor),
        'total_pagado': sum(r['total_pagado'] or 0 for r in por_referidor),
        'total_pendiente': sum(r['total_pendiente'] or 0 for r in por_referidor),
        'cantidad': sum(r['cantidad'] for r in por_referidor),
    }

    tab = request.GET.get('tab', 'pendientes')
    if tab == 'pendientes':
        comisiones = comisiones.filter(pagada=False)
    elif tab == 'pagadas':
        comisiones = comisiones.filter(pagada=True)

    paginator = Paginator(comisiones, 50)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    qp = request.GET.copy()
    qp.pop('page', None)
    query_params = '&' + qp.urlencode() if qp else ''

    return render(request, 'referidos/comisiones.html', {
        'comisiones': page_obj,
        'por_referidor': por_referidor,
        'totals': totals,
        'tab': tab,
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
    })


@login_required
@require_POST
def marcar_comision_pagada(request, pk):
    if efective_role(request.user) not in ['ADMIN']:
        return JsonResponse({'success': False, 'error': 'Solo administradores'}, status=403)
    comision = get_object_or_404(Comision, pk=pk)
    comision.pagada = True
    comision.fecha_pago = date.today()
    comision.save()
    messages.success(request, f'Comisión de ${comision.monto_comision:,.0f} marcada como pagada.')
    return redirect('comisiones_view')


@rol_requerido('ADMIN', 'COMERCIAL')
def crear_referidor_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        cedula = request.POST.get('cedula', '').strip()
        telefono = request.POST.get('telefono', '').strip()
        correo = request.POST.get('correo', '').strip()
        comision = request.POST.get('comision', '10')
        banco = request.POST.get('banco', '').strip()
        numero_cuenta = request.POST.get('numero_cuenta', '').strip()
        tipo_cuenta = request.POST.get('tipo_cuenta', 'AHORROS')
        estado = request.POST.get('estado', 'ACTIVO')
        notas = request.POST.get('notas', '').strip()

        if not nombre or not cedula:
            messages.error(request, 'Nombre y cédula son obligatorios.')
            return redirect('panel_referidos')

        if Referidor.objects.filter(cedula=cedula).exists():
            messages.error(request, f'Ya existe un referidor con la cédula {cedula}.')
            return redirect('panel_referidos')

        Referidor.objects.create(
            nombre=nombre,
            cedula=cedula,
            telefono=telefono,
            correo=correo,
            comision=comision,
            banco=banco,
            numero_cuenta=numero_cuenta,
            tipo_cuenta=tipo_cuenta,
            estado=estado,
            notas=notas,
        )
        messages.success(request, f'Referidor "{nombre}" registrado correctamente.')
        return redirect('panel_referidos')

    messages.error(request, 'Método no permitido.')
    return redirect('panel_referidos')


@login_required
def nuevo_cliente_referido(request, pk):
    """Req 1: link individual del referidor para crear un cliente 'de su
    propiedad'. Se crea el cliente ya vinculado a ese referidor y en estado
    NUEVO (por defecto, sin marcarlo)."""
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para crear clientes.')
        return redirect('panel_referidos')

    referidor = get_object_or_404(Referidor, pk=pk)

    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        identificacion = request.POST.get('identificacion', '').strip()
        telefono = request.POST.get('telefono', '').strip()
        if not nombre or not identificacion:
            messages.error(request, 'Nombre y cédula son obligatorios.')
            return redirect('nuevo_cliente_referido', pk=pk)

        from comercial.models import Cliente
        from comercial.views import recalcular_anticipo_y_saldo
        from procesos.models import Proceso, EstadoProceso

        cliente, created = Cliente.objects.get_or_create(
            identificacion=identificacion,
            defaults={
                'nombre': nombre,
                'telefono': telefono,
                'email': request.POST.get('email', ''),
                'departamento': request.POST.get('departamento', ''),
                'ciudad': request.POST.get('ciudad', ''),
                'direccion': request.POST.get('direccion', ''),
                'barrio': request.POST.get('barrio', ''),
                'canal_origen': 'REFERIDO',
                'referidor': referidor,
            },
        )
        if efective_role(request.user) == 'COMERCIAL':
            cliente.comercial = request.user

        EstadoProceso.objects.get_or_create(nombre='NUEVO')
        proceso = Proceso.objects.create(
            cliente=cliente,
            tipo_servicio='ELIMINACION_REPORTES',
            estado_comercial='NUEVO',
            referidor=referidor.nombre,
            valor_expectativa_total=Decimal(request.POST.get('valor_expectativa_total') or 0),
            valor_pactado=Decimal(request.POST.get('valor_expectativa_total') or 0),
            saldo_pendiente=Decimal(request.POST.get('valor_expectativa_total') or 0),
        )
        recalcular_anticipo_y_saldo(proceso)

        messages.success(request, f'Cliente {cliente.id_comercial} creado y vinculado al referidor {referidor.nombre}.')
        return redirect('comercial_detalle_cliente', pk=cliente.pk)

    return render(request, 'referidos/nuevo_cliente_referido.html', {
        'referidor': referidor,
    })


def registro_referido_publico(request):
    """Req 1: enlace público por referidor.

    Un referidor comparte su enlace (…/referidos/registro/?ref=<id>). Cualquier
    persona (sin login) lo abre y registra sus datos como prospecto, quedando
    vinculado a ese referidor (canal REFERIDO + referidor) y en estado NUEVO.
    """
    ref_id = request.GET.get('ref') or request.POST.get('ref')
    referidor = None
    if ref_id:
        referidor = Referidor.objects.filter(pk=ref_id, estado='ACTIVO').first()

    error = ''
    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        identificacion = request.POST.get('identificacion', '').strip()
        telefono = request.POST.get('telefono', '').strip()
        email = request.POST.get('email', '').strip()
        ciudad = request.POST.get('ciudad', '').strip()
        servicio = request.POST.get('servicio', 'ELIMINACION_REPORTES').strip()
        notas = request.POST.get('notas', '').strip()

        if not nombre or not identificacion or not telefono:
            error = 'Por favor completa los campos obligatorios: nombre, cédula y teléfono.'
        elif not referidor:
            error = 'El enlace de referido no es válido.'
        else:
            from comercial.models import Cliente
            from procesos.models import Proceso, EstadoProceso
            EstadoProceso.objects.get_or_create(nombre='NUEVO')

            cliente, created = Cliente.objects.get_or_create(
                identificacion=identificacion,
                defaults={
                    'nombre': nombre,
                    'telefono': telefono,
                    'email': email,
                    'ciudad': ciudad,
                    'departamento': '',
                    'canal_origen': 'REFERIDO',
                    'referidor': referidor,
                },
            )
            if not created:
                # Ya existía; asegurar que quede vinculado al referidor.
                cliente.referidor = referidor
                cliente.canal_origen = cliente.canal_origen or 'REFERIDO'
                cliente.save()

            if not Proceso.objects.filter(cliente=cliente).exists():
                Proceso.objects.create(
                    cliente=cliente,
                    tipo_servicio='ELIMINACION_REPORTES',
                    estado_comercial='NUEVO',
                    referidor=referidor.nombre,
                    valor_expectativa_total=0,
                    valor_pactado=0,
                    saldo_pendiente=0,
                    observaciones=notas,
                )

            return render(request, 'referidos/registro_referido.html', {
                'referidor': referidor,
                'enviado': True,
                'nombre': nombre,
            })

    return render(request, 'referidos/registro_referido.html', {
        'referidor': referidor,
        'ref_id': ref_id,
        'error': error,
    })
