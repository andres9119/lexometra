import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.db.models import Sum, Q, Count, OuterRef, Subquery
from django.core.paginator import Paginator
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponse
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from .models import Factura, FacturaItem, Pago, Egreso, NotaCreditoDebito, ProveedorFacturacion
from comercial.models import Cliente
from procesos.models import Proceso, CasoJuridico, ProcesoInterno
from .services import factus as factus_service
from usuarios.mixins import rol_requerido


def _facturas_base(request):
    qs = Factura.objects.select_related('cliente').all()
    estado = request.GET.get('estado')
    q = request.GET.get('q')
    if estado:
        qs = qs.filter(estado=estado)
    if q:
        qs = qs.filter(
            Q(numero__icontains=q) |
            Q(cliente__nombre__icontains=q) |
            Q(cliente__identificacion__icontains=q)
        )
    return qs


@rol_requerido('ADMIN', 'COMERCIAL')
def panel_facturacion_view(request):
    facturas = _facturas_base(request)
    # Los totales reflejan solo facturas reales (excluye borrador/anuladas/rechazadas)
    emitidas = facturas.exclude(
        estado__in=['BORRADOR', 'ANULADA', 'RECHAZADA']
    )
    totales = emitidas.aggregate(
        total_facturado=Sum('total'),
        total_recaudado=Sum('valor_pagado'),
    )
    total_facturado = totales['total_facturado'] or 0
    total_recaudado = totales['total_recaudado'] or 0
    por_cobrar = total_facturado - total_recaudado
    vencidas = emitidas.filter(estado='VENCIDA').count()
    pct = round((total_recaudado / total_facturado * 100), 1) if total_facturado else 0

    query_params = f"&q={request.GET.get('q', '')}&estado={request.GET.get('estado', '')}"
    paginator = Paginator(facturas, 50)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'facturas': page_obj,
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
        'total_facturado': total_facturado,
        'total_recaudado': total_recaudado,
        'por_cobrar': por_cobrar,
        'vencidas': vencidas,
        'pct_recaudo': pct,
        'seccion_activa': 'facturacion',
        'estado_activo': request.GET.get('estado', ''),
        'q': request.GET.get('q', ''),
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def cartera_view(request):
    facturas = Factura.objects.select_related('cliente').filter(
        Q(estado__in=['EMITIDA', 'PENDIENTE', 'PAGO_PARCIAL', 'VENCIDA'])
    )
    totales = facturas.aggregate(
        total_pendiente=Sum('saldo_pendiente'),
        total_facturado=Sum('total'),
        count=Count('id'),
    )
    vencidas = facturas.filter(estado='VENCIDA').aggregate(
        total=Sum('saldo_pendiente'), count=Count('id')
    )

    query_params = ""
    paginator = Paginator(facturas, 50)
    page_obj = paginator.get_page(request.GET.get('page'))

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'facturas': page_obj,
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': query_params,
        'total_pendiente': totales['total_pendiente'] or 0,
        'total_cartera': totales['total_facturado'] or 0,
        'total_facturas': totales['count'] or 0,
        'vencidas_total': vencidas['total'] or 0,
        'vencidas_count': vencidas['count'] or 0,
        'seccion_activa': 'cartera',
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def tesoreria_view(request):
    # Ingresos reales: solo pagos de facturas no anuladas ni rechazadas
    pagos_validos = Pago.objects.exclude(
        factura__estado__in=['ANULADA', 'RECHAZADA']
    )
    ingresos = pagos_validos.aggregate(total=Sum('valor'))['total'] or 0
    egresos = Egreso.objects.aggregate(total=Sum('valor'))['total'] or 0
    balance = ingresos - egresos

    ingresos_mes = pagos_validos.filter(
        fecha__year=date.today().year, fecha__month=date.today().month
    ).aggregate(total=Sum('valor'))['total'] or 0
    egresos_mes = Egreso.objects.filter(
        fecha__year=date.today().year, fecha__month=date.today().month
    ).aggregate(total=Sum('valor'))['total'] or 0

    ultimos_ingresos = pagos_validos.select_related('factura', 'factura__cliente').order_by('-fecha')[:10]
    ultimos_egresos = Egreso.objects.order_by('-fecha')[:10]
    egresos_por_categoria = Egreso.objects.values('categoria').annotate(
        total=Sum('valor')
    ).order_by('-total')

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'ingresos': ingresos,
        'egresos': egresos,
        'balance': balance,
        'ingresos_mes': ingresos_mes,
        'egresos_mes': egresos_mes,
        'ultimos_ingresos': ultimos_ingresos,
        'ultimos_egresos': ultimos_egresos,
        'egresos_por_categoria': egresos_por_categoria,
        'seccion_activa': 'tesoreria',
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def reportes_view(request):
    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'reportes',
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def notas_view(request):
    notas = NotaCreditoDebito.objects.select_related('factura', 'factura__cliente').all()
    paginator = Paginator(notas, 50)
    page_obj = paginator.get_page(request.GET.get('page'))
    return render(request, 'tesoreria/panel_tesoreria.html', {
        'notas': page_obj,
        'paginator': paginator,
        'page_obj': page_obj,
        'query_params': "",
        'seccion_activa': 'notas',
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def crear_factura_view(request):
    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        concepto = request.POST.get('concepto', '').strip()
        tipo_servicio = request.POST.get('tipo_servicio', '')
        termino_pago = request.POST.get('termino_pago', 'CONTADO')
        notas_internas = request.POST.get('notas_internas', '')
        proceso_id = request.POST.get('proceso_id') or None
        caso_id = request.POST.get('caso_id') or None
        descuento = Decimal(request.POST.get('descuento', '0'))

        if not cliente_id or not concepto:
            messages.error(request, 'Cliente y concepto son obligatorios.')
            return redirect('tesoreria_panel')

        cliente = get_object_or_404(Cliente, pk=cliente_id)

        from datetime import timedelta
        term_map = {'CONTADO': 0, '15_DIAS': 15, '30_DIAS': 30, '45_DIAS': 45, '60_DIAS': 60}
        dias = term_map.get(termino_pago, 0)
        hoy = date.today()
        vencimiento = hoy + timedelta(days=dias)

        kwargs = {}
        if proceso_id:
            kwargs['proceso_id'] = proceso_id
        if caso_id:
            kwargs['caso_id'] = caso_id

        factura = Factura.objects.create(
            cliente=cliente,
            concepto=concepto,
            tipo_servicio=tipo_servicio,
            termino_pago=termino_pago,
            fecha_emision=hoy,
            fecha_vencimiento=vencimiento,
            descuento=descuento,
            notas_internas=notas_internas,
            creado_por=request.user,
            **kwargs,
        )

        items_desc = request.POST.getlist('item_descripcion[]')
        items_cant = request.POST.getlist('item_cantidad[]')
        items_valor = request.POST.getlist('item_valor_unitario[]')
        items_iva_pct = request.POST.getlist('item_iva_porcentaje[]')

        for i in range(len(items_desc)):
            desc = items_desc[i].strip()
            if not desc:
                continue
            cant = Decimal(items_cant[i]) if items_cant[i] else Decimal('1')
            val = Decimal(items_valor[i]) if items_valor[i] else Decimal('0')
            iva_pct = Decimal(items_iva_pct[i]) if i < len(items_iva_pct) and items_iva_pct[i] else Decimal('19.00')
            FacturaItem.objects.create(
                factura=factura,
                descripcion=desc,
                cantidad=cant,
                valor_unitario=val,
                iva_porcentaje=iva_pct,
            )

        items_qs = factura.items.all()
        subtotal_calc = sum(i.subtotal for i in items_qs)
        iva_calc = sum(i.iva_valor for i in items_qs)
        factura.subtotal = subtotal_calc
        factura.iva = iva_calc
        factura.total = subtotal_calc + iva_calc - descuento
        factura.save()

        messages.success(request, f'Factura {factura.numero} creada correctamente.')
        return redirect('tesoreria_panel')

    clientes = Cliente.objects.all().order_by('nombre')
    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'facturacion',
        'modo_creacion': True,
        'clientes': clientes,
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def detalle_factura_view(request, pk):
    factura = get_object_or_404(
        Factura.objects.select_related('cliente', 'proceso', 'caso', 'creado_por').prefetch_related('items', 'pagos', 'notas'),
        pk=pk,
    )
    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'facturacion',
        'modo_detalle': True,
        'factura': factura,
    })


@rol_requerido('ADMIN', 'COMERCIAL')
def editar_factura_view(request, pk):
    factura = get_object_or_404(Factura, pk=pk)
    if request.method == 'POST':
        factura.concepto = request.POST.get('concepto', factura.concepto)
        factura.tipo_servicio = request.POST.get('tipo_servicio', factura.tipo_servicio)
        factura.termino_pago = request.POST.get('termino_pago', factura.termino_pago)
        fecha_emision = request.POST.get('fecha_emision')
        fecha_vencimiento = request.POST.get('fecha_vencimiento')
        if fecha_emision:
            factura.fecha_emision = fecha_emision
        if fecha_vencimiento:
            factura.fecha_vencimiento = fecha_vencimiento
        factura.notas_internas = request.POST.get('notas_internas', '')
        factura.save()
        messages.success(request, 'Factura actualizada.')
        return redirect('tesoreria_detalle', pk=pk)

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'facturacion',
        'modo_editar': True,
        'factura': factura,
    })


@rol_requerido('ADMIN', 'COMERCIAL')
@require_POST
def anular_factura_view(request, pk):
    factura = get_object_or_404(Factura, pk=pk)
    anulables = (
        Factura.Estados.BORRADOR,
        Factura.Estados.RECHAZADA,
        Factura.Estados.PENDIENTE,
    )
    if factura.estado not in anulables:
        messages.error(
            request,
            'Solo se pueden anular facturas en estado Borrador, Rechazada o Pendiente. '
            'Una factura emitida o con pagos debe gestionarse con nota crédito.',
        )
        return redirect('tesoreria_detalle', pk=pk)
    factura.estado = Factura.Estados.ANULADA
    factura.save()
    messages.success(request, f'Factura {factura.numero} anulada.')
    return redirect('tesoreria_panel')


@rol_requerido('ADMIN', 'COMERCIAL')
@require_POST
def emitir_factura_view(request, pk):
    """Envía una factura a Factus para su validación y emisión ante la DIAN."""
    factura = get_object_or_404(
        Factura.objects.select_related('proveedor_facturacion').prefetch_related('items'),
        pk=pk,
    )

    if factura.estado not in ('BORRADOR', 'RECHAZADA'):
        messages.error(request, 'Solo se pueden emitir facturas en estado Borrador o Rechazada.')
        return redirect('tesoreria_detalle', pk=pk)

    proveedor = ProveedorFacturacion.objects.filter(activo=True).first()
    if not proveedor:
        messages.error(request, 'No hay un proveedor de facturación activo. Configúralo en el panel de administración.')
        return redirect('tesoreria_detalle', pk=pk)

    factura.proveedor_facturacion = proveedor
    factura.save(update_fields=['proveedor_facturacion'])

    resultado = factus_service.emitir_factura(factura)

    if resultado['success']:
        messages.success(
            request,
            f'Factura {factura.numero} emitida exitosamente. CUFE: {resultado.get("cufe", "")}',
        )
    else:
        messages.error(
            request,
            f'Error al emitir factura {factura.numero}: {resultado.get("error", "Error desconocido")}',
        )

    return redirect('tesoreria_detalle', pk=pk)


@rol_requerido('ADMIN', 'COMERCIAL')
def consultar_estado_dian_view(request, pk):
    """Consulta el estado de una factura en Factus/DIAN."""
    factura = get_object_or_404(Factura.objects.select_related('proveedor_facturacion'), pk=pk)

    if not factura.proveedor_facturacion:
        messages.warning(request, 'Esta factura no tiene un proveedor de facturación asignado.')
        return redirect('tesoreria_detalle', pk=pk)

    resultado = factus_service.consultar_estado(factura)

    if resultado['success']:
        data = resultado['data']
        factura.respuesta_dian = json.dumps(data)
        factura.save(update_fields=['respuesta_dian'])
        messages.success(request, 'Estado consultado correctamente.')
    else:
        messages.error(request, f'Error al consultar estado: {resultado.get("error")}')

    return redirect('tesoreria_detalle', pk=pk)


@rol_requerido('ADMIN', 'COMERCIAL')
def descargar_xml_factus_view(request, pk):
    """Descarga el XML de una factura emitida desde Factus."""
    factura = get_object_or_404(Factura, pk=pk)

    if not factura.cufe:
        messages.warning(request, 'Esta factura no tiene CUFE. Debe ser emitida primero.')
        return redirect('tesoreria_detalle', pk=pk)

    xml_bytes = factus_service.descargar_xml(factura)
    if xml_bytes:
        response = HttpResponse(xml_bytes, content_type='application/xml')
        response['Content-Disposition'] = f'attachment; filename="factura_{factura.numero}.xml"'
        return response

    messages.error(request, 'No se pudo descargar el XML desde Factus.')
    return redirect('tesoreria_detalle', pk=pk)


@rol_requerido('ADMIN', 'COMERCIAL')
def descargar_pdf_factus_view(request, pk):
    """Descarga el PDF oficial de una factura emitida desde Factus."""
    factura = get_object_or_404(Factura, pk=pk)

    if not factura.cufe:
        messages.warning(request, 'Esta factura no tiene CUFE. Debe ser emitida primero.')
        return redirect('tesoreria_detalle', pk=pk)

    pdf_bytes = factus_service.descargar_pdf(factura)
    if pdf_bytes:
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="factura_{factura.numero}_dian.pdf"'
        return response

    messages.error(request, 'No se pudo descargar el PDF desde Factus.')
    return redirect('tesoreria_detalle', pk=pk)


@rol_requerido('ADMIN', 'COMERCIAL')
def listar_factus_view(request):
    """Lista facturas emitidas en Factus con filtros."""
    proveedor = ProveedorFacturacion.objects.filter(activo=True).first()
    factus_list = None
    pagination = None

    if proveedor:
        filtros = {}
        for k in ('identification', 'names', 'number', 'prefix', 'reference_code', 'status'):
            v = request.GET.get(k)
            if v:
                filtros[k] = v
        page = request.GET.get('page', 1)
        resultado = factus_service.listar_facturas(proveedor, filtros=filtros, page=page)
        if resultado['success']:
            raw = resultado['data']
            if isinstance(raw, dict):
                factus_list = raw.get('data', raw.get('bills', []))
                pagination = {k: v for k, v in raw.items() if k not in ('data', 'bills')}
            elif isinstance(raw, list):
                factus_list = raw
                pagination = {}
            else:
                factus_list = []
                pagination = {}
            if isinstance(factus_list, list):
                for item in factus_list:
                    if isinstance(item, dict) and not isinstance(item.get('customer'), dict):
                        item['customer'] = {}
        else:
            messages.error(request, f'Error al consultar Factus: {resultado.get("error")}')

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'factus_list',
        'factus_list': factus_list,
        'pagination': pagination,
        'proveedor': proveedor,
    })


@rol_requerido('ADMIN', 'COMERCIAL')
@require_POST
def eliminar_en_factus_view(request, pk):
    """Elimina una factura en Factus por reference_code (solo si NO está validada por DIAN)."""
    factura = get_object_or_404(Factura, pk=pk)

    if factura.estado not in ('PENDIENTE', 'RECHAZADA'):
        messages.error(request, 'Solo se pueden eliminar en Factus facturas en estado Pendiente o Rechazada.')
        return redirect('tesoreria_detalle', pk=pk)

    if not factura.proveedor_facturacion:
        messages.error(request, 'Esta factura no tiene un proveedor de facturación asignado.')
        return redirect('tesoreria_detalle', pk=pk)

    resultado = factus_service.eliminar_en_factus(factura)

    if resultado['success']:
        factura.estado = Factura.Estados.BORRADOR
        factura.cufe = ''
        factura.numero_factus = ''
        factura.codigo_qr = ''
        factura.respuesta_dian = ''
        factura.fecha_validacion_dian = None
        factura.save(update_fields=[
            'estado', 'cufe', 'numero_factus', 'codigo_qr',
            'respuesta_dian', 'fecha_validacion_dian',
        ])
        messages.success(request, f'Factura {factura.numero} eliminada de Factus. Puedes corregirla y reemitirla.')
    else:
        messages.error(request, f'Error al eliminar en Factus: {resultado.get("error")}')

    return redirect('tesoreria_detalle', pk=pk)


@rol_requerido('ADMIN', 'COMERCIAL')
def registrar_pago_view(request, factura_pk):
    factura = get_object_or_404(Factura, pk=factura_pk)
    if request.method == 'POST':
        valor = Decimal(request.POST.get('valor', '0'))
        metodo = request.POST.get('metodo', 'TRANSFERENCIA')
        referencia = request.POST.get('referencia', '')
        observaciones = request.POST.get('observaciones', '')
        fecha_pago = request.POST.get('fecha', date.today())

        if valor <= 0:
            messages.error(request, 'El valor del pago debe ser mayor a cero.')
            return redirect('tesoreria_detalle', pk=factura_pk)

        if factura.estado in (Factura.Estados.ANULADA, Factura.Estados.RECHAZADA):
            messages.error(request, 'No se pueden registrar pagos en una factura anulada o rechazada.')
            return redirect('tesoreria_detalle', pk=factura_pk)

        saldo_actual = factura.total - factura.valor_pagado
        if valor > saldo_actual:
            messages.error(
                request,
                f'El pago (${valor:,.0f}) excede el saldo pendiente de la factura '
                f'(${saldo_actual:,.0f}).',
            )
            return redirect('tesoreria_detalle', pk=factura_pk)

        Pago.objects.create(
            factura=factura,
            valor=valor,
            metodo=metodo,
            referencia=referencia,
            observaciones=observaciones,
            fecha=fecha_pago,
            registrado_por=request.user,
        )
        messages.success(request, f'Pago de ${valor:,.0f} registrado en {factura.numero}.')
        return redirect('tesoreria_detalle', pk=factura_pk)

    return redirect('tesoreria_detalle', pk=factura_pk)


@rol_requerido('ADMIN', 'COMERCIAL')
@require_POST
def crear_egreso_view(request):
    concepto = request.POST.get('concepto', '').strip()
    categoria = request.POST.get('categoria', 'OTRO')
    valor = Decimal(request.POST.get('valor', '0'))
    fecha_eg = request.POST.get('fecha', date.today())
    beneficiario = request.POST.get('beneficiario', '')

    if not concepto or valor <= 0:
        messages.error(request, 'Concepto y valor válido son obligatorios.')
        return redirect('tesoreria_tesoreria')

    Egreso.objects.create(
        concepto=concepto,
        categoria=categoria,
        valor=valor,
        fecha=fecha_eg,
        beneficiario=beneficiario,
        registrado_por=request.user,
    )
    messages.success(request, f'Egreso "{concepto}" registrado.')
    return redirect('tesoreria_tesoreria')


@rol_requerido('ADMIN', 'COMERCIAL')
@require_POST
def crear_nota_view(request):
    factura_id = request.POST.get('factura_id')
    tipo = request.POST.get('tipo', 'CREDITO')
    motivo = request.POST.get('motivo', '').strip()
    try:
        valor = Decimal(request.POST.get('valor', '0'))
    except (InvalidOperation, ValueError, TypeError):
        valor = Decimal('0')

    if not factura_id or not motivo:
        messages.error(request, 'Factura y motivo son obligatorios.')
        return redirect('tesoreria_notas')
    if valor <= 0:
        messages.error(request, 'El valor de la nota debe ser mayor que cero.')
        return redirect('tesoreria_notas')

    factura = Factura.objects.filter(pk=factura_id).first()
    if not factura:
        messages.error(request, 'La factura seleccionada no existe.')
        return redirect('tesoreria_notas')
    if factura.estado in ('ANULADA', 'RECHAZADA'):
        messages.error(request, 'No se pueden crear notas sobre una factura anulada o rechazada.')
        return redirect('tesoreria_notas')

    NotaCreditoDebito.objects.create(
        factura=factura,
        tipo=tipo,
        motivo=motivo,
        valor=valor,
        creado_por=request.user,
    )
    messages.success(request, f'Nota {dict(NotaCreditoDebito.Tipo.choices).get(tipo)} creada.')
    return redirect('tesoreria_notas')


@rol_requerido('ADMIN', 'COMERCIAL')
def exportar_pdf_view(request, pk):
    from django.template.loader import render_to_string

    factura = get_object_or_404(
        Factura.objects.select_related('cliente', 'creado_por').prefetch_related('items', 'pagos'),
        pk=pk,
    )
    html = render_to_string('tesoreria/factura_pdf.html', {'factura': factura})

    try:
        from weasyprint import HTML
        pdf = HTML(string=html).write_pdf()
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="factura_{factura.numero}.pdf"'
        return response
    except ImportError:
        messages.warning(request, 'WeasyPrint no está instalido. Se muestra la vista HTML.')
        return HttpResponse(html)


@rol_requerido('ADMIN', 'COMERCIAL')
def json_clientes_view(request):
    q = request.GET.get('q', '')
    clientes = Cliente.objects.filter(
        Q(nombre__icontains=q) | Q(identificacion__icontains=q)
    ).values('id', 'nombre', 'identificacion')[:15]
    return JsonResponse(list(clientes), safe=False)


@rol_requerido('ADMIN', 'COMERCIAL')
def json_procesos_view(request):
    q = request.GET.get('q', '')
    procesos = Proceso.objects.filter(
        Q(nombre__icontains=q) | Q(radicado__icontains=q) | Q(cliente__nombre__icontains=q)
    ).select_related('cliente').values('id', 'nombre', 'radicado', 'cliente__nombre')[:15]
    return JsonResponse(list(procesos), safe=False)


@rol_requerido('ADMIN', 'COMERCIAL')
def json_casos_view(request):
    q = request.GET.get('q', '')
    casos = CasoJuridico.objects.filter(
        Q(titulo__icontains=q) | Q(radicado_externo__icontains=q) | Q(cliente__nombre__icontains=q)
    ).select_related('cliente').values('id', 'titulo', 'radicado_externo', 'cliente__nombre')[:15]
    return JsonResponse(list(casos), safe=False)


@rol_requerido('ADMIN', 'COMERCIAL')
def generar_borrador_desde_pi_view(request):
    if request.method == 'POST':
        cliente_id = request.POST.get('cliente_id')
        concepto = request.POST.get('concepto', '').strip() or 'Honorarios profesionales'
        termino_pago = request.POST.get('termino_pago', 'CONTADO')
        pi_ids = request.POST.getlist('procesos_internos[]')
        descuento = Decimal(request.POST.get('descuento', '0'))

        if not cliente_id or not pi_ids:
            messages.error(request, 'Debe seleccionar cliente y al menos un proceso interno.')
            return redirect('tesoreria_panel')

        cliente = get_object_or_404(Cliente, pk=cliente_id)
        pis = ProcesoInterno.objects.filter(
            id__in=pi_ids,
            caso__cliente=cliente,
            estado='RESUELTO',
        ).exclude(
            items_factura__factura__estado__in=Factura.ESTADOS_ACTIVOS
        ).select_related('caso', 'caso__proceso')

        if not pis:
            messages.error(request, 'Ninguno de los procesos internos seleccionados es válido.')
            return redirect('tesoreria_panel')

        term_map = {'CONTADO': 0, '15_DIAS': 15, '30_DIAS': 30, '45_DIAS': 45, '60_DIAS': 60}
        dias = term_map.get(termino_pago, 0)
        hoy = date.today()
        vencimiento = hoy + timedelta(days=dias)

        first_pi = pis.first()
        caso = first_pi.caso
        proceso = caso.proceso if caso else None

        factura = Factura.objects.create(
            cliente=cliente,
            proceso=proceso,
            caso=caso,
            concepto=concepto,
            tipo_servicio=proceso.tipo_servicio_display if proceso else '',
            termino_pago=termino_pago,
            fecha_emision=hoy,
            fecha_vencimiento=vencimiento,
            descuento=descuento,
            notas_internas=f'Auto-generada desde {pis.count()} proceso(s) interno(s) completado(s)',
            creado_por=request.user,
        )

        for pi in pis:
            precio = pi.precio or Decimal('0')
            FacturaItem.objects.create(
                factura=factura,
                proceso_interno=pi,
                descripcion=f'[{pi.codigo_interno}] {pi.titulo} — {pi.get_tipo_display()}',
                cantidad=1,
                valor_unitario=precio,
            )

        # Calculate totals
        items_qs = factura.items.all()
        subtotal_calc = sum(i.subtotal for i in items_qs)
        iva_calc = sum(i.iva_valor for i in items_qs)
        factura.subtotal = subtotal_calc
        factura.iva = iva_calc
        factura.total = subtotal_calc + iva_calc - Decimal(str(factura.descuento))
        factura.save()

        messages.success(
            request,
            f'Borrador {factura.numero} generado con {pis.count()} ítem(s) '
            f'por ${factura.total:,.0f} (IVA ${factura.iva:,.0f} incluido).'
        )
        return redirect('tesoreria_detalle', pk=factura.pk)

    cliente_id = request.GET.get('cliente_id')
    clientes = Cliente.objects.all().order_by('nombre')
    selected_cliente = None
    pis_disponibles = []

    if cliente_id:
        selected_cliente = get_object_or_404(Cliente, pk=cliente_id)
        pis_disponibles = ProcesoInterno.objects.filter(
            caso__cliente=selected_cliente,
            estado='RESUELTO',
        ).exclude(
            items_factura__factura__estado__in=Factura.ESTADOS_ACTIVOS
        ).select_related('caso', 'caso__proceso').order_by('-fecha_resolucion')

    return render(request, 'tesoreria/panel_tesoreria.html', {
        'seccion_activa': 'facturacion',
        'modo_generar_pi': True,
        'clientes': clientes,
        'selected_cliente': selected_cliente,
        'pis_disponibles': pis_disponibles,
    })
