"""
The write API behind the portal at /manage.

Deliberately separate from api.py, which is the public read-only feed. Nothing
here is reachable without a session, and every response is JSON — there are no
Django forms or templates involved, because the portal draws its own.

On CSRF: the portal is served from the same origin as this API (nginx routes
both), so Django's cookie-based protection applies normally and the front end
sends the token back in an X-CSRFToken header. `session` below sets the cookie
on the way in, which is what makes the first write possible.

On permissions: there is one editor, and she is a superuser, so this checks that
a user is logged in and staff rather than modelling per-object permissions that
would have exactly one row.
"""

from __future__ import annotations

import json
from functools import wraps

from django.contrib.auth import authenticate
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .api import piece_json
from .models import Piece, Section, SiteInfo, SocialLink


def _json_body(request) -> dict:
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def staff_only(view):
    """401 rather than a redirect: the caller is fetch(), not a browser."""

    @wraps(view)
    def wrapped(request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated or not user.is_staff:
            return JsonResponse({"detail": "Not signed in."}, status=401)
        return view(request, *args, **kwargs)

    return wrapped


def _assign(obj, data: dict, allowed: set[str]) -> list[str]:
    """Copies whitelisted keys onto obj. Returns the field names that changed."""
    touched = []
    for field in allowed & data.keys():
        setattr(obj, field, data[field])
        touched.append(field)
    return touched


def _save(obj, fields: list[str]):
    """
    Validates before writing, and reports which field was wrong.

    full_clean() rather than a bare save() so the model's own rules — the hex
    colour pattern, the PDF-only CV, max lengths — reach the portal as messages
    it can put under the right input, instead of surfacing as a 500.
    """
    try:
        obj.full_clean()
    except ValidationError as exc:
        return JsonResponse({"errors": exc.message_dict}, status=400)
    obj.save()
    return None


# --- who's there -------------------------------------------------------------


@ensure_csrf_cookie
@require_GET
def session(request):
    """
    Current sign-in state, and the thing that plants the CSRF cookie.

    Called before anything else by the portal, including on the sign-in screen —
    which is why it is not itself behind staff_only.
    """
    user = request.user
    if user.is_authenticated and user.is_staff:
        return JsonResponse({"signedIn": True, "name": user.get_short_name() or user.username})
    return JsonResponse({"signedIn": False})


@require_POST
def sign_in(request):
    data = _json_body(request)
    user = authenticate(
        request,
        username=(data.get("username") or "").strip(),
        password=data.get("password") or "",
    )
    if user is None or not user.is_staff:
        # One message for both cases on purpose: saying which half was wrong
        # tells an attacker whether a username exists.
        return JsonResponse({"detail": "That username and password do not match."}, status=400)
    auth_login(request, user)
    return JsonResponse({"signedIn": True, "name": user.get_short_name() or user.username})


@require_POST
def sign_out(request):
    auth_logout(request)
    return JsonResponse({"signedIn": False})


# --- everything she can edit, in one payload ---------------------------------


def _section_json(section):
    """
    Like the public one, but includes what the portal needs to edit: unpublished
    sections, the flag itself, and ids so a piece can be addressed.
    """
    return {
        "slug": section.slug,
        "title": section.title,
        "tagline": section.tagline,
        "intro": section.intro,
        "kind": section.kind,
        "accent": section.accent,
        "isPublished": section.is_published,
        "pieces": [
            {"id": p.id, **piece_json(p)} for p in section.pieces.all()
        ],
        # Read-only here; these stay in the Django admin for now.
        "publicationCount": section.publications.count(),
        "offeringCount": section.offerings.count(),
    }


@staff_only
@require_GET
def content(request):
    site = SiteInfo.objects.first()
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
                    {"id": l.id, "label": l.label, "url": l.url}
                    for l in (site.links.all() if site else [])
                ],
            },
            # Every section, published or not — hiding one in the portal would
            # make it unrecoverable.
            "sections": [_section_json(s) for s in Section.objects.all()],
        }
    )


# --- your details ------------------------------------------------------------


@staff_only
@require_http_methods(["PATCH"])
def site_info(request):
    site = SiteInfo.objects.first() or SiteInfo()
    data = _json_body(request)
    fields = _assign(site, data, {"name", "role", "intro", "about", "email", "location"})
    if (error := _save(site, fields)) is not None:
        return error
    return JsonResponse({"ok": True})


@staff_only
@require_http_methods(["PUT"])
def social_links(request):
    """
    Replaces the whole list.

    The portal edits these as one small list rather than as separate rows, and
    sending the finished list avoids a per-row create/update/delete dance for
    something that is never more than a handful of entries.
    """
    site = SiteInfo.objects.first()
    if site is None:
        return JsonResponse({"detail": "Add your details first."}, status=400)

    incoming = _json_body(request).get("links") or []
    cleaned = []
    for i, row in enumerate(incoming):
        link = SocialLink(
            site=site,
            label=(row.get("label") or "").strip(),
            url=(row.get("url") or "").strip(),
            order=i,
        )
        if not link.label and not link.url:
            continue
        try:
            link.full_clean(exclude=["site"])
        except ValidationError as exc:
            return JsonResponse({"errors": {str(i): exc.message_dict}}, status=400)
        cleaned.append(link)

    site.links.all().delete()
    SocialLink.objects.bulk_create(cleaned)
    return JsonResponse({"ok": True})


# --- sections ----------------------------------------------------------------


@staff_only
@require_http_methods(["PATCH"])
def section(request, slug):
    try:
        obj = Section.objects.get(slug=slug)
    except Section.DoesNotExist:
        return JsonResponse({"detail": "No such section."}, status=404)

    data = _json_body(request)
    if "isPublished" in data:
        data["is_published"] = data.pop("isPublished")
    # Not slug, kind, accent or order: those tie the section to its leaf on the
    # drawing, and the portal deliberately offers no way to touch them.
    fields = _assign(obj, data, {"title", "tagline", "intro", "is_published"})
    if (error := _save(obj, fields)) is not None:
        return error
    return JsonResponse({"ok": True})


# --- photographs -------------------------------------------------------------


@staff_only
@require_POST
def add_piece(request, slug):
    try:
        parent = Section.objects.get(slug=slug)
    except Section.DoesNotExist:
        return JsonResponse({"detail": "No such section."}, status=404)

    upload = request.FILES.get("image")
    if upload is None:
        return JsonResponse({"detail": "No picture was attached."}, status=400)

    piece = Piece(
        section=parent,
        image=upload,
        title=(request.POST.get("title") or "").strip() or upload.name.rsplit(".", 1)[0],
        alt=(request.POST.get("alt") or "").strip(),
        orientation=request.POST.get("orientation") or Piece.Orientation.PORTRAIT,
        # New pictures land at the end.
        order=(parent.pieces.count()),
    )
    try:
        # Excludes image: the file is validated by ImageField on save, and
        # full_clean would otherwise complain about the not-yet-written file.
        piece.full_clean(exclude=["image"])
    except ValidationError as exc:
        return JsonResponse({"errors": exc.message_dict}, status=400)

    # save() is where the resize and metadata strip happen.
    piece.save()
    return JsonResponse({"piece": {"id": piece.id, **piece_json(piece)}}, status=201)


@staff_only
@require_http_methods(["PATCH", "DELETE"])
def piece(request, piece_id):
    try:
        obj = Piece.objects.get(pk=piece_id)
    except Piece.DoesNotExist:
        return JsonResponse({"detail": "That picture is already gone."}, status=404)

    if request.method == "DELETE":
        # The files too, or the volume fills with pictures nothing points at.
        obj.image.delete(save=False)
        if obj.thumbnail:
            obj.thumbnail.delete(save=False)
        obj.delete()
        return JsonResponse({"ok": True})

    data = _json_body(request)
    fields = _assign(obj, data, {"title", "year", "note", "alt", "orientation"})
    if (error := _save(obj, fields)) is not None:
        return error
    return JsonResponse({"piece": {"id": obj.id, **piece_json(obj)}})


@staff_only
@require_POST
def reorder_pieces(request, slug):
    """Takes the ids in their new order and renumbers them."""
    ids = _json_body(request).get("ids") or []
    pieces = {p.id: p for p in Piece.objects.filter(section__slug=slug)}

    # Every id must belong to this section, so a bad payload cannot reshuffle
    # another section's pictures.
    if set(ids) != set(pieces):
        return JsonResponse({"detail": "That list does not match this section."}, status=400)

    for position, pk in enumerate(ids):
        pieces[pk].order = position
    Piece.objects.bulk_update(pieces.values(), ["order"])
    return JsonResponse({"ok": True})
