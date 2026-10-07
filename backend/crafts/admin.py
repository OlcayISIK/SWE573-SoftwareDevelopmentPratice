from django.contrib import admin

from .models import Category, Craft, CraftMedia, CraftType, Culture, Material, Tool


class CraftMediaInline(admin.TabularInline):
    model = CraftMedia
    extra = 0
    fields = ["media_type", "file", "url", "caption", "alt_text", "order", "is_deleted"]

    def get_queryset(self, request):
        return CraftMedia.all_objects.all()


class LookupItemAdmin(admin.ModelAdmin):
    list_display = ["name", "is_hidden", "created_by", "created_at"]
    list_filter = ["is_hidden"]
    search_fields = ["name"]
    raw_id_fields = ["created_by"]


@admin.register(Category)
class CategoryAdmin(LookupItemAdmin):
    list_display = ["name", "slug", "is_hidden", "created_by", "created_at"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(CraftType)
class CraftTypeAdmin(LookupItemAdmin):
    list_display = ["name", "category", "is_hidden", "created_by", "created_at"]
    list_filter = ["is_hidden", "category"]


@admin.register(Tool, Material)
class LinkedItemAdmin(LookupItemAdmin):
    filter_horizontal = ["craft_types"]


@admin.register(Culture)
class CultureAdmin(LookupItemAdmin):
    list_display = ["name", "homeland", "is_hidden", "created_by", "created_at"]
    search_fields = ["name", "homeland"]


@admin.register(Craft)
class CraftAdmin(admin.ModelAdmin):
    list_display = ["name", "author", "category", "craft_type", "culture", "country", "status"]
    list_filter = ["status", "is_deleted", "category", "culture", "country"]
    search_fields = ["name", "craft_type__name", "address", "author__email"]
    raw_id_fields = ["author"]
    filter_horizontal = ["tools", "materials"]
    readonly_fields = ["created_at", "updated_at"]
    inlines = [CraftMediaInline]

    def get_queryset(self, request):
        return Craft.all_objects.select_related("author", "category", "craft_type", "culture")
