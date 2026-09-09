from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from django.views.generic import RedirectView

from portfolio import manage_api
from portfolio.api import content

urlpatterns = [
    # Nothing lives at the root of this service; send stray visits to the admin
    # rather than showing them a 404.
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
    path("admin/", admin.site.urls),
    path("api/content/", content, name="content"),
    # The portal at /manage. Everything below needs a session; only the first
    # three are reachable signed out, and they are what establish one.
    path("api/manage/session/", manage_api.session),
    path("api/manage/sign-in/", manage_api.sign_in),
    path("api/manage/sign-out/", manage_api.sign_out),
    path("api/manage/content/", manage_api.content),
    path("api/manage/site/", manage_api.site_info),
    path("api/manage/site/links/", manage_api.social_links),
    path("api/manage/sections/<slug:slug>/", manage_api.section),
    path("api/manage/sections/<slug:slug>/pieces/", manage_api.add_piece),
    path("api/manage/sections/<slug:slug>/pieces/order/", manage_api.reorder_pieces),
    path("api/manage/pieces/<int:piece_id>/", manage_api.piece),
]

# In production the media directory is served by the web server or a volume
# mount; this is only so uploads work while developing.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
