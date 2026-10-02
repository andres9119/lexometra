import calendar
import json
from decimal import Decimal
from datetime import date, datetime
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import CasoJuridico, ProcesoInterno, Documento, Proceso, Actuacion, get_least_loaded_lawyer, Entidad, ComplejidadEntidad, TipoProcesoInterno, EstadoInterno
from usuarios.mixins import efective_role

User = get_user_model()


@login_required
def lista_casos_view(request):
    user = request.user
    casos = CasoJuridico.objects.select_related(
        'cliente', 'abogado_asignado', 'proceso'
    )

    if efective_role(user) == 'ABOGADO':
        casos = casos.filter(abogado_asignado=user)
    elif efective_role(user) == 'COMERCIAL':
        casos = casos.filter(proceso__cliente__comercial=user)

    estado_filter = request.GET.get('estado')
    if estado_filter:
        casos = casos.filter(estado=estado_filter)

    stats = {
        'activos': casos.filter(estado='ACTIVO').count(),
        'suspendidos': casos.filter(estado='SUSPENDIDO').count(),
        'terminados': casos.filter(estado='TERMINADO').count(),
        'archivados': casos.filter(estado='ARCHIVADO').count(),
    }

    paginator = Paginator(casos, 50)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)

    qp = request.GET.copy()
    qp.pop('page', None)
    query_params = '&' + qp.urlencode() if qp else ''

    return render(request, 'procesos/lista_casos.html', {
        'casos': page_obj,
        'stats': stats,
        'estado_activo': estado_filter or 'todos',
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
    })


@login_required
def detalle_caso_view(request, pk):
    caso = get_object_or_404(
        CasoJuridico.objects.select_related('cliente', 'abogado_asignado', 'proceso'),
        pk=pk,
    )
    procesos_internos = caso.procesos_internos.select_related('abogado').prefetch_related('documentos').all()
    documentos_caso = caso.documentos.all()
    abogados = User.objects.filter(role='ABOGADO', is_active=True).order_by('first_name')

    return render(request, 'procesos/detalle_caso.html', {
        'caso': caso,
        'procesos_internos': procesos_internos,
        'documentos_caso': documentos_caso,
        'abogados': abogados,
        'admin_roles': ['ADMIN', 'ABOGADO'],
        'today': date.today(),
    })


@login_required
def crear_caso_juridico(request, cliente_pk):
    from comercial.models import Cliente
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para crear casos jurídicos.')
        return redirect('comercial_lista')

    cliente = get_object_or_404(Cliente, pk=cliente_pk)

    if request.method == 'POST':
        tipo = request.POST.get('tipo_proceso', 'OTRO')
        titulo = request.POST.get('titulo', f'{cliente.nombre} - {dict(CasoJuridico._meta.get_field("tipo_proceso").flatchoices).get(tipo, tipo)}')
        caso = CasoJuridico.objects.create(
            cliente=cliente,
            tipo_proceso=tipo,
            titulo=titulo,
            abogado_asignado=get_least_loaded_lawyer(),
            demandante_accionante=cliente.nombre,
            descripcion_caso=request.POST.get('descripcion_caso', ''),
            habilitado_modulo_juridico=True,
        )
        messages.success(request, f'Caso jurídico "{caso.titulo}" creado correctamente.')
        return redirect('comercial_detalle_cliente', pk=cliente_pk)

    messages.error(request, 'Método no permitido.')
    return redirect('comercial_detalle_cliente', pk=cliente_pk)


@login_required
def editar_caso_view(request, pk):
    caso = get_object_or_404(CasoJuridico, pk=pk)

    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para editar este caso.')
        return redirect('procesos_detalle', pk=pk)

    if request.method == 'POST':
        simple_fields = [
            'titulo', 'tipo_proceso', 'prioridad', 'estado',
            'radicado_externo', 'etapa_actual',
            'demandante_accionante', 'demandado_accionado',
            'juzgado_entidad', 'descripcion_caso', 'notas_adicionales',
            'url_sharepoint',
        ]
        for fname in simple_fields:
            val = request.POST.get(fname)
            if val is not None:
                if val == '' and CasoJuridico._meta.get_field(fname).null:
                    setattr(caso, fname, None)
                else:
                    setattr(caso, fname, val)

        bool_fields = ['contrato_autenticado_recibido', 'habilitado_modulo_juridico']
        for fname in bool_fields:
            setattr(caso, fname, request.POST.get(fname) == 'on')

        date_fields = ['fecha_inicio', 'proximo_vencimiento']
        for fname in date_fields:
            val = request.POST.get(fname)
            if val:
                setattr(caso, fname, val)
            else:
                setattr(caso, fname, None)

        abogado_id = request.POST.get('abogado_asignado')
        if abogado_id:
            caso.abogado_asignado = get_object_or_404(User, pk=abogado_id)
        else:
            caso.abogado_asignado = None

        caso.save()
        messages.success(request, 'Caso jurídico actualizado correctamente.')
        return redirect('procesos_detalle', pk=pk)

    abogados = User.objects.filter(is_active=True, role='ABOGADO').order_by('first_name')
    return render(request, 'procesos/editar_caso.html', {'caso': caso, 'abogados': abogados})


@login_required
@require_POST
def crear_proceso_interno(request, caso_pk):
    if efective_role(request.user) not in ['ADMIN', 'ABOGADO']:
        messages.error(request, 'No tienes permisos para crear procesos internos.')
        return redirect('procesos_detalle', pk=caso_pk)

    caso = get_object_or_404(CasoJuridico, pk=caso_pk)
    tipo = request.POST.get('tipo', 'OTRO')
    titulo = request.POST.get('titulo', '').strip() or f'{dict(ProcesoInterno._meta.get_field("tipo").flatchoices).get(tipo, tipo)} - {caso.titulo}'

    ProcesoInterno.objects.create(
        caso=caso,
        tipo=tipo,
        titulo=titulo,
        fecha_inicio=request.POST.get('fecha_inicio') or None,
        descripcion=request.POST.get('descripcion', ''),
        precio=request.POST.get('precio') or None,
        abogado=get_least_loaded_lawyer(),
    )

    messages.success(request, f'Proceso interno "{titulo}" creado correctamente.')
    return redirect('procesos_detalle', pk=caso_pk)


@login_required
@require_POST
def cambiar_estado_interno(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Permiso denegado.'}, status=403)

    proc = get_object_or_404(ProcesoInterno, pk=pk)
    nuevo_estado = request.POST.get('estado')
    estados_validos = dict(ProcesoInterno._meta.get_field('estado').flatchoices)
    error = None

    if nuevo_estado not in estados_validos:
        error = 'Estado inválido.'
    elif proc.estado in ('RESUELTO', 'ARCHIVADO') and nuevo_estado != proc.estado:
        error = f'El proceso está "{proc.get_estado_display()}" y no puede cambiar de estado.'
    elif nuevo_estado == 'RESUELTO' and not proc.fecha_resolucion:
        proc.fecha_resolucion = timezone.localdate()

    if error:
        if request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': error}, status=400)
        messages.error(request, error)
        return redirect('procesos_detalle', pk=proc.caso_id)

    proc.estado = nuevo_estado
    proc.save()
    display = proc.get_estado_display()
    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'estado': nuevo_estado, 'display': display})
    messages.success(request, f'Estado actualizado a {display}.')
    return redirect('procesos_detalle', pk=proc.caso_id)


@login_required
@require_POST
def subir_documento(request):
    if efective_role(request.user) not in ['ADMIN', 'ABOGADO', 'COMERCIAL']:
        return JsonResponse({'error': 'Permiso denegado.'}, status=403)

    caso_pk = request.POST.get('caso_id')
    interno_pk = request.POST.get('proceso_interno_id')
    archivo = request.FILES.get('archivo')
    nombre = request.POST.get('nombre', '').strip() or (archivo.name if archivo else 'Documento')
    descripcion = request.POST.get('descripcion', '')

    if not archivo:
        messages.error(request, 'Debes seleccionar un archivo.')
        caso_pk = caso_pk or interno_pk
        if caso_pk:
            return redirect('procesos_detalle', pk=caso_pk)
        return redirect('procesos_lista')

    kwargs = {'subido_por': request.user, 'archivo': archivo, 'nombre': nombre, 'descripcion': descripcion}
    if caso_pk:
        kwargs['caso_id'] = caso_pk
        destino_pk = caso_pk
    elif interno_pk:
        pi = get_object_or_404(ProcesoInterno, pk=interno_pk)
        kwargs['proceso_interno_id'] = interno_pk
        destino_pk = pi.caso_id
    else:
        messages.error(request, 'Debes especificar el caso o proceso interno.')
        return redirect('procesos_lista')

    Documento.objects.create(**kwargs)
    messages.success(request, f'Documento "{nombre}" subido correctamente.')
    return redirect('procesos_detalle', pk=destino_pk)


@login_required
@require_POST
def eliminar_documento(request, pk):
    doc = get_object_or_404(Documento, pk=pk)
    caso_id = doc.caso_id or doc.proceso_interno.caso_id
    doc.archivo.delete(save=False)
    doc.delete()
    messages.success(request, 'Documento eliminado.')
    return redirect('procesos_detalle', pk=caso_id)


@login_required
def calendario_view(request):
    today = timezone.localdate()
    year = int(request.GET.get('year', today.year))
    month = int(request.GET.get('month', today.month))

    # Clamp month
    if month < 1:
        month = 1
        year -= 1
    elif month > 12:
        month = 12
        year += 1

    prev_month = month - 1
    prev_year = year
    if prev_month < 1:
        prev_month = 12
        prev_year -= 1

    next_month = month + 1
    next_year = year
    if next_month > 12:
        next_month = 1
        next_year += 1

    # Gather events — consolidate queries with .only() to fetch only needed fields
    events = []

    # CasoJuridico.proximo_vencimiento
    for caso in CasoJuridico.objects.filter(
        proximo_vencimiento__year=year, proximo_vencimiento__month=month
    ).only('pk', 'titulo', 'proximo_vencimiento').iterator():
        events.append({
            'date': caso.proximo_vencimiento,
            'title': f"Vence: {caso.titulo}",
            'type': 'vencimiento',
            'url': f"/procesos/{caso.pk}/",
        })

    # Proceso.fecha_vencimiento
    for proc in Proceso.objects.filter(
        fecha_vencimiento__year=year, fecha_vencimiento__month=month
    ).only('pk', 'nombre', 'fecha_vencimiento', 'cliente__nombre').select_related('cliente').iterator():
        label = proc.cliente.nombre if proc.cliente else proc.nombre
        events.append({
            'date': proc.fecha_vencimiento,
            'title': f"Vence proceso: {label}",
            'type': 'vencimiento',
            'url': None,
        })

    # ProcesoInterno — single query with OR for all 3 date fields
    pis_internos = ProcesoInterno.objects.filter(
        Q(fecha_vencimiento__year=year, fecha_vencimiento__month=month) |
        Q(fecha_inicio__year=year, fecha_inicio__month=month) |
        Q(fecha_resolucion__year=year, fecha_resolucion__month=month)
    ).only('pk', 'codigo_interno', 'titulo', 'caso_id',
           'fecha_vencimiento', 'fecha_inicio', 'fecha_resolucion').select_related('caso').iterator()

    for pi in pis_internos:
        if pi.fecha_vencimiento and pi.fecha_vencimiento.year == year and pi.fecha_vencimiento.month == month:
            events.append({
                'date': pi.fecha_vencimiento,
                'title': f"Vence PI: {pi.codigo_interno} {pi.titulo}",
                'type': 'vencimiento',
                'url': None,
            })
        if pi.fecha_inicio and pi.fecha_inicio.year == year and pi.fecha_inicio.month == month:
            events.append({
                'date': pi.fecha_inicio,
                'title': f"Inicia: {pi.titulo}",
                'type': 'inicio',
                'url': f"/procesos/{pi.caso_id}/",
            })
        if pi.fecha_resolucion and pi.fecha_resolucion.year == year and pi.fecha_resolucion.month == month:
            events.append({
                'date': pi.fecha_resolucion,
                'title': f"Resuelve: {pi.titulo}",
                'type': 'resolucion',
                'url': f"/procesos/{pi.caso_id}/",
            })

    # Factura.fecha_vencimiento
    try:
        from tesoreria.models import Factura
        for fac in Factura.objects.filter(
            fecha_vencimiento__year=year, fecha_vencimiento__month=month,
            estado__in=['PENDIENTE', 'EMITIDA', 'PAGO_PARCIAL'],
        ).only('pk', 'saldo_pendiente', 'fecha_vencimiento',
               'cliente__nombre', 'numero').select_related('cliente').iterator():
            events.append({
                'date': fac.fecha_vencimiento,
                'title': f"Factura: ${fac.saldo_pendiente:,.0f} {fac.cliente.nombre if fac.cliente else ''}",
                'type': 'factura',
                'url': None,
            })
    except ImportError:
        pass

    # Actuacion.fecha
    for act in Actuacion.objects.filter(
        fecha__year=year, fecha__month=month
    ).only('pk', 'fecha', 'descripcion').iterator():
        desc = (act.descripcion[:57] + '...') if len(act.descripcion) > 60 else act.descripcion
        events.append({
            'date': act.fecha,
            'title': f"Actuación: {desc}",
            'type': 'actuacion',
            'url': None,
        })

    # Build calendar grid
    cal = calendar.Calendar()
    weeks = cal.monthdayscalendar(year, month)
    month_name = calendar.month_name[month]

    # Serialize events for template and JS
    events_list = []
    events_json = []
    for e in events:
        events_list.append(e)
        events_json.append({
            'date': e['date'].isoformat(),
            'title': e['title'],
            'type': e['type'],
            'url': e['url'] or '',
        })
    events_json_str = json.dumps(events_json)

    return render(request, 'procesos/calendario.html', {
        'year': year,
        'month': month,
        'month_name': month_name,
        'weeks': weeks,
        'events_list': events_list,
        'events_json': events_json_str,
        'prev_year': prev_year,
        'prev_month': prev_month,
        'next_year': next_year,
        'next_month': next_month,
        'today': today,
        'today_str': today.isoformat(),
    })


@login_required
def directorio_entidades(request):
    q = request.GET.get('q', '').strip()
    entidades = Entidad.objects.all()
    if q:
        entidades = entidades.filter(Q(razon_social__icontains=q) | Q(nit__icontains=q))
    total = entidades.count()
    return render(request, 'procesos/directorio_entidades.html', {
        'entidades': entidades,
        'total': total,
        'q': q,
        'complejidades': ComplejidadEntidad.choices,
    })


@login_required
@require_POST
def crear_entidad(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    e = Entidad.objects.create(
        razon_social=request.POST.get('razon_social', ''),
        nit=request.POST.get('nit', ''),
        complejidad=request.POST.get('complejidad', ''),
        emails=request.POST.get('emails', ''),
        notas=request.POST.get('notas', ''),
    )
    if request.FILES.get('archivo'):
        e.archivo = request.FILES['archivo']
        e.save(update_fields=['archivo'])
    return JsonResponse({'success': True, 'entidad': {
        'id': e.pk,
        'razon_social': e.razon_social,
        'nit': e.nit,
        'complejidad': e.get_complejidad_display() if e.complejidad else '—',
        'emails': e.emails,
        'notas': e.notas or '—',
        'fecha_registro': e.fecha_registro.strftime('%d/%m/%Y'),
    }})


@login_required
@require_POST
def editar_entidad(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    e = get_object_or_404(Entidad, pk=pk)
    e.razon_social = request.POST.get('razon_social', e.razon_social)
    e.nit = request.POST.get('nit', e.nit)
    e.complejidad = request.POST.get('complejidad', e.complejidad)
    e.emails = request.POST.get('emails', e.emails)
    e.notas = request.POST.get('notas', e.notas)
    if request.FILES.get('archivo'):
        e.archivo = request.FILES['archivo']
    e.save()
    return JsonResponse({'success': True})


@login_required
@require_POST
def eliminar_entidad(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    e = get_object_or_404(Entidad, pk=pk)
    e.delete()
    return JsonResponse({'success': True})


@login_required
def lista_procesos_internos(request):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        messages.error(request, 'Sin permisos')
        return redirect('dashboard')

    pis = ProcesoInterno.objects.select_related('caso__cliente', 'abogado').all()
    tipo = request.GET.get('tipo', '')
    estado = request.GET.get('estado', '')
    abogado_id = request.GET.get('abogado', '')
    q = request.GET.get('q', '').strip()

    if tipo:
        pis = pis.filter(tipo=tipo)
    if estado:
        pis = pis.filter(estado=estado)
    if abogado_id:
        pis = pis.filter(abogado_id=abogado_id)
    if q:
        pis = pis.filter(Q(titulo__icontains=q) | Q(codigo_interno__icontains=q))

    abogados = User.objects.filter(is_active=True, role='ABOGADO').order_by('first_name')
    paginator = Paginator(pis, 50)
    page_number = request.GET.get('page', 1)
    page_obj = paginator.get_page(page_number)
    qp = request.GET.copy()
    qp.pop('page', None)
    query_params = '&' + qp.urlencode() if qp else ''
    return render(request, 'procesos/lista_internos.html', {
        'procesos_internos': page_obj,
        'abogados': abogados,
        'tipo_choices': TipoProcesoInterno.choices,
        'estado_choices': EstadoInterno.choices,
        'filtro_tipo': tipo,
        'filtro_estado': estado,
        'filtro_abogado': abogado_id,
        'q': q,
        'today': timezone.localdate(),
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
    })


@login_required
def detalle_proceso_interno(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO', 'COLABORADOR']:
        messages.error(request, 'Sin permisos')
        return redirect('dashboard')
    pi = get_object_or_404(
        ProcesoInterno.objects.select_related('caso__cliente', 'abogado', 'caso__proceso'),
        pk=pk
    )
    documentos = Documento.objects.filter(proceso_interno=pi).order_by('-fecha_subida')
    return render(request, 'procesos/detalle_interno.html', {
        'pi': pi,
        'documentos': documentos,
        'abogados': User.objects.filter(is_active=True, role='ABOGADO').order_by('first_name'),
        'tipo_choices': TipoProcesoInterno.choices,
        'estado_choices': EstadoInterno.choices,
    })


@login_required
@require_POST
def editar_proceso_interno(request, pk):
    if efective_role(request.user) not in ['ADMIN', 'COMERCIAL', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)
    pi = get_object_or_404(ProcesoInterno, pk=pk)

    # If this is a fetch request, return current data
    if request.POST.get('_fetch') == '1':
        return JsonResponse({'success': True, 'pi': {
            'titulo': pi.titulo,
            'tipo': pi.tipo,
            'estado': pi.estado,
            'fecha_inicio': pi.fecha_inicio.isoformat() if pi.fecha_inicio else '',
            'fecha_vencimiento': pi.fecha_vencimiento.isoformat() if pi.fecha_vencimiento else '',
            'fecha_resolucion': pi.fecha_resolucion.isoformat() if pi.fecha_resolucion else '',
            'descripcion': pi.descripcion,
            'resultado': pi.resultado,
            'precio': str(pi.precio) if pi.precio else '',
            'abogado_id': str(pi.abogado_id) if pi.abogado_id else '',
        }})

    pi.titulo = request.POST.get('titulo', pi.titulo)
    pi.tipo = request.POST.get('tipo', pi.tipo)
    pi.estado = request.POST.get('estado', pi.estado)
    pi.descripcion = request.POST.get('descripcion', pi.descripcion)
    pi.resultado = request.POST.get('resultado', pi.resultado)
    precio_raw = request.POST.get('precio')
    pi.precio = Decimal(precio_raw) if precio_raw else None
    for f in ['fecha_inicio', 'fecha_vencimiento', 'fecha_resolucion']:
        v = request.POST.get(f)
        setattr(pi, f, v or None)
    abog_id = request.POST.get('abogado')
    if abog_id:
        pi.abogado = get_object_or_404(User, pk=abog_id)
    else:
        pi.abogado = None
    pi.save()
    return JsonResponse({'success': True})


@login_required
@require_POST
def crear_servicio_desde_proceso(request, proceso_pk):
    """Crea un ProcesoInterno directamente desde un Proceso,
    auto-creando el CasoJuridico si no existe."""
    if efective_role(request.user) not in ['ADMIN', 'ABOGADO']:
        return JsonResponse({'success': False, 'error': 'Sin permisos'}, status=403)

    proceso = get_object_or_404(Proceso, pk=proceso_pk)
    cliente = proceso.cliente

    if not cliente:
        return JsonResponse({'success': False, 'error': 'El proceso no tiene cliente asignado'})

    # Auto-crear CasoJuridico si no existe
    caso = CasoJuridico.objects.filter(proceso=proceso, cliente=cliente).first()
    if not caso:
        abogado = get_least_loaded_lawyer()
        caso = CasoJuridico.objects.create(
            proceso=proceso,
            cliente=cliente,
            abogado_asignado=abogado,
            tipo_proceso=proceso.tipo_servicio or 'OTRO',
            titulo=f'Servicios - {proceso.tipo_servicio_display} ({cliente.nombre})',
            prioridad='MEDIA',
        )

    tipo = request.POST.get('tipo', 'OTRO')
    titulo = request.POST.get('titulo', '').strip() or f'Servicio {tipo}'
    precio = request.POST.get('precio')

    pi = ProcesoInterno.objects.create(
        caso=caso,
        tipo=tipo,
        titulo=titulo,
        fecha_inicio=request.POST.get('fecha_inicio') or None,
        descripcion=request.POST.get('descripcion', ''),
        precio=precio or None,
        abogado=get_least_loaded_lawyer(),
    )

    return JsonResponse({
        'success': True,
        'pi_id': pi.pk,
        'pi_titulo': pi.titulo,
        'pi_precio': str(pi.precio) if pi.precio else '0',
    })


@login_required
def servicios_listos_para_facturar(request, proceso_pk):
    """Retorna los ProcesosInternos RESUELTOS de un Proceso que aún no se han facturado."""
    proceso = get_object_or_404(Proceso, pk=proceso_pk)
    casos = CasoJuridico.objects.filter(proceso=proceso)
    pis = ProcesoInterno.objects.filter(
        caso__in=casos,
        estado='RESUELTO',
    ).exclude(
        items_factura__isnull=False
    ).select_related('caso').order_by('-fecha_resolucion')

    data = [{
        'id': pi.pk,
        'codigo': pi.codigo_interno or '',
        'titulo': pi.titulo,
        'tipo': pi.get_tipo_display(),
        'precio': str(pi.precio or 0),
        'fecha_resolucion': pi.fecha_resolucion.isoformat() if pi.fecha_resolucion else '',
    } for pi in pis]

    return JsonResponse({'success': True, 'servicios': data})


@login_required
def reasignacion_abogados(request):
    """Req 18: revisar la asignación procesos-casos a abogados y permitir
    reasignar masiva o individualmente (por salida de un abogado, etc.)."""
    if efective_role(request.user) not in ['ADMIN']:
        messages.error(request, 'Solo los administradores pueden reasignar abogados.')
        return redirect('dashboard')

    abogados = User.objects.filter(role='ABOGADO', is_active=True).annotate(
        num_casos=Count('casos_asignados'),
        num_internos=Count('procesos_internos'),
    ).order_by('num_casos')

    status = None
    if request.method == 'POST':
        accion = request.POST.get('accion')
        from_abogado_id = request.POST.get('from_abogado')
        to_abogado_id = request.POST.get('to_abogado')
        caso_id = request.POST.get('caso_id')

        if not to_abogado_id:
            messages.error(request, 'Debe seleccionar el abogado destino.')
            return redirect('reasignacion_abogados')
        to_abogado = get_object_or_404(User, pk=to_abogado_id, role='ABOGADO')

        if accion == 'masiva' and from_abogado_id:
            from_abogado = get_object_or_404(User, pk=from_abogado_id, role='ABOGADO')
            cont = CasoJuridico.objects.filter(abogado_asignado=from_abogado).update(abogado_asignado=to_abogado)
            ProcesoInterno.objects.filter(abogado=from_abogado).update(abogado=to_abogado)
            status = f'Se reasignaron {cont} caso(s) de "{from_abogado.get_full_name() or from_abogado.username}" a "{to_abogado.get_full_name() or to_abogado.username}".'
        elif accion == 'individual' and caso_id:
            caso = get_object_or_404(CasoJuridico, pk=caso_id)
            nombre = caso.abogado_asignado.get_full_name() or caso.abogado_asignado.username if caso.abogado_asignado else '—'
            caso.abogado_asignado = to_abogado
            caso.save()
            status = f'Caso "{caso.titulo}" reasignado de "{nombre}" a "{to_abogado.get_full_name() or to_abogado.username}".'
        else:
            messages.error(request, 'Acción inválida.')
        if status:
            messages.success(request, status)

    # Lista de casos para reasignación individual
    casos = CasoJuridico.objects.select_related('cliente', 'abogado_asignado').order_by('abogado_asignado__first_name')

    return render(request, 'procesos/reasignar_abogados.html', {
        'abogados': abogados,
        'casos': casos,
    })
