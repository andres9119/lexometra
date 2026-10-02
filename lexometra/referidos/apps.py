from django.apps import AppConfig


class ReferidosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'referidos'

    def ready(self):
        import referidos.signals
