from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

from portfolio.api import content

urlpatterns = [
    # Nothing lives at the root of this service; send stray visits to the admin
    # rather than showing them a 404.
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/content/", content, name="content"),
]

# In production the media directory is served by the web server or a volume
# mount; this is only so uploads work while developing.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
