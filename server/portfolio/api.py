"""
The read-only feed the front end renders.

One endpoint returning the whole page's content, rather than a REST resource per
model: the site is a single page that needs all of it at once, so one request is
both simpler to consume and trivially cacheable.

URLs are absolute. The front end runs on a different origin, so a relative
"/media/..." would resolve against Nuxt and 404.
"""

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Section, SiteInfo


def absolute(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith(("http://", "https://")):
        return url
    return f"{settings.PUBLIC_BASE_URL.rstrip('/')}{url}"


def piece_json(piece):
    return {
        "image": absolute(piece.image.url if piece.image else None),
        "title": piece.title,
        "year": piece.year,
        "note": piece.note or None,
        # Falling back to the title here rather than in the front end keeps the
        # rule in one place: every image ends up with some alt text.
        "alt": piece.alt or piece.title,
        "orientation": piece.orientation,
    }


def section_json(section):
    data = {
        "slug": section.slug,
        "title": section.title,
        "tagline": section.tagline,
        "kind": section.kind,
        "accent": section.accent,
        "order": section.order,
        "intro": section.intro or None,
        "pieces": [piece_json(p) for p in section.pieces.all()],
        "publications": [
            {
                "title": pub.title,
                "authors": pub.authors or None,
                "venue": pub.venue or None,
                "year": pub.year,
                "url": pub.url or None,
                "type": pub.kind or None,
            }
            for pub in section.publications.all()
        ],
        "offerings": [
            {
                "title": off.title,
                "blurb": off.blurb or None,
                "audience": off.audience or None,
            }
            for off in section.offerings.all()
        ],
        "cv": absolute(section.cv.url) if section.cv else None,
    }
    return data


@require_GET
def content(request):
    site = SiteInfo.objects.prefetch_related("links").first()
    sections = (
        Section.objects.filter(is_published=True)
        .prefetch_related("pieces", "publications", "offerings")
        .order_by("order", "id")
    )

    return JsonResponse(
        {
            "site": {
                "name": site.name if site else "",
                "role": site.role if site else "",
                "intro": site.intro if site else "",
                "about": site.about if site else "",
                "email": site.email if site else "",
                "location": site.location if site else "",
                "links": [
                    {"label": link.label, "url": link.url}
                    for link in (site.links.all() if site else [])
                ],
            },
            "sections": [section_json(s) for s in sections],
        }
    )
