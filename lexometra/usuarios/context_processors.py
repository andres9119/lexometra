from .mixins import efective_role


def user_role(request):
    """Expone el rol efectivo del usuario en el contexto de las plantillas."""
    user = request.user
    if user.is_authenticated:
        return {'user_role': efective_role(user)}
    return {'user_role': None}
