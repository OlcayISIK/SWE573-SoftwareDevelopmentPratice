from rest_framework import serializers

from .models import Report, ReviewAction


class ReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["reason", "note"]


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "craft", "reason", "note", "status", "created_at"]
        read_only_fields = fields


class PersonSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(source="profile.display_name", read_only=True)


class ReportedCraftSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    author = PersonSerializer(read_only=True)


class ReviewActionSerializer(serializers.ModelSerializer):
    admin = PersonSerializer(read_only=True)

    class Meta:
        model = ReviewAction
        fields = ["id", "action", "reason", "admin", "created_at"]
        read_only_fields = fields


class ReportReviewSerializer(serializers.ModelSerializer):
    craft = ReportedCraftSerializer(read_only=True)
    reporter = PersonSerializer(read_only=True)
    actions = ReviewActionSerializer(many=True, read_only=True)

    class Meta:
        model = Report
        fields = ["id", "craft", "reporter", "reason", "note", "status", "created_at", "actions"]
        read_only_fields = fields


class ReviewQueueFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[*Report.Status.values, "all"], default=Report.Status.OPEN
    )


class ReviewActionCreateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ReviewAction.Action.choices)
    reason = serializers.CharField(max_length=1000)
    changes = serializers.DictField(
        required=False,
        help_text="Craft fields to change. Required when the action is `edit`.",
    )
