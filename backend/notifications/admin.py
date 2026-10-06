from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["recipient", "type", "craft", "is_read", "created_at"]
    list_filter = ["type", "is_read"]
    raw_id_fields = ["recipient", "craft", "actor"]
