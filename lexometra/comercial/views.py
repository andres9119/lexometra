from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Sum, Count, Q
from django.core.paginator import Paginator
from django.core.files.base import ContentFile
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.template.loader import render_to_string
from django.template.defaultfilters import floatformat
from .models import Cliente, Recaudo, ReporteNegativo, GestionReporte, ESTADOS_SIN_SALDO, Actividad
from procesos.models import (
    Proceso, Servicio, EstadoProceso, Actuacion, CasoJuridico,
    AnticipoCuota, CambioEstado, Documento,
)
from django import forms
import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from django.utils.dateparse import parse_date
from datetime import date, timedelta

from .utils import numero_a_letras
from usuarios.mixins import efective_role
from tesoreria.models import Factura

logger = logging.getLogger(__name__)

Usuario = get_user_model()


def recalcular_anticipo_y_saldo(proceso):
    """Req 5 y 7: a partir de la expectativa (valor único), el % y el nº de
    cuotas, (re)genera el cronograma de cuotas del anticipo y recalcula el
    saldo pendiente, marcando como pagadas las cuotas cubiertas por recaudos
    con es_anticipo=True.
    """
    valor = proceso.valor_expectativa_total or Decimal('0')
    pct = proceso.porcentaje_anticipo or Decimal('0')
    num_cuotas = max(1, int(proceso.cuotas_anticipo or 1))

    anticipo_total = (valor * pct / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # (Re)generar cronograma
    proceso.anticipo_cuotas.all().delete()
    if anticipo_total > 0:
        cuota_val = (anticipo_total / num_cuotas).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        for i in range(num_cuotas):
            AnticipoCuota.objects.create(
                proceso=proceso,
                numero=i + 1,
                valor=cuota_val,
                fecha_vencimiento=date.today() + timedelta(days=30 * i),
            )

    # Pagos al anticipo (recaudos marcados es_anticipo del cliente)
    pagado = Recaudo.objects.filter(
        cliente_id=proceso.cliente_id, es_anticipo=True
    ).aggregate(total=Sum('valor'))['total'] or Decimal('0')

    # Marcar cuotas como pagadas en orden según el monto abonado
    acumulado = Decimal('0')
    for cuota in proceso.anticipo_cuotas.order_by('numero'):
        if acumulado + cuota.valor <= pagado:
            cuota.pagada = True
            cuota.save()
            acumulado += cuota.valor
        else:
            cuota.pagada = False
            cuota.save()

    # Saldo pendiente = valor total - anticipo efectivamente abonado
    proceso.saldo_pendiente = (valor - min(pagado, anticipo_total)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    proceso.valor_pactado = valor  # Req 7: un único valor
    proceso.save(update_fields=['saldo_pendiente', 'valor_pactado'] if proceso.pk else None)
    return {
        'valor': valor,
        'anticipo_total': anticipo_total,
        'num_cuotas': num_cuotas,
        'anticipo_pagado': pagado,
        'anticipo_pendiente': max(anticipo_total - pagado, Decimal('0')),
        'saldo_pendiente': proceso.saldo_pendiente,
    }


def registrar_cambio_estado(proceso, estado_anterior, estado_nuevo, observacion, usuario):
    CambioEstado.objects.create(
        proceso=proceso,
        usuario=usuario,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        observacion=observacion,
    )


class RecaudoForm(forms.ModelForm):
    class Meta:
        model = Recaudo
        fields = ['cliente', 'concepto', 'valor', 'fecha', 'es_anticipo', 'observaciones']

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        if user and user.role == 'COMERCIAL':
            self.fields['cliente'].queryset = Cliente.objects.filter(comercial=user)
        # ADMIN ve todos los clientes


class ActuacionForm(forms.ModelForm):
    class Meta:
        model = Actuacion
        fields = ['proceso', 'fecha', 'descripcion']

@login_required
def lista_comercial_view(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para acceder a esta sección.')
        return redirect('dashboard')
        
    procesos = Proceso.objects.filter(cliente__isnull=False)
    if efective_role(request.user) == 'COMERCIAL':
        procesos = procesos.filter(cliente__comercial=request.user)

    estados_activos = EstadoProceso.objects.filter(activo=True).order_by('orden', 'nombre')

    estado_filter = request.GET.get('estado')
    if estado_filter:
        procesos = procesos.filter(estado_comercial=estado_filter)

    if efective_role(request.user) == 'ADMIN':
        base_qs = Proceso.objects.filter(cliente__isnull=False)
    elif efective_role(request.user) == 'ABOGADO':
        base_qs = Proceso.objects.filter(cliente__isnull=False)
    else:
        base_qs = Proceso.objects.filter(cliente__comercial=request.user)
    
    tabs_data = [{
        'nombre': 'TODOS',
        'count': base_qs.count(),
        'estado_val': '',
        'active': not estado_filter
    }]
    for e in estados_activos:
        tabs_data.append({
            'nombre': e.nombre,
            'count': base_qs.filter(estado_comercial=e.nombre).count(),
            'estado_val': e.nombre,
            'active': estado_filter == e.nombre
        })

    from referidos.models import Referidor
    referidores = Referidor.objects.filter(estado='ACTIVO')
    servicios = Servicio.objects.filter(activo=True)

    paginator = Paginator(procesos.select_related('cliente'), 50)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    qp = request.GET.copy()
    qp.pop('page', None)
    query_params = '&' + qp.urlencode() if qp else ''

    return render(request, 'comercial/lista.html', {
        'procesos': page_obj,
        'tabs_data': tabs_data,
        'estados': estados_activos,
        'estado_activo': estado_filter or 'todos',
        'referidores': referidores,
        'servicios': servicios,
        'canales_origen': Cliente._meta.get_field('canal_origen').choices,
        'read_only': efective_role(request.user) == 'ABOGADO',
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
    })

@login_required
@require_POST
def crear_servicio_ajax(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip()
        if not nombre:
            return JsonResponse({'success': False, 'error': 'El nombre no puede estar vacío'}, status=400)
        
        # Check if exists
        servicio, created = Servicio.objects.get_or_create(nombre=nombre)
        if not created and not servicio.activo:
            servicio.activo = True
            servicio.save()
            
        return JsonResponse({'success': True, 'nombre': servicio.nombre, 'id': servicio.id})
    except Exception:
        logger.error('Error en operación AJAX de servicios/estados', exc_info=True)
        return JsonResponse({'success': False, 'error': 'Ocurrió un error interno. Inténtalo de nuevo.'}, status=500)


@login_required
def gestionar_servicios_ajax(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    servicios = Servicio.objects.all().order_by('nombre')
    data = [{'id': s.id, 'nombre': s.nombre, 'activo': s.activo} for s in servicios]
    return JsonResponse({'success': True, 'servicios': data})


@login_required
@require_POST
def editar_servicio_ajax(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    try:
        data = json.loads(request.body)
        servicio_id = data.get('id')
        nuevo_nombre = data.get('nombre', '').strip()
        if not servicio_id or not nuevo_nombre:
            return JsonResponse({'success': False, 'error': 'ID y nombre requeridos'}, status=400)
        
        servicio = get_object_or_404(Servicio, id=servicio_id)
        if Servicio.objects.filter(nombre=nuevo_nombre).exclude(id=servicio.id).exists():
            return JsonResponse({'success': False, 'error': 'Ya existe un servicio con ese nombre'}, status=400)
        
        servicio.nombre = nuevo_nombre
        servicio.save()
        return JsonResponse({'success': True, 'id': servicio.id, 'nombre': servicio.nombre})
    except Exception:
        logger.error('Error en operación AJAX de servicios/estados', exc_info=True)
        return JsonResponse({'success': False, 'error': 'Ocurrió un error interno. Inténtalo de nuevo.'}, status=500)


@login_required
@require_POST
def eliminar_servicio_ajax(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    try:
        data = json.loads(request.body)
        servicio_id = data.get('id')
        if not servicio_id:
            return JsonResponse({'success': False, 'error': 'ID requerido'}, status=400)
        
        servicio = get_object_or_404(Servicio, id=servicio_id)
        servicio.activo = False
        servicio.save()
        return JsonResponse({'success': True, 'id': servicio.id})
    except Exception:
        logger.error('Error en operación AJAX de servicios/estados', exc_info=True)
        return JsonResponse({'success': False, 'error': 'Ocurrió un error interno. Inténtalo de nuevo.'}, status=500)

@login_required
@require_POST
def crear_estado_ajax(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip()
        if not nombre:
            return JsonResponse({'success': False, 'error': 'El nombre no puede estar vacío'}, status=400)
        
        # Check if exists
        max_orden = EstadoProceso.objects.all().order_by('-orden').first()
        nuevo_orden = (max_orden.orden + 1) if max_orden else 0
        estado, created = EstadoProceso.objects.get_or_create(nombre=nombre, defaults={'orden': nuevo_orden})
        if not created and not estado.activo:
            estado.activo = True
            estado.save()
            
        return JsonResponse({'success': True, 'nombre': estado.nombre, 'id': estado.id})
    except Exception:
        logger.error('Error en operación AJAX de servicios/estados', exc_info=True)
        return JsonResponse({'success': False, 'error': 'Ocurrió un error interno. Inténtalo de nuevo.'}, status=500)

@login_required
def crear_cliente_proceso(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para crear clientes.')
        return redirect('comercial_lista')
    if request.method == 'POST':
        # 1. Validar campos obligatorios
        identificacion = request.POST.get('identificacion', '').strip()
        nombre = request.POST.get('nombre', '').strip()
        telefono = request.POST.get('telefono', '').strip()
        if not identificacion or not nombre or not telefono:
            messages.error(request, 'Cédula, nombre y celular son obligatorios.')
            return redirect('comercial_lista')

        # Verificar si el cliente ya existe
        cliente = Cliente.objects.filter(identificacion=identificacion).first()
        
        if not cliente:
            from referidos.models import Referidor
            referidor_str = request.POST.get('referidor', '').strip()
            referidor_obj = None
            if referidor_str and referidor_str != 'NINGUNO':
                referidor_obj = Referidor.objects.filter(nombre__iexact=referidor_str).first()

            canal_origen = request.POST.get('canal_origen', '')
            fecha_contrato = request.POST.get('fecha_contrato') or None
            cliente = Cliente(
                identificacion=identificacion,
                nombre=nombre,
                telefono=telefono,
                email=request.POST.get('email', ''),
                departamento=request.POST.get('departamento', ''),
                ciudad=request.POST.get('ciudad', ''),
                direccion=request.POST.get('direccion', ''),
                barrio=request.POST.get('barrio', ''),
                vereda=request.POST.get('vereda', ''),
                canal_origen=canal_origen,
                fecha_contrato=parse_date(fecha_contrato) if fecha_contrato else None,
                es_victima_conflicto=request.POST.get('es_victima_conflicto') == 'on',
                es_indigena=request.POST.get('es_indigena') == 'on',
                es_adulto_mayor=request.POST.get('es_adulto_mayor') == 'on',
                es_afectacion_psicologica=request.POST.get('es_afectacion_psicologica') == 'on',
                es_madre_cabeza_familia=request.POST.get('es_madre_cabeza_familia') == 'on',
                referidor=referidor_obj,
            )
            if efective_role(request.user) == 'COMERCIAL':
                cliente.comercial = request.user
            cliente.save()
            
        # 2. Crear Proceso vinculado
        tipo_servicio_str = request.POST.get('tipo_servicio', 'OTRO')
        from procesos.models import Servicio as ProcServicio
        servicio_obj = ProcServicio.objects.filter(nombre__iexact=tipo_servicio_str).first()
        estado_comercial = request.POST.get('estado_comercial', '').strip() or 'NUEVO'
        valor_expectativa = Decimal(request.POST.get('valor_expectativa_total') or 0)
        # Req 7: valor único (expectativa == pactado)
        proceso = Proceso(
            cliente=cliente,
            tipo_servicio=tipo_servicio_str,
            servicio=servicio_obj,
            estado_comercial=estado_comercial,
            referidor=request.POST.get('referidor', ''),
            clave_datacredito=request.POST.get('clave_datacredito', ''),
            score_datacredito=request.POST.get('score_datacredito') or None,
            clave_transunion=request.POST.get('clave_transunion', ''),
            score_transunion=request.POST.get('score_transunion') or None,
            valor_pactado=valor_expectativa,
            saldo_pendiente=valor_expectativa,
            valor_expectativa_total=valor_expectativa,
            porcentaje_anticipo=Decimal(request.POST.get('porcentaje_anticipo') or 0),
            cantidad_reportes=int(request.POST.get('cantidad_reportes') or 0),
            cuotas_anticipo=int(request.POST.get('cuotas_anticipo') or 1),
            fecha_contrato=parse_date(request.POST.get('fecha_contrato')) if request.POST.get('fecha_contrato') else None,
            departamento_competente=request.POST.get('departamento_competente', ''),
            ciudad_juzgado_competente=request.POST.get('ciudad_juzgado_competente', ''),
            observaciones=request.POST.get('observaciones', ''),
        )
        proceso.save()
        recalcular_anticipo_y_saldo(proceso)

        from procesos.models import EstadoProceso as EP
        estado_nombre = EstadoProceso.objects.filter(nombre=estado_comercial).first()
        if not estado_nombre:
            EstadoProceso.objects.get_or_create(nombre=estado_comercial)

        messages.success(request, f'Cliente {cliente.id_comercial} y proceso creados correctamente.')
        return redirect('comercial_lista')
        
    return redirect('comercial_lista')


@login_required
def detalle_cliente(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para ver la ficha del cliente.')
        return redirect('comercial_lista')

    cliente = get_object_or_404(Cliente, pk=pk)
    procesos_cliente = Proceso.objects.filter(cliente=cliente)
    primer_proceso = procesos_cliente.order_by('-fecha_creacion').first()
    casos_juridicos = CasoJuridico.objects.filter(cliente=cliente).select_related('abogado_asignado', 'proceso')

    stats = procesos_cliente.aggregate(
        total_procesos=Count('id'),
        suma_valor_pactado=Sum('valor_pactado'),
        suma_saldo_pendiente=Sum('saldo_pendiente'),
        suma_expectativa=Sum('valor_expectativa_total'),
    )
    
    estados_activos = EstadoProceso.objects.filter(activo=True).order_by('orden', 'nombre')
    comerciales = Usuario.objects.filter(is_active=True, role='COMERCIAL').order_by('first_name')
    from referidos.models import Referidor
    referidores = Referidor.objects.filter(estado='ACTIVO')

    from .models import ReporteNegativo
    reportes = ReporteNegativo.objects.filter(cliente=cliente)
    total_saldo_reportes = reportes.aggregate(total=Sum('saldo'))['total'] or 0

    from procesos.models import ProcesoInterno
    servicios = ProcesoInterno.objects.filter(
        caso__in=casos_juridicos
    ).select_related('abogado').order_by('-fecha_creacion')
    servicios_listos = servicios.filter(
        estado='RESUELTO'
    ).exclude(
        items_factura__factura__estado__in=Factura.ESTADOS_ACTIVOS
    )

    colaboradores = Usuario.objects.filter(is_active=True, role='COLABORADOR').order_by('first_name')
    documentos = Documento.objects.filter(cliente=cliente).order_by('-fecha_subida')

    # Req 5/7: resumen de anticipo y cuotas del primer proceso
    anticipo_resumen = None
    anticipo_cuotas = []
    if primer_proceso:
        anticipo_resumen = recalcular_anticipo_y_saldo(primer_proceso)
        anticipo_cuotas = list(primer_proceso.anticipo_cuotas.order_by('numero'))
        cuotas_pagadas = sum(1 for c in anticipo_cuotas if c.pagada)
        anticipo_resumen['cuotas_pagadas'] = cuotas_pagadas
        anticipo_resumen['cuotas_totales'] = len(anticipo_cuotas)

    # Req 13: historial de actividades (recientes)
    historial = []
    for c in CambioEstado.objects.filter(proceso__cliente=cliente).select_related('usuario')[:30]:
        historial.append({
            'fecha': c.fecha,
            'tipo': 'estado',
            'texto': f"Cambio de estado: {c.estado_anterior or '—'} → {c.estado_nuevo}"
                     + (f" — {c.observacion}" if c.observacion else ''),
            'usuario': c.usuario.get_full_name() or c.usuario.username if c.usuario else 'Sistema',
        })
    for r in Recaudo.objects.filter(cliente=cliente)[:30]:
        historial.append({
            'fecha': r.fecha,
            'tipo': 'recaudo',
            'texto': f"Recaudo ${r.valor:,.0f} ({r.concepto})",
            'usuario': r.registrado_por.get_full_name() or r.registrado_por.username if r.registrado_por else 'Sistema',
        })
    for rn in ReporteNegativo.objects.filter(cliente=cliente)[:30]:
        historial.append({
            'fecha': rn.fecha_creacion,
            'tipo': 'reporte',
            'texto': f"Reporte negativo: {rn.entidad} ({rn.get_gestion_display()})",
            'usuario': 'Sistema',
        })
    for d in Documento.objects.filter(cliente=cliente)[:30]:
        historial.append({
            'fecha': d.fecha_subida,
            'tipo': 'documento',
            'texto': f"Documento subido: {d.nombre}",
            'usuario': d.subido_por.get_full_name() or d.subido_por.username if d.subido_por else 'Sistema',
        })
    for a in Actividad.objects.filter(cliente=cliente)[:30]:
        historial.append({
            'fecha': a.fecha,
            'tipo': 'manual',
            'texto': f"Novedad: {a.descripcion}",
            'usuario': a.usuario.get_full_name() or a.usuario.username if a.usuario else 'Sistema',
        })
    historial.sort(key=lambda x: x['fecha'], reverse=True)

    return render(request, 'comercial/ficha.html', {
        'cliente': cliente,
        'procesos': procesos_cliente,
        'primer_proceso': primer_proceso,
        'stats': stats,
        'casos_juridicos': casos_juridicos,
        'estados': estados_activos,
        'comerciales': comerciales,
        'referidores': referidores,
        'reportes_negativos': reportes,
        'total_saldo_reportes': total_saldo_reportes,
        'colaboradores': colaboradores,
        'servicios': servicios,
        'servicios_listos': servicios_listos,
        'documentos': documentos,
        'anticipo_resumen': anticipo_resumen,
        'anticipo_cuotas': anticipo_cuotas,
        'estados_obligacion': ReporteNegativo._meta.get_field('obligation_status').choices,
        'canales_origen': Cliente._meta.get_field('canal_origen').choices,
        'historial': historial,
        'hoy': date.today(),
        'read_only': efective_role(request.user) == 'ABOGADO',
    })


@login_required
def asignar_comercial_a_mi(request, pk):
    if request.method != 'POST':
        return redirect('comercial_detalle_cliente', pk=pk)

    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para asignarte clientes.')
        return redirect('comercial_detalle_cliente', pk=pk)

    cliente = get_object_or_404(Cliente, pk=pk)
    if cliente.comercial and cliente.comercial != request.user:
        if efective_role(request.user) != 'ADMIN':
            nombre_asignado = cliente.comercial.get_full_name() or cliente.comercial.username
            messages.warning(request, f'El cliente ya está asignado a {nombre_asignado}. Se reasignará a ti.')
        cliente.comercial = request.user
        cliente.save()
        messages.success(request, 'Cliente reasignado a ti correctamente.')
    elif cliente.comercial == request.user:
        messages.info(request, 'El cliente ya está asignado a ti.')
    else:
        cliente.comercial = request.user
        cliente.save()
        messages.success(request, 'Cliente asignado a ti correctamente.')
    return redirect('comercial_detalle_cliente', pk=pk)


@login_required
def nuevo_recaudo(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para registrar recaudos.')
        return redirect('dashboard')
    if request.method == 'POST':
        form = RecaudoForm(request.POST, user=request.user)
        if form.is_valid():
            recaudo = form.save(commit=False)
            recaudo.registrado_por = request.user
            recaudo.save()
            # Req 5/7: si el recaudo abona al anticipo, recalcular cronograma/saldo
            proc = Proceso.objects.filter(cliente=recaudo.cliente).order_by('-fecha_creacion').first()
            if proc:
                recalcular_anticipo_y_saldo(proc)
            messages.success(request, 'Recaudo registrado correctamente.')
            return redirect('comercial_lista')
    else:
        form = RecaudoForm(user=request.user)
    return render(request, 'comercial/recaudo_form.html', {'form': form})


@login_required
def nuevo_actuacion(request):
    if efective_role(request.user) not in ['ADMIN', 'COLABORADOR', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para registrar actuaciones.')
        return redirect('comercial_lista')
    if request.method == 'POST':
        form = ActuacionForm(request.POST)
        if form.is_valid():
            actu = form.save(commit=False)
            actu.registrado_por = request.user
            actu.save()
            messages.success(request, 'Actuación registrada correctamente.')
            return redirect('comercial_lista')
    else:
        form = ActuacionForm()
    return render(request, 'comercial/actuacion_form.html', {'form': form})


@login_required
@require_POST
def cambiar_estado_proceso(request, pk):
    """Cambia el estado_comercial de un Proceso.
    Req 14: exige observación que justifique el cambio.
    Req 2: no se puede volver a 'NUEVO' una vez que el estado fue cambiado.
    Req 3: al pasar a CONTRATO_FIRMADO se exige/autocompleta la fecha de contrato.
    """
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para cambiar el estado.')
        return redirect('comercial_lista')

    proceso = get_object_or_404(Proceso, pk=pk)
    is_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'

    def fail(msg, status=400):
        if is_ajax:
            return JsonResponse({'success': False, 'error': msg}, status=status)
        messages.error(request, msg)
        return None

    nuevo_estado = request.POST.get('estado', '').strip()
    observacion = request.POST.get('observacion', '').strip()
    fecha_contrato = request.POST.get('fecha_contrato', '').strip()

    estado_valido = EstadoProceso.objects.filter(nombre=nuevo_estado, activo=True).exists()
    if not estado_valido:
        resp = fail('Estado inválido.')
        return resp if resp else redirect('comercial_lista')

    # Req 14: observación obligatoria para cualquier cambio
    if not observacion:
        resp = fail('Debe ingresar una observación que justifique el cambio de estado.')
        return resp if resp else redirect('comercial_lista')

    estado_anterior = proceso.estado_comercial

    # Req 2: no volver a NUEVO si ya fue cambiado
    if nuevo_estado == 'NUEVO' and estado_anterior and estado_anterior != 'NUEVO':
        resp = fail('El estado NUEVO solo aplica a clientes recién ingresados; no puede devolverse a este estado.')
        return resp if resp else redirect('comercial_lista')

    # Req 3: CONTRATO_FIRMADO requiere fecha de contrato (la autocompleta con hoy)
    if nuevo_estado == 'CONTRATO_FIRMADO' or nuevo_estado.upper().replace(' ', '_') == 'CONTRATO_FIRMADO':
        fc = parse_date(fecha_contrato) if fecha_contrato else proceso.fecha_contrato
        if not fc:
            fc = date.today()
        proceso.fecha_contrato = fc
        if proceso.cliente_id:
            from .models import Cliente as CModel
            CModel.objects.filter(pk=proceso.cliente_id).update(fecha_contrato=fc)

    proceso.estado_comercial = nuevo_estado
    proceso.save()

    registrar_cambio_estado(proceso, estado_anterior, nuevo_estado, observacion, request.user)

    if is_ajax:
        return JsonResponse({
            'success': True, 'estado': nuevo_estado, 'display': nuevo_estado,
            'fecha_contrato': proceso.fecha_contrato.isoformat() if proceso.fecha_contrato else '',
        })
    messages.success(request, f'Estado actualizado a {nuevo_estado}.')
    return redirect('comercial_lista')


@login_required
@require_POST
def editar_cliente(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        messages.error(request, 'No tienes permisos para editar este cliente.')
        return redirect('comercial_detalle_cliente', pk=pk)

    cliente = get_object_or_404(Cliente, pk=pk)

    cliente.nombre = request.POST.get('nombre', cliente.nombre)
    cliente.identificacion = request.POST.get('identificacion', cliente.identificacion)
    cliente.telefono = request.POST.get('telefono', cliente.telefono)
    cliente.email = request.POST.get('email', cliente.email)
    cliente.departamento = request.POST.get('departamento', cliente.departamento)
    cliente.ciudad = request.POST.get('ciudad', cliente.ciudad)
    cliente.direccion = request.POST.get('direccion', cliente.direccion)
    cliente.barrio = request.POST.get('barrio', cliente.barrio)
    cliente.vereda = request.POST.get('vereda', cliente.vereda)
    cliente.observaciones = request.POST.get('observaciones', cliente.observaciones)
    cliente.canal_origen = request.POST.get('canal_origen', cliente.canal_origen)
    fc = request.POST.get('fecha_contrato')
    if fc:
        cliente.fecha_contrato = parse_date(fc)
    cliente.es_victima_conflicto = request.POST.get('es_victima_conflicto') == 'on'
    cliente.es_indigena = request.POST.get('es_indigena') == 'on'
    cliente.es_adulto_mayor = request.POST.get('es_adulto_mayor') == 'on'
    cliente.es_afectacion_psicologica = request.POST.get('es_afectacion_psicologica') == 'on'
    cliente.es_madre_cabeza_familia = request.POST.get('es_madre_cabeza_familia') == 'on'

    # ADMIN puede reasignar comercial y referidor
    if efective_role(request.user) == 'ADMIN':
        comercial_id = request.POST.get('comercial')
        if comercial_id:
            try:
                cliente.comercial = Usuario.objects.get(pk=comercial_id, role='COMERCIAL', is_active=True)
            except Usuario.DoesNotExist:
                pass
        referidor_id = request.POST.get('referidor')
        if referidor_id:
            from referidos.models import Referidor
            try:
                cliente.referidor = Referidor.objects.get(pk=referidor_id)
            except Referidor.DoesNotExist:
                pass

    cliente.save()

    # Actualizar fecha_inicio en el primer proceso si se envió
    fecha_inicio = request.POST.get('fecha_inicio')
    primer_proceso = Proceso.objects.filter(cliente=cliente).order_by('-fecha_creacion').first()
    if primer_proceso and fecha_inicio:
        fecha_parsed = parse_date(fecha_inicio)
        if fecha_parsed:
            primer_proceso.fecha_inicio = fecha_parsed
            primer_proceso.save(update_fields=['fecha_inicio'])

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': True})

    messages.success(request, 'Cliente actualizado correctamente.')
    return redirect('comercial_detalle_cliente', pk=pk)


@login_required
@require_POST
def editar_centrales_riesgo(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    proceso = get_object_or_404(Proceso, pk=pk)
    proceso.clave_datacredito = request.POST.get('clave_datacredito', '')
    score = request.POST.get('score_datacredito')
    proceso.score_datacredito = int(score) if score else None
    proceso.clave_transunion = request.POST.get('clave_transunion', '')
    score = request.POST.get('score_transunion')
    proceso.score_transunion = int(score) if score else None
    proceso.save(update_fields=['clave_datacredito', 'score_datacredito', 'clave_transunion', 'score_transunion'])
    return JsonResponse({'success': True})


@login_required
@require_POST
def editar_estructura_cobro(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    proceso = get_object_or_404(Proceso, pk=pk)
    # Req 7: el valor pactado es el mismo que la expectativa (campo único).
    valor_expectativa = Decimal(request.POST.get('valor_expectativa_total', 0))
    proceso.valor_expectativa_total = valor_expectativa
    proceso.porcentaje_anticipo = Decimal(request.POST.get('porcentaje_anticipo', 0))
    proceso.cantidad_reportes = int(request.POST.get('cantidad_reportes', 0))
    proceso.cuotas_anticipo = int(request.POST.get('cuotas_anticipo', 1))
    proceso.valor_pactado = valor_expectativa
    proceso.save(update_fields=[
        'valor_expectativa_total', 'porcentaje_anticipo',
        'cantidad_reportes', 'cuotas_anticipo', 'valor_pactado',
    ])
    resumen = recalcular_anticipo_y_saldo(proceso)
    return JsonResponse({'success': True, 'resumen': {
        'anticipo_total': str(resumen['anticipo_total']),
        'anticipo_pagado': str(resumen['anticipo_pagado']),
        'anticipo_pendiente': str(resumen['anticipo_pendiente']),
        'saldo_pendiente': str(resumen['saldo_pendiente']),
    }})


@login_required
@require_POST
def editar_proceso(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    proceso = get_object_or_404(Proceso, pk=pk)

    if request.POST.get('_fetch') == '1':
        return JsonResponse({'success': True, 'proceso': {
            'nombre': proceso.nombre,
            'radicado': proceso.radicado or '',
            'juzgado': proceso.juzgado or '',
            'estado_legal': proceso.estado_legal,
            'colaborador_id': str(proceso.colaborador_id) if proceso.colaborador_id else '',
            'departamento_competente': proceso.departamento_competente or '',
            'ciudad_juzgado_competente': proceso.ciudad_juzgado_competente or '',
            'fecha_inicio': proceso.fecha_inicio.isoformat() if proceso.fecha_inicio else '',
            'fecha_vencimiento': proceso.fecha_vencimiento.isoformat() if proceso.fecha_vencimiento else '',
            'observaciones': proceso.observaciones or '',
        }})

    proceso.nombre = request.POST.get('nombre', proceso.nombre)
    proceso.radicado = request.POST.get('radicado', proceso.radicado) or None
    proceso.juzgado = request.POST.get('juzgado', proceso.juzgado)
    estado_legal_valido = dict(Proceso.ESTADO_LEGAL_CHOICES).get(request.POST.get('estado_legal'))
    if estado_legal_valido:
        proceso.estado_legal = request.POST.get('estado_legal')
    proceso.departamento_competente = request.POST.get('departamento_competente', proceso.departamento_competente)
    proceso.ciudad_juzgado_competente = request.POST.get('ciudad_juzgado_competente', proceso.ciudad_juzgado_competente)
    proceso.observaciones = request.POST.get('observaciones', proceso.observaciones)
    for f in ['fecha_inicio', 'fecha_vencimiento']:
        v = request.POST.get(f)
        setattr(proceso, f, v or None)
    col_id = request.POST.get('colaborador')
    if col_id:
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()
        proceso.colaborador = get_object_or_404(UserModel, pk=col_id, role='COLABORADOR')
    else:
        proceso.colaborador = None
    proceso.save()
    return JsonResponse({'success': True})


@login_required
@require_POST
def agregar_reporte_negativo(request, cliente_pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    cliente = get_object_or_404(Cliente, pk=cliente_pk)
    from .models import ReporteNegativo
    reporte = ReporteNegativo.objects.create(
        cliente=cliente,
        entidad=request.POST.get('entidad', ''),
        numero_obligacion=request.POST.get('numero_obligacion', ''),
        obligation_status=request.POST.get('obligation_status', 'OTRO'),
        estado_central=request.POST.get('estado_central', ''),
        gestion=request.POST.get('gestion', 'PENDIENTE'),
        saldo=Decimal(request.POST.get('saldo', 0)),
        notas=request.POST.get('notas', ''),
    )
    fecha_perm = request.POST.get('permiso_negativa_hasta')
    if fecha_perm:
        from django.utils.dateparse import parse_date
        reporte.permiso_negativa_hasta = parse_date(fecha_perm)
        reporte.save(update_fields=['permiso_negativa_hasta'])
    data = {
        'id': reporte.pk,
        'entidad': reporte.entidad,
        'numero_obligacion': reporte.numero_obligacion,
        'obligation_status': reporte.get_obligation_status_display(),
        'obligation_status_value': reporte.obligation_status,
        'estado_central': reporte.estado_central,
        'gestion': reporte.get_gestion_display() if hasattr(reporte, 'get_gestion_display') else reporte.gestion,
        'saldo': str(reporte.saldo),
        'permiso_negativa_hasta': reporte.permiso_negativa_hasta.isoformat() if reporte.permiso_negativa_hasta else '',
        'notas': reporte.notas,
    }
    return JsonResponse({'success': True, 'reporte': data})


@login_required
@require_POST
def editar_reporte_negativo(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    from .models import ReporteNegativo
    reporte = get_object_or_404(ReporteNegativo, pk=pk)
    reporte.entidad = request.POST.get('entidad', reporte.entidad)
    reporte.numero_obligacion = request.POST.get('numero_obligacion', reporte.numero_obligacion)
    reporte.obligation_status = request.POST.get('obligation_status', reporte.obligation_status)
    reporte.estado_central = request.POST.get('estado_central', reporte.estado_central)
    reporte.gestion = request.POST.get('gestion', reporte.gestion)
    reporte.saldo = Decimal(request.POST.get('saldo', reporte.saldo))
    reporte.notas = request.POST.get('notas', reporte.notas)
    fecha_perm = request.POST.get('permiso_negativa_hasta')
    if fecha_perm:
        from django.utils.dateparse import parse_date
        reporte.permiso_negativa_hasta = parse_date(fecha_perm)
    else:
        reporte.permiso_negativa_hasta = None
    reporte.save()
    return JsonResponse({'success': True})


@login_required
@require_POST
def eliminar_reporte_negativo(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    from .models import ReporteNegativo
    reporte = get_object_or_404(ReporteNegativo, pk=pk)
    reporte.delete()
    return JsonResponse({'success': True})


@login_required
@require_POST
def subir_documento_cliente(request, cliente_pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    cliente = get_object_or_404(Cliente, pk=cliente_pk)
    archivo = request.FILES.get('archivo')
    if not archivo:
        return JsonResponse({'success': False, 'error': 'Debes seleccionar un archivo'})

    caso = None
    proceso = None
    caso_pk = request.POST.get('caso_pk')
    if caso_pk:
        caso = CasoJuridico.objects.filter(pk=caso_pk, cliente=cliente).first()
    if not caso:
        proceso = Proceso.objects.filter(cliente=cliente).order_by('-fecha_creacion').first()

    from procesos.models import Documento
    doc = Documento.objects.create(
        caso=caso,
        proceso=proceso,
        cliente=cliente,
        archivo=archivo,
        nombre=request.POST.get('nombre', archivo.name),
        descripcion=request.POST.get('descripcion', ''),
        subido_por=request.user,
    )
    return JsonResponse({
        'success': True,
        'documento': {
            'id': doc.pk,
            'nombre': doc.nombre,
            'archivo_url': doc.archivo.url,
            'fecha_subida': doc.fecha_subida.strftime('%d/%m/%Y'),
        },
    })


def _guardar_contrato_generado(request, cliente, proceso, html, pdf_bytes=None):
    """Guarda una copia del contrato en el expediente del cliente."""
    nombre_base = f"contrato_{cliente.identificacion or cliente.pk}_{date.today().strftime('%Y%m%d')}"
    caso = CasoJuridico.objects.filter(proceso=proceso).first() if proceso else None
    filename = f"{nombre_base}.pdf" if pdf_bytes else f"{nombre_base}.html"
    payload = ContentFile(pdf_bytes or html.encode('utf-8'), name=filename)

    documento, created = Documento.objects.get_or_create(
        cliente=cliente,
        proceso=proceso,
        caso=caso,
        defaults={
            'nombre': f'Contrato - {cliente.nombre}',
            'descripcion': 'Contrato generado automáticamente del proceso.',
            'subido_por': request.user,
            'archivo': payload,
        },
    )

    if not created:
        documento.nombre = f'Contrato - {cliente.nombre}'
        documento.descripcion = 'Contrato generado automáticamente del proceso.'
        documento.subido_por = request.user
        documento.archivo.save(filename, payload, save=True)
        documento.save()
    return documento


@login_required
def generar_contrato(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'No tienes permisos.')
        return redirect('comercial_lista')

    cliente = get_object_or_404(Cliente, pk=pk)
    proceso = Proceso.objects.filter(cliente=cliente).order_by('-fecha_creacion').first()
    if not proceso or proceso.estado_comercial != 'CONTRATO_FIRMADO' or not proceso.fecha_contrato:
        messages.error(request, 'El contrato solo puede generarse cuando el proceso está firmado y tiene fecha de contrato.')
        return redirect('comercial_detalle_cliente', pk=cliente.pk)

    from .models import ReporteNegativo, PerfilEmpresa
    reportes = ReporteNegativo.objects.filter(cliente=cliente)
    empresa = PerfilEmpresa.objects.first()

    valor_total = float(proceso.valor_pactado) if proceso and proceso.valor_pactado else 0
    pct_anticipo = float(proceso.porcentaje_anticipo) if proceso and proceso.porcentaje_anticipo else 0
    anticipo = round(valor_total * pct_anticipo / 100, 2) if pct_anticipo else 0
    saldo = round(valor_total - anticipo, 2)
    cuotas_ct = int(proceso.cuotas_anticipo) if proceso and proceso.cuotas_anticipo else 1
    if anticipo and cuotas_ct > 1:
        cuota_valor = round(anticipo / cuotas_ct, 2)
        cuotas = [{'fecha': (date.today() + timedelta(days=30 * i)).strftime('%d-%m-%Y'), 'valor': cuota_valor} for i in range(cuotas_ct)]
    else:
        cuotas = [{'fecha': date.today().strftime('%d-%m-%Y'), 'valor': anticipo}] if anticipo else []

    valor_total_letras = numero_a_letras(valor_total)
    anticipo_letras = numero_a_letras(anticipo)
    saldo_letras = numero_a_letras(saldo)

    ctx = {
        'cliente': cliente,
        'proceso': proceso,
        'empresa': empresa,
        'reportes': reportes,
        'valor_total': valor_total,
        'anticipo': anticipo,
        'saldo': saldo,
        'cuotas': cuotas,
        'valor_total_letras': valor_total_letras,
        'anticipo_letras': anticipo_letras,
        'saldo_letras': saldo_letras,
        'fecha_hoy': date.today().strftime('%d de %B de %Y'),
    }

    html = render_to_string('comercial/contrato.html', ctx, request=request)
    pdf_bytes = None

    if request.GET.get('pdf'):
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html).write_pdf()
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="contrato_{cliente.identificacion}.pdf"'
            _guardar_contrato_generado(request, cliente, proceso, html, pdf_bytes)
            return response
        except Exception:
            messages.warning(request, 'WeasyPrint no disponible. Se muestra la vista HTML.')

    _guardar_contrato_generado(request, cliente, proceso, html)
    return HttpResponse(html)


def _armar_historial(cliente, limite=None):
    """Reúne las actividades del cliente (Req 13)."""
    items = []
    for c in CambioEstado.objects.filter(proceso__cliente=cliente).select_related('usuario'):
        items.append({
            'fecha': c.fecha,
            'tipo': 'estado',
            'texto': f"Cambio de estado: {c.estado_anterior or '—'} → {c.estado_nuevo}",
            'detalle': c.observacion,
            'usuario': c.usuario.get_full_name() or c.usuario.username if c.usuario else 'Sistema',
            'proceso_id': c.proceso_id,
        })
    for r in Recaudo.objects.filter(cliente=cliente).select_related('registrado_por'):
        items.append({
            'fecha': r.fecha,
            'tipo': 'recaudo',
            'texto': f"Recaudo ${r.valor:,.0f} — {r.concepto}",
            'detalle': ('Abono a anticipo' if r.es_anticipo else '') or '',
            'usuario': r.registrado_por.get_full_name() or r.registrado_por.username if r.registrado_por else 'Sistema',
        })
    for rn in ReporteNegativo.objects.filter(cliente=cliente):
        items.append({
            'fecha': rn.fecha_creacion,
            'tipo': 'reporte',
            'texto': f"Reporte negativo: {rn.entidad}",
            'detalle': rn.get_gestion_display(),
            'usuario': 'Sistema',
        })
    for d in Documento.objects.filter(cliente=cliente).select_related('subido_por'):
        items.append({
            'fecha': d.fecha_subida,
            'tipo': 'documento',
            'texto': f"Documento subido: {d.nombre}",
            'detalle': d.descripcion,
            'usuario': d.subido_por.get_full_name() or d.subido_por.username if d.subido_por else 'Sistema',
        })
    for a in Actividad.objects.filter(cliente=cliente).select_related('usuario'):
        items.append({
            'fecha': a.fecha,
            'tipo': 'manual',
            'texto': f"Novedad: {a.descripcion}",
            'detalle': '',
            'usuario': a.usuario.get_full_name() or a.usuario.username if a.usuario else 'Sistema',
        })
    items.sort(key=lambda x: x['fecha'], reverse=True)
    if limite:
        items = items[:limite]
    return items


@login_required
def historial_actividad_view(request, pk):
    """Página expandida con todo el historial de actividades (Req 13)."""
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        return redirect('comercial_lista')
    cliente = get_object_or_404(Cliente, pk=pk)
    historial = _armar_historial(cliente)
    return render(request, 'comercial/historial_actividad.html', {
        'cliente': cliente,
        'historial': historial,
        'hoy': date.today(),
        'read_only': efective_role(request.user) == 'ABOGADO',
    })


@login_required
@require_POST
def agregar_actividad_manual(request, pk):
    """Registra una novedad manual en el historial del cliente."""
    if efective_role(request.user) in ['ABOGADO', 'COLABORADOR']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    cliente = get_object_or_404(Cliente, pk=pk)
    descripcion = (request.POST.get('descripcion', '') or '').strip()
    if not descripcion:
        return JsonResponse({'success': False, 'error': 'La novedad es obligatoria'}, status=400)
    if request.POST.get('fecha'):
        fecha = parse_date(request.POST['fecha']) or date.today()
    else:
        fecha = date.today()
    Actividad.objects.create(
        cliente=cliente,
        descripcion=descripcion,
        fecha=fecha,
        usuario=request.user,
    )
    return JsonResponse({'success': True})


@login_required
@require_POST
def generar_factura_cobro(request, cliente_pk):
    """Req 8: al completar el cobro mixto, la información pasa a
    contabilidad/facturación creando una factura BORRADOR (no se emite a DIAN,
    así se mantiene intacto el flujo de Factus).
    """
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    cliente = get_object_or_404(Cliente, pk=cliente_pk)
    proceso = Proceso.objects.filter(cliente=cliente).order_by('-fecha_creacion').first()
    if not proceso:
        return JsonResponse({'success': False, 'error': 'El cliente no tiene un proceso asociado.'}, status=400)

    from tesoreria.models import Factura, FacturaItem

    valor = proceso.valor_expectativa_total or Decimal('0')
    if valor <= 0:
        return JsonResponse({'success': False, 'error': 'Debe definir el valor de la expectativa antes de facturar.'}, status=400)

    # Evitar duplicados: si ya existe una BORRADOR para este proceso, se reutiliza
    fac = Factura.objects.filter(proceso=proceso, estado='BORRADOR').first()
    if not fac:
        fac = Factura.objects.create(
            cliente=cliente,
            proceso=proceso,
            caso=casos_juridicos_first(proceso),
            concepto=f'Cobro mixto — {proceso.tipo_servicio_display} — {cliente.nombre}',
            tipo_servicio=proceso.tipo_servicio,
            termino_pago='CONTADO',
            fecha_emision=date.today(),
            fecha_vencimiento=date.today(),
            estado='BORRADOR',
            creado_por=request.user,
        )
        subtotal = valor
        FacturaItem.objects.create(
            factura=fac,
            descripcion=f'{proceso.tipo_servicio_display} — {cliente.nombre}',
            cantidad=1,
            valor_unitario=subtotal,
            iva_porcentaje=0,
        )
    fac.subtotal = valor
    fac.total = valor
    fac.saldo_pendiente = valor
    fac.save()
    return JsonResponse({'success': True, 'factura_id': fac.pk, 'numero': fac.numero})


def casos_juridicos_first(proceso):
    caso = CasoJuridico.objects.filter(proceso=proceso).first()
    return caso


@login_required
@require_POST
def eliminar_documento_ficha(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    doc = get_object_or_404(Documento, pk=pk)
    cliente_pk = doc.cliente_id
    doc.archivo.delete(save=False)
    doc.delete()
    return JsonResponse({'success': True, 'cliente_pk': cliente_pk})


@login_required
def lista_contratos(request):
    """Listado global de contratos generables, con acceso directo a HTML/PDF."""
    if efective_role(request.user) == 'ABOGADO':
        qs = Proceso.objects.all()
    else:
        qs = Proceso.objects.all()

    qs = qs.filter(cliente__isnull=False).select_related('cliente', 'servicio').order_by('-fecha_creacion')

    q = request.GET.get('q', '').strip()
    if q:
        qs = qs.filter(
            Q(cliente__nombre__icontains=q) | Q(cliente__identificacion__icontains=q)
        )

    paginator = Paginator(qs, 50)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    qp = request.GET.copy()
    qp.pop('page', None)
    query_params = '&' + qp.urlencode() if qp else ''

    return render(request, 'comercial/lista_contratos.html', {
        'procesos': page_obj,
        'q': q,
        'paginator': paginator,
        'query_params': query_params,
        'read_only': efective_role(request.user) == 'ABOGADO',
    })
