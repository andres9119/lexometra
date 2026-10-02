from django.core.management.base import BaseCommand
from comercial.models import PerfilEmpresa


class Command(BaseCommand):
    help = 'Seeds the default company profile record'

    def handle(self, *args, **options):
        obj, created = PerfilEmpresa.objects.get_or_create(pk=1, defaults={
            'razon_social': 'Diego Andres Viloria Carpintero',
            'nit': '1.005.512.876-1',
            'tipo_documento': 'Cedula de Ciudadania',
            'representante_legal': 'Diego Andres Viloria Carpintero',
            'ciudad': 'Barranquilla',
            'departamento': 'Atlantico',
            'direccion': 'Calle 117 #42 - 56, Barranquilla (Atlantico)',
            'telefono': '3146159776',
            'email': 'Viloria542@gmail.com',
        })
        if created:
            self.stdout.write(self.style.SUCCESS('PerfilEmpresa creado por defecto.'))
        else:
            self.stdout.write(self.style.WARNING('PerfilEmpresa ya existe, no se modifico.'))
