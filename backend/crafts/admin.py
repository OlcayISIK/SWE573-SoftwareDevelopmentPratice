from django.contrib import admin

from .models import Category, Craft, Region


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ["name"]}


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ["name", "country"]
    list_filter = ["country"]
    search_fields = ["name", "country"]


@admin.register(Craft)
class CraftAdmin(admin.ModelAdmin):
    list_display = ["name", "author", "category", "region", "status", "is_deleted", "created_at"]
    list_filter = ["status", "is_deleted", "category", "region__country"]
    search_fields = ["name", "craft_type", "author__email"]
    raw_id_fields = ["author"]
    readonly_fields = ["created_at", "updated_at"]

    def get_queryset(self, request):
        return Craft.all_objects.select_related("author", "category", "region")
