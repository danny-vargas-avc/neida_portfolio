"""
The admin Neida actually uses.

Written for someone who is not a developer, so the priorities are: put the
things she changes often at the top, keep the things that must line up with the
artwork or the code out of the way, show pictures as pictures, and never present
a button that leads somewhere confusing.

Pieces, publications and offerings are edited inline on their section rather
than as separate lists — a photograph only means anything in the context of the
section it belongs to.
"""

from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from django.utils.html import format_html
from unfold.admin import ModelAdmin, StackedInline, TabularInline

from .models import Offering, Piece, Publication, Section, SiteInfo, SocialLink

# Unfold styles the admin through its own base classes, so the built-in user and
# group screens have to be re-registered or they render unstyled.
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    pass


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass


def thumbnail(image, *, height: int = 60):
    """A small preview, or a dash when there is no image yet."""
    if not image:
        return "—"
    return format_html(
        '<img src="{}" style="height:{}px;width:auto;border-radius:4px;'
        'object-fit:cover;background:#f4f3f0" />',
        image.url,
        height,
    )


class PieceInline(StackedInline):
    """
    Stacked rather than tabular, for the phone.

    As a table this was seven columns roughly 890px wide, which on a phone became
    a 356px window onto it: the picture and the filename were visible and the
    title, year, shape and description were all off to the right, reachable only
    by scrolling a small box sideways with no headings in view. Adding a
    photograph from her phone is the single thing this admin exists to do, so
    that is the layout that has to be right. Stacked is taller on a desktop, and
    worth it.
    """

    model = Piece
    extra = 1
    fields = ("preview", "image", "title", "year", "orientation", "alt", "order")
    readonly_fields = ("preview",)
    ordering = ("order", "id")

    @admin.display(description="")
    def preview(self, obj):
        return thumbnail(obj.thumbnail or obj.image)


class PublicationInline(StackedInline):
    model = Publication
    extra = 1
    fields = (("title", "kind"), ("authors", "year"), ("venue", "url"), "order")
    ordering = ("order", "id")


class OfferingInline(StackedInline):
    model = Offering
    extra = 1
    fields = ("title", "blurb", ("audience", "order"))
    ordering = ("order", "id")


class SocialLinkInline(TabularInline):
    model = SocialLink
    extra = 1
    fields = ("label", "url", "order")
    ordering = ("order", "id")


@admin.register(SiteInfo)
class SiteInfoAdmin(ModelAdmin):
    inlines = (SocialLinkInline,)
    fieldsets = (
        (None, {"fields": ("name", "role", "intro")}),
        ("About", {"fields": ("about",)}),
        ("Contact", {"fields": ("email", "location")}),
    )

    def has_add_permission(self, request):
        # Exactly one of these should ever exist. Hiding "add" once it does is
        # simpler to understand than letting a second one be created and then
        # explaining why the site ignores it.
        return not SiteInfo.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Section)
class SectionAdmin(ModelAdmin):
    list_display = ("title", "leaf", "what_it_holds", "is_published")
    list_filter = ("is_published", "kind")
    list_editable = ("is_published",)
    ordering = ("order", "id")

    fieldsets = (
        (None, {"fields": ("title", "tagline", "intro", "is_published")}),
        (
            "Fixed by the drawing",
            {
                "classes": ("collapse",),
                "description": (
                    "These tie the section to its leaf on the vine and to how the "
                    "page is laid out. You should not need to change them — if a "
                    "leaf ends up in the wrong place, that is a job for Danny."
                ),
                "fields": ("slug", "kind", "accent", "order", "cv"),
            },
        ),
    )

    def has_add_permission(self, request):
        # The sections are the leaves on the drawing, and the drawing is fixed.
        # A ninth section would have no leaf to click on, so it could never be
        # reached; the model already limits the slug to the eight that exist,
        # which left "add" offering a duplicate of one of them and nothing else.
        return False

    def has_delete_permission(self, request, obj=None):
        # Deleting one does not remove its leaf — the leaf is drawn into the
        # artwork — it just stops the leaf doing anything when clicked. Hiding
        # is what she actually wants, and "Visible on the site" already does it.
        return False

    def get_inlines(self, request, obj=None):
        """Show only the inline that suits this section's layout."""
        if obj is None:
            return []
        if obj.kind == "research":
            return [PublicationInline]
        if obj.kind == "teaching":
            return [OfferingInline, PieceInline]
        return [PieceInline]

    @admin.display(description="Leaf")
    def leaf(self, obj):
        return obj.get_slug_display()

    @admin.display(description="Contains")
    def what_it_holds(self, obj):
        counts = {
            "research": f"{obj.publications.count()} publications",
            "teaching": f"{obj.offerings.count()} offerings, {obj.pieces.count()} pictures",
        }
        return counts.get(obj.kind, f"{obj.pieces.count()} pictures")


@admin.register(Piece)
class PieceAdmin(ModelAdmin):
    """
    Every picture, across all sections.

    Editing normally happens inline on the section. This list exists for the
    other job: finding one picture among hundreds without knowing where it lives.
    """

    list_display = ("preview", "title", "section", "year", "orientation")
    list_display_links = ("preview", "title")
    list_filter = ("section", "orientation")
    search_fields = ("title", "note", "alt")
    autocomplete_fields = ()
    ordering = ("section", "order", "id")

    @admin.display(description="")
    def preview(self, obj):
        return thumbnail(obj.thumbnail or obj.image, height=48)
