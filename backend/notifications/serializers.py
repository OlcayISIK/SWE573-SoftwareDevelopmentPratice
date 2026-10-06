from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Notification


class NotificationActorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    display_name = serializers.CharField(source="profile.display_name")


class NotificationCraftSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class NotificationSerializer(serializers.ModelSerializer):
    actor = NotificationActorSerializer(allow_null=True, read_only=True)
    craft = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "type", "is_read", "actor", "craft", "data", "created_at"]
        read_only_fields = fields

    @extend_schema_field(NotificationCraftSerializer(allow_null=True))
    def get_craft(self, notification):
        visible = self.context.get("visible_craft_ids", set())
        if notification.craft_id not in visible:
            return None
        return NotificationCraftSerializer(notification.craft).data


class NotificationFilterSerializer(serializers.Serializer):
    unread = serializers.BooleanField(default=False)


class MarkReadSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        help_text="Notifications to mark as read. Leave out to mark all as read.",
    )


class MarkReadResultSerializer(serializers.Serializer):
    updated = serializers.IntegerField()


class UnreadCountSerializer(serializers.Serializer):
    count = serializers.IntegerField()
