from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', lambda request: redirect('login'), name='home'),
    path('', include('usuarios.urls')),
    path('', include('comercial.urls')),
    path('', include('procesos.urls')),
    path('', include('referidos.urls')),
    path('', include('tesoreria.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
