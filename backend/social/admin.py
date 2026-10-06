from django.contrib import admin

from .models import Favorite, Follow


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ["user", "craft", "created_at"]
    raw_id_fields = ["user", "craft"]


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["follower", "following", "created_at"]
    raw_id_fields = ["follower", "following"]
