from django.db import migrations


def populate_servicio_fk(apps, schema_editor):
    Proceso = apps.get_model('procesos', 'Proceso')
    Servicio = apps.get_model('procesos', 'Servicio')
    for proceso in Proceso.objects.filter(servicio__isnull=True).exclude(tipo_servicio='').iterator():
        tipo = proceso.tipo_servicio.strip()
        if not tipo:
            continue
        servicio, _ = Servicio.objects.get_or_create(
            nombre__iexact=tipo,
            defaults={'nombre': tipo, 'activo': True},
        )
        Proceso.objects.filter(pk=proceso.pk).update(servicio=servicio)


def reverse_func(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('procesos', '0011_servicio_fk'),
    ]

    operations = [
        migrations.RunPython(populate_servicio_fk, reverse_func),
    ]
