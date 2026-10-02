from functools import wraps
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import PermissionDenied
from django.shortcuts import redirect
from django.conf import settings
from django.contrib import messages

def efective_role(user):
    """Rol efectivo de un usuario. El superusuario tiene todos los permisos."""
    return 'ADMIN' if user.is_superuser else user.role


def rol_requerido(*roles):
    """Decorador: exige login y que el rol efectivo del usuario esté en `roles`.
    Rechaza con redirección y mensaje si no tiene acceso.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect(settings.LOGIN_URL)
            if efective_role(request.user) not in roles:
                messages.error(request, 'No tienes permisos para acceder a esta sección.')
                return redirect('dashboard')
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


class RoleRequiredMixin(LoginRequiredMixin):
    """Mixin to restrict view access to users with specific role(s).
    Subclasses should define `allowed_roles` as an iterable of role strings.
    """
    allowed_roles = []  # e.g. ['ADMIN', 'COMERCIAL']

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        if not hasattr(request.user, 'role'):
            raise PermissionDenied('User model missing role attribute')
        if self.allowed_roles and efective_role(request.user) not in self.allowed_roles:
            raise PermissionDenied('Insufficient role permissions')
        return super().dispatch(request, *args, **kwargs)
