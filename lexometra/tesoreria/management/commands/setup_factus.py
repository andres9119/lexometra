import os

from django.core.management.base import BaseCommand
from tesoreria.models import ProveedorFacturacion


class Command(BaseCommand):
    help = "Crea/actualiza el proveedor de facturación para Factus"

    def handle(self, *args, **options):
        # Credenciales leídas de variables de entorno. Los valores por defecto
        # son de SANDBOX (no producción). En producción define las variables
        # FACTUS_* en el .env con credenciales reales.
        cfg = {
            "client_id": os.getenv("FACTUS_CLIENT_ID", "a1fc21a1-d443-41fc-8c36-7561ebe12b63"),
            "client_secret": os.getenv("FACTUS_CLIENT_SECRET", "JQPuvxUxWeqqh1PTo5TWlGTRvz0S6ghR5r7x1iMP"),
            "username": os.getenv("FACTUS_USERNAME", "sandboxv2@factus.com.co"),
            "password": os.getenv("FACTUS_PASSWORD", "sandbox2026%"),
            "auth_url": os.getenv("FACTUS_AUTH_URL", "https://api-sandbox.factus.com.co/oauth/token"),
            "api_url": os.getenv("FACTUS_API_URL", "https://api-sandbox.factus.com.co/v2"),
            "numbering_range_id": os.getenv("FACTUS_NUMBERING_RANGE_ID") or None,
        }

        proveedor, created = ProveedorFacturacion.objects.update_or_create(
            nombre="Factus Sandbox",
            defaults={
                "activo": True,
                "api_url": "https://api-sandbox.factus.com.co",
                "configuracion": cfg,
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Creado proveedor Factus Sandbox (PK={proveedor.pk})"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Actualizado proveedor Factus Sandbox (PK={proveedor.pk})"))

        from tesoreria.services.factus import get_access_token
        token = get_access_token(proveedor, force=True)
        if token:
            self.stdout.write(self.style.SUCCESS("Token de acceso obtenido correctamente"))
        else:
            self.stdout.write(self.style.ERROR("No se pudo obtener token de acceso — revisa credenciales"))
