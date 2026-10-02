from django.contrib.auth.models import AbstractUser
from django.db import models

class Usuario(AbstractUser):
    ROLE_CHOICES = [
        ('ADMIN', 'Administrador'),
        ('COMERCIAL', 'Comercial'),
        ('COLABORADOR', 'Colaborador'),
        ('ABOGADO', 'Abogado'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='COLABORADOR')

    @property
    def is_admin(self):
        return self.role == 'ADMIN'

    @property
    def is_comercial(self):
        return self.role == 'COMERCIAL'

    @property
    def is_colaborador(self):
        return self.role == 'COLABORADOR'

    @property
    def is_abogado(self):
        return self.role == 'ABOGADO'


# Create your models here.
