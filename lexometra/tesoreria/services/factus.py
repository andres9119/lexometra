import base64
import json
import logging
import os
from decimal import Decimal
from datetime import datetime, timedelta, timezone

import requests
from django.utils import timezone as tz

logger = logging.getLogger(__name__)

FACTUS_AUTH_URL = os.getenv("FACTUS_AUTH_URL", "https://api-sandbox.factus.com.co/oauth/token")
FACTUS_API_URL = os.getenv("FACTUS_API_URL", "https://api-sandbox.factus.com.co/v2")


def _save_token(proveedor, token_data):
    cfg = dict(proveedor.configuracion)
    cfg["access_token"] = token_data.get("access_token", "")
    cfg["refresh_token"] = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    cfg["token_expires_at"] = (
        tz.now() + timedelta(seconds=int(expires_in) - 60)
    ).isoformat()
    proveedor.configuracion = cfg
    proveedor.save(update_fields=["configuracion"])
    proveedor.refresh_from_db()


def get_access_token(proveedor, force=False):
    """Retorna access_token válido, usando caché o refresco si es posible.

    Si ``force=True`` omite la caché y pide token nuevo con password.
    """
    cfg = proveedor.configuracion

    # 1. Usar token cacheados si no ha expirado
    if not force:
        token = cfg.get("access_token")
        expires_at = cfg.get("token_expires_at")
        if token and expires_at:
            try:
                if tz.now() < datetime.fromisoformat(expires_at).replace(tzinfo=timezone.utc):
                    return token
            except (ValueError, TypeError):
                pass

        # 2. Intentar refresh_token
        refresh = cfg.get("refresh_token")
        if refresh:
            payload = {
                "grant_type": "refresh_token",
                "client_id": cfg.get("client_id"),
                "client_secret": cfg.get("client_secret"),
                "refresh_token": refresh,
            }
            url = cfg.get("auth_url", FACTUS_AUTH_URL)
            try:
                resp = requests.post(url, data=payload, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    _save_token(proveedor, data)
                    return data.get("access_token")
            except requests.RequestException as e:
                logger.warning(f"Factus refresh token error: {e}")

    # 3. Fallback / force → password grant
    payload = {
        "grant_type": "password",
        "client_id": cfg.get("client_id"),
        "client_secret": cfg.get("client_secret"),
        "username": cfg.get("username"),
        "password": cfg.get("password"),
    }
    url = cfg.get("auth_url", FACTUS_AUTH_URL)
    try:
        resp = requests.post(url, data=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        _save_token(proveedor, data)
        return data.get("access_token")
    except requests.RequestException as e:
        logger.error(f"Factus auth error: {e}")
        return None


def _headers(proveedor):
    token = get_access_token(proveedor)
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _api_base(proveedor):
    return proveedor.configuracion.get("api_url", FACTUS_API_URL)


# Municipios frecuentes → código DIAN (DANE). Si el cliente no coincide se usa
# el de la configuración del proveedor o un default configurable.
MUNICIPIOS_DEFAULT = {
    "medellin": "05001",
    "barranquilla": "08001",
    "bogota": "11001",
    "cali": "76001",
    "cartagena": "13001",
    "santa marta": "47001",
    "bucaramanga": "68001",
    "cucuta": "54001",
    "pereira": "66001",
    "manizales": "17001",
    "ibague": "73001",
    "villavicencio": "50001",
    "monteria": "23001",
    "sincelejo": "70001",
    "neiva": "41001",
    "armenia": "63001",
    "valledupar": "20001",
    "pasto": "52001",
    "popayan": "19001",
    "tunja": "15001",
}


def _identificacion_code(identificacion):
    ident = str(identificacion).strip()
    # Heurística: NIT suele superar 10 caracteres (9 dígitos + DV o formato).
    # Sin un campo explícito de tipo de persona, se asume cédula de ciudadanía
    # para la mayoría de los clientes (personas naturales).
    if len(ident) > 10:
        return "31"
    return "13"


def _legal_organization_code(identificacion):
    ident = str(identificacion).strip()
    if len(ident) > 10:
        return "1"
    return "2"


def _municipality_code(factura):
    cfg = factura.proveedor_facturacion.configuracion
    default = cfg.get("municipality_code", "08001")
    ciudad = (factura.cliente.ciudad or "").strip().lower()
    return MUNICIPIOS_DEFAULT.get(ciudad, default)


def build_invoice_payload(factura):
    cliente = factura.cliente
    ident_code = _identificacion_code(cliente.identificacion)
    org_code = _legal_organization_code(cliente.identificacion)
    is_company = org_code == "1"

    # Descuento total a nivel de factura (se reparte proporcional entre ítems
    # para que el monto coincida con el total interno).
    descuento_total = Decimal(factura.descuento or 0)
    subtotal_bruto = sum(
        (i.cantidad or 0) * (i.valor_unitario or 0)
        for i in factura.items.all()
    )
    pct_descuento = Decimal("0.00")
    if descuento_total > 0 and subtotal_bruto > 0:
        pct_descuento = (descuento_total / subtotal_bruto * 100).quantize(Decimal("0.01"))

    items = []
    for item in factura.items.all():
        qty = item.cantidad or Decimal("1")
        price = max(item.valor_unitario, Decimal("0.01"))
        gross = (qty * price).quantize(Decimal("0.01"))
        discount_value = (gross * pct_descuento / 100).quantize(Decimal("0.01"))
        discounted = gross - discount_value

        iva_pct = Decimal(item.iva_porcentaje or 0)
        taxes = []
        if iva_pct > 0:
            taxes = [
                {
                    "code": "01",
                    "rate": f"{iva_pct:.2f}",
                }
            ]

        items.append(
            {
                "code_reference": f"ITEM-{item.id}",
                "name": item.descripcion[:150],
                "quantity": f"{qty:.2f}",
                "discount_rate": f"{pct_descuento:.2f}",
                "price": f"{price:.2f}",
                "unit_measure_code": "94",
                "standard_code": "999",
                "taxes": taxes,
            }
        )

    # Total a cobrar = suma de ítems con IVA (ya descontados) → debe igualar factura.total
    items_total = Decimal("0.00")
    for it in items:
        qty = Decimal(it["quantity"])
        p = Decimal(it["price"])
        subtotal = (qty * p).quantize(Decimal("0.01"))
        discount = (subtotal * Decimal(it["discount_rate"]) / 100).quantize(Decimal("0.01"))
        taxable = subtotal - discount
        if it["taxes"]:
            tax_rate = Decimal(it["taxes"][0]["rate"]) / 100
            taxable += (taxable * tax_rate).quantize(Decimal("0.01"))
        items_total += taxable
    items_total = items_total.quantize(Decimal("0.01"))

    payment_details = [{
        "payment_form": "2" if factura.termino_pago != "CONTADO" else "1",
        "payment_method_code": "10",
        "reference_code": factura.numero,
        "amount": f"{items_total:.2f}",
    }]
    if factura.termino_pago != "CONTADO":
        payment_details[0]["due_date"] = factura.fecha_vencimiento.strftime("%Y-%m-%d")

    customer = {
        "identification_document_code": ident_code,
        "identification": str(cliente.identificacion),
        "address": cliente.direccion or "",
        "email": cliente.email or "",
        "phone": cliente.telefono or "",
        "legal_organization_code": org_code,
        "tribute_code": "ZZ",
        "municipality_code": _municipality_code(factura),
    }
    if is_company:
        customer["company"] = cliente.nombre
    else:
        customer["names"] = cliente.nombre

    payload = {
        "reference_code": factura.numero,
        "document": "01",
        "operation_type": "10",
        "observation": factura.concepto[:250],
        "send_email": False,
        "payment_details": payment_details,
        "cash_rounding_amount": "0.00",
        "customer": customer,
        "items": items,
    }

    cfg = factura.proveedor_facturacion.configuracion
    numbering_range_id = cfg.get("numbering_range_id")
    if numbering_range_id:
        payload["numbering_range_id"] = int(numbering_range_id)

    return payload


def emitir_factura(factura):
    proveedor = factura.proveedor_facturacion
    if not proveedor:
        return {"success": False, "error": "No hay proveedor de facturación configurado"}

    # Validaciones previas a enviar a DIAN
    if not factura.cliente.identificacion:
        return {"success": False, "error": "El cliente no tiene identificación (NIT/C.C.)."}
    if not factura.items.exists():
        return {"success": False, "error": "La factura no tiene ítems que emitir."}
    numbering_range_id = proveedor.configuracion.get("numbering_range_id")
    if not numbering_range_id:
        return {
            "success": False,
            "error": "Falta el 'numbering_range_id' (resolución) del proveedor. "
                    "Defínelo en la configuración del proveedor o con la variable "
                    "FACTUS_NUMBERING_RANGE_ID para poder asignar consecutivo y CUFE.",
        }

    headers = _headers(proveedor)
    if not headers:
        return {"success": False, "error": "Error de autenticación con Factus"}

    payload = build_invoice_payload(factura)
    api_url = _api_base(proveedor)

    # Marcar como pendiente antes de enviar
    factura.estado = "PENDIENTE"
    factura.save(update_fields=["estado"])

    try:
        resp = requests.post(
            f"{api_url}/bills/validate",
            json=payload,
            headers=headers,
            timeout=60,
        )
        data = resp.json()

        if resp.status_code in (200, 201):
            d = data.get("data", {})
            cufe = d.get("cufe", "")
            number = d.get("number", "")
            is_validated = d.get("is_validated", False)
            qr_url = d.get("links", {}).get("qr", "")
            public_url = d.get("links", {}).get("public_url", "")

            factura.numero_factus = number
            factura.cufe = cufe
            factura.codigo_qr = qr_url
            factura.respuesta_dian = json.dumps(data)
            factura.fecha_validacion_dian = tz.now()

            if cufe and is_validated:
                factura.estado = "EMITIDA"
            elif cufe:
                # Factus validó pero aún no confirmado ante DIAN
                factura.estado = "PENDIENTE"
            else:
                # Respuesta sin CUFE: no marcar como emitida
                factura.estado = "PENDIENTE"

            factura.save(
                update_fields=[
                    "estado",
                    "numero_factus",
                    "cufe",
                    "codigo_qr",
                    "respuesta_dian",
                    "fecha_validacion_dian",
                ]
            )
            return {
                "success": True,
                "cufe": cufe,
                "numero_factus": number,
                "validated": is_validated,
                "data": data,
            }
        else:
            factura.estado = "RECHAZADA"
            factura.respuesta_dian = json.dumps(data)
            factura.save(update_fields=["estado", "respuesta_dian"])
            errors = data.get("data", {}).get("errors", data.get("errors", {}))
            if isinstance(errors, dict):
                error_msg = "; ".join(
                    f"{k}: {', '.join(v) if isinstance(v, list) else v}"
                    for k, v in errors.items()
                )
            else:
                error_msg = data.get("message", data.get("errors", str(data)))
            return {"success": False, "error": error_msg, "data": data}

    except (requests.RequestException, ValueError, TypeError) as e:
        factura.estado = "RECHAZADA"
        factura.respuesta_dian = str(e)
        factura.save(update_fields=["estado", "respuesta_dian"])
        logger.error(f"Factus emit error: {e}")
        return {"success": False, "error": f"Error de conexión con Factus: {e}"}


def consultar_estado(factura):
    proveedor = factura.proveedor_facturacion
    if not proveedor:
        return {"success": False, "error": "No hay proveedor configurado"}

    headers = _headers(proveedor)
    if not headers:
        return {"success": False, "error": "Error de autenticación"}

    numero = factura.numero_factus or factura.numero
    api_url = _api_base(proveedor)
    try:
        resp = requests.get(
            f"{api_url}/bills/{numero}",
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"success": True, "data": data}
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}


def eliminar_en_factus(factura):
    proveedor = factura.proveedor_facturacion
    if not proveedor:
        return {"success": False, "error": "No hay proveedor configurado"}

    headers = _headers(proveedor)
    if not headers:
        return {"success": False, "error": "Error de autenticación"}

    api_url = _api_base(proveedor)
    try:
        resp = requests.delete(
            f"{api_url}/bills/destroy/reference/{factura.numero}",
            headers=headers,
            timeout=30,
        )
        data = resp.json()
        if resp.status_code in (200, 204):
            return {"success": True, "data": data}
        return {"success": False, "error": data.get("message", str(data)), "data": data}
    except requests.RequestException as e:
        return {"success": False, "error": str(e)}


def _descargar_documento(tipo, proveedor, numero):
    headers = _headers(proveedor)
    if not headers:
        return None

    api_url = _api_base(proveedor)
    endpoint = f"{api_url}/bills/{numero}/download-{tipo}"
    try:
        resp = requests.get(endpoint, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        b64_key = f"{tipo}_base_64_encoded"
        b64_content = data.get(b64_key)
        if b64_content:
            return base64.b64decode(b64_content)
        return None
    except requests.RequestException as e:
        logger.error(f"Factus download {tipo} error: {e}")
        return None


def descargar_pdf(factura):
    proveedor = factura.proveedor_facturacion
    if not proveedor:
        return None
    numero = factura.numero_factus or factura.numero
    return _descargar_documento("pdf", proveedor, numero)


def descargar_xml(factura):
    proveedor = factura.proveedor_facturacion
    if not proveedor:
        return None
    numero = factura.numero_factus or factura.numero
    return _descargar_documento("xml", proveedor, numero)


def listar_facturas(proveedor, filtros=None, page=1):
    headers = _headers(proveedor)
    if not headers:
        return {"success": False, "error": "Error de autenticación"}

    api_url = _api_base(proveedor)
    params = {"page": page}
    if filtros:
        for k, v in filtros.items():
            if v is not None:
                params[f"filter[{k}]"] = v

    try:
        resp = requests.get(
            f"{api_url}/bills",
            headers=headers,
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"success": True, "data": data}
    except requests.RequestException as e:
        logger.error(f"Factus list error: {e}")
        return {"success": False, "error": str(e)}
