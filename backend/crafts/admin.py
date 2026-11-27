from django.contrib import admin, messages
from django.utils.html import format_html

from core.exceptions import PermissionDeniedError, ServiceUnavailableError, ValidationError

from . import services, wikidata
from .models import (
    Category,
    Craft,
    CraftColor,
    CraftMedia,
    CraftPart,
    CraftPlace,
    CraftStory,
    CraftType,
    Culture,
    Material,
    Tool,
)


class CraftMediaInline(admin.TabularInline):
    model = CraftMedia
    extra = 0
    fields = ["media_type", "file", "url", "caption", "alt_text", "order", "is_deleted"]

    def get_queryset(self, request):
        return CraftMedia.all_objects.all()


class CraftPlaceInline(admin.TabularInline):
    model = CraftPlace
    extra = 0
    fields = ["address", "city", "country", "latitude", "longitude", "is_origin", "order"]


class CraftPartInline(admin.TabularInline):
    model = CraftPart
    extra = 0
    fields = ["name", "materials", "order"]


class CraftColorInline(admin.TabularInline):
    model = CraftColor
    extra = 0
    fields = ["value", "order"]

    def has_add_permission(self, request, obj=None):
        # The CIELAB values are computed when crafts are saved through the API.
        return False


class WikidataLinkFilter(admin.SimpleListFilter):
    """Lets admins look over the links users picked, which may be the wrong item."""

    title = "Wikidata link"
    parameter_name = "wikidata"

    def lookups(self, request, model_admin):
        return [
            ("users", "Linked, added by users"),
            ("seeded", "Linked, seeded"),
            ("none", "Not linked"),
        ]

    def queryset(self, request, queryset):
        linked = queryset.exclude(wikidata_id="")
        if self.value() == "users":
            return linked.filter(created_by__isnull=False)
        if self.value() == "seeded":
            return linked.filter(created_by=None)
        if self.value() == "none":
            return queryset.filter(wikidata_id="")
        return queryset


# The columns that show what an item is linked to and the other names searches find it by.
WIKIDATA_COLUMNS = ["wikidata_link", "other_names_shown"]
# Enough names to see at a glance whether the link is the item meant.
NAMES_SHOWN = 6


class LookupItemAdmin(admin.ModelAdmin):
    list_display = ["name", *WIKIDATA_COLUMNS, "is_hidden", "created_by", "created_at"]
    list_filter = ["is_hidden", WikidataLinkFilter]
    search_fields = ["name", "search_names", "wikidata_id"]
    raw_id_fields = ["created_by"]
    readonly_fields = ["wikidata_page", "wikidata_names", "broader"]
    actions = ["refresh_names"]

    @admin.display(description="Wikidata", ordering="wikidata_id")
    def wikidata_link(self, obj):
        if not obj.wikidata_id:
            return None
        return format_html(
            '<a href="{}" target="_blank" rel="noreferrer">{}</a>',
            wikidata.page_url(obj.wikidata_id),
            obj.wikidata_id,
        )

    @admin.display(description="Wikidata page")
    def wikidata_page(self, obj):
        return self.wikidata_link(obj)

    @admin.display(description="Also found as")
    def other_names_shown(self, obj):
        names = obj.names
        if not names:
            return None
        shown = ", ".join(names[:NAMES_SHOWN])
        return f"{shown}, …" if len(names) > NAMES_SHOWN else shown

    @admin.action(description="Refresh names from Wikidata")
    def refresh_names(self, request, queryset):
        """Fetches the English and Turkish names of the chosen items again."""
        items = list(queryset)
        try:
            refreshed, kept, left = services.refresh_names_of(items=items, actor=request.user)
        except PermissionDeniedError as exc:
            self.message_user(request, str(exc), messages.ERROR)
            return
        self.message_user(request, f"Refreshed the names of {refreshed} items.", messages.SUCCESS)
        if kept:
            self.message_user(
                request,
                f"{kept} items kept their names because Wikidata did not answer for them. "
                "Try again later.",
                messages.WARNING,
            )
        if left:
            self.message_user(
                request,
                f"{left} items were not reached in time. Run the action again to refresh them; "
                "the items refreshed longest ago go first.",
                messages.WARNING,
            )
        unlinked = sum(1 for item in items if not item.wikidata_id)
        if unlinked:
            self.message_user(
                request,
                f"{unlinked} items are not linked to Wikidata, so they were skipped.",
                messages.INFO,
            )

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if "wikidata_id" in form.changed_data:
            self._link(request, obj, previous=form.initial.get("wikidata_id") or "")

    def _link(self, request, obj, previous):
        """Fetches the names of the newly linked item, or clears them, and says what it is."""
        try:
            found = services.link_wikidata(obj, obj.wikidata_id)
        except ValidationError:
            # No such item, so the item keeps its earlier link, which matches its names.
            type(obj).objects.filter(pk=obj.pk).update(wikidata_id=previous)
            kept = f"stays linked to {previous}" if previous else "stays unlinked"
            self.message_user(
                request,
                f"{obj.wikidata_id} is not a Wikidata item, so {obj.name} {kept}.",
                messages.ERROR,
            )
            obj.wikidata_id = previous
            return
        except ServiceUnavailableError as exc:
            self.message_user(
                request,
                f"Saved, but the names could not be fetched from Wikidata: {exc} "
                "Refresh its names later.",
                messages.WARNING,
            )
            return
        if found is None:
            self.message_user(
                request, f"{obj.name} is no longer linked to Wikidata.", messages.INFO
            )
            return
        self.message_user(
            request,
            format_html(
                '{} is now linked to <a href="{}" target="_blank" rel="noreferrer">{}</a>: '
                "<strong>{}</strong>{}. Check it is the item you meant. Searches also find "
                "it as: {}.",
                obj.name,
                wikidata.page_url(obj.wikidata_id),
                obj.wikidata_id,
                found["label"],
                f" ({found['description']})" if found["description"] else "",
                ", ".join(found["names"]) or "no other names",
            ),
            messages.INFO,
        )


@admin.register(Category)
class CategoryAdmin(LookupItemAdmin):
    list_display = ["name", "slug", *WIKIDATA_COLUMNS, "is_hidden", "created_by", "created_at"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(CraftType)
class CraftTypeAdmin(LookupItemAdmin):
    list_display = [
        "name",
        "category",
        *WIKIDATA_COLUMNS,
        "is_hidden",
        "created_by",
        "created_at",
    ]
    list_filter = ["is_hidden", WikidataLinkFilter, "category"]


@admin.register(Tool, Material)
class LinkedItemAdmin(LookupItemAdmin):
    filter_horizontal = ["craft_types"]


@admin.register(Culture)
class CultureAdmin(LookupItemAdmin):
    list_display = ["name", "homeland", *WIKIDATA_COLUMNS, "is_hidden", "created_by", "created_at"]
    search_fields = ["name", "homeland", "search_names", "wikidata_id"]


@admin.register(Craft)
class CraftAdmin(admin.ModelAdmin):
    list_display = ["name", "author", "category", "craft_type", "culture", "country", "status"]
    list_filter = ["status", "is_deleted", "category", "culture", "country"]
    search_fields = ["name", "craft_type__name", "address", "author__email"]
    raw_id_fields = ["author"]
    filter_horizontal = ["tools", "materials"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [CraftPlaceInline, CraftPartInline, CraftColorInline, CraftMediaInline]

    def get_queryset(self, request):
        return Craft.all_objects.select_related("author", "category", "craft_type", "culture")


@admin.register(CraftStory)
class CraftStoryAdmin(admin.ModelAdmin):
    list_display = ["craft", "author", "status", "is_deleted", "created_at"]
    list_filter = ["status", "is_deleted"]
    search_fields = ["text", "craft__name", "author__email"]
    raw_id_fields = ["craft", "author"]
    readonly_fields = ["created_at", "updated_at"]
