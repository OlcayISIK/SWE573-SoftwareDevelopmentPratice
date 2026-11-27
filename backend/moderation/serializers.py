from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from crafts.models import MAX_SOURCE_LENGTH, Craft
from crafts.serializers import WikidataIdField, clean_description, clean_lookup_name

from .models import (
    ItemReport,
    ItemReviewAction,
    Report,
    ReviewAction,
    StatusProposal,
    StoryReport,
    StoryReviewAction,
)


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


class ItemReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemReport
        fields = ["reason", "note"]


class ItemReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemReport
        fields = [
            "id",
            "item_type",
            "item_id",
            "item_name",
            "reason",
            "note",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class ReportedItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    description = serializers.CharField(read_only=True)
    is_hidden = serializers.BooleanField(read_only=True)
    added_by = PersonSerializer(source="created_by", read_only=True, allow_null=True)
    crafts_count = serializers.IntegerField(read_only=True)
    wikidata_id = serializers.CharField(
        read_only=True, help_text="The linked Wikidata item, or empty."
    )
    wikidata_names = serializers.ListField(
        child=serializers.CharField(),
        read_only=True,
        help_text="Names from the linked Wikidata item, in English and Turkish.",
    )
    other_names = serializers.ListField(
        child=serializers.CharField(), read_only=True, help_text="Names admins added."
    )


class ItemReviewActionSerializer(serializers.ModelSerializer):
    admin = PersonSerializer(read_only=True)

    class Meta:
        model = ItemReviewAction
        fields = ["id", "action", "reason", "details", "admin", "created_at"]
        read_only_fields = fields


class ItemReportReviewSerializer(serializers.ModelSerializer):
    item = serializers.SerializerMethodField(
        help_text="The reported item as it is now, or null if it was merged away."
    )
    reporter = PersonSerializer(read_only=True)
    actions = ItemReviewActionSerializer(many=True, read_only=True)

    class Meta:
        model = ItemReport
        fields = [
            "id",
            "item_type",
            "item_id",
            "item_name",
            "item",
            "reporter",
            "reason",
            "note",
            "status",
            "created_at",
            "actions",
        ]
        read_only_fields = fields

    @extend_schema_field(ReportedItemSerializer(allow_null=True))
    def get_item(self, report):
        item = getattr(report, "item", None)
        return ReportedItemSerializer(item).data if item is not None else None


class ItemReviewActionCreateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=ItemReviewAction.Action.choices)
    reason = serializers.CharField(max_length=1000)
    name = serializers.CharField(max_length=80, required=False, help_text="The new name.")
    description = serializers.CharField(
        max_length=300, required=False, allow_blank=True, help_text="The new description."
    )
    merge_into = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Id of the item of the same kind to merge into. Required to merge.",
    )
    wikidata_id = WikidataIdField(
        required=False,
        allow_blank=True,
        help_text="The Wikidata item to link, such as Q163446; empty removes the link.",
    )
    other_names = serializers.ListField(
        child=serializers.CharField(max_length=80, allow_blank=True),
        required=False,
        max_length=20,
        help_text='Other names searches find the item by, such as "rug" for Carpet.',
    )

    def validate_other_names(self, names):
        return [" ".join(name.split()) for name in names if name.strip()]

    def validate_name(self, value):
        return clean_lookup_name(value)

    def validate_description(self, value):
        return clean_description(value)

    def validate(self, attrs):
        action = attrs["action"]
        edits = {"name", "description", "wikidata_id", "other_names"}
        if action == ItemReviewAction.Action.EDIT and not edits & set(attrs):
            raise serializers.ValidationError({"name": ["Enter a new name or description."]})
        if action == ItemReviewAction.Action.MERGE and "merge_into" not in attrs:
            raise serializers.ValidationError({"merge_into": ["Choose the item to merge into."]})
        return attrs


class StoryReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoryReport
        fields = ["reason", "note"]


class StoryReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoryReport
        fields = ["id", "story", "reason", "note", "status", "created_at"]
        read_only_fields = fields


class StoryCraftSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class ReportedStorySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    text = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    author = PersonSerializer(read_only=True)
    craft = StoryCraftSerializer(read_only=True)


class StoryReviewActionSerializer(serializers.ModelSerializer):
    admin = PersonSerializer(read_only=True)

    class Meta:
        model = StoryReviewAction
        fields = ["id", "action", "reason", "admin", "created_at"]
        read_only_fields = fields


class StoryReportReviewSerializer(serializers.ModelSerializer):
    story = ReportedStorySerializer(read_only=True)
    reporter = PersonSerializer(read_only=True)
    actions = StoryReviewActionSerializer(many=True, read_only=True)

    class Meta:
        model = StoryReport
        fields = ["id", "story", "reporter", "reason", "note", "status", "created_at", "actions"]
        read_only_fields = fields


class StoryReviewActionCreateSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=StoryReviewAction.Action.choices)
    reason = serializers.CharField(max_length=1000)


NO_SOURCE = "Give the source the practice status is based on."
SOURCE_OR_NOTE = "Give a source, or a note that says why the status is wrong."
# An admin approves or rejects a proposal.
PROPOSAL_ACTIONS = [
    (StatusProposal.Status.APPROVED.value, "Approve"),
    (StatusProposal.Status.REJECTED.value, "Reject"),
]


class StatusProposalCreateSerializer(serializers.Serializer):
    practice_status = serializers.ChoiceField(
        choices=Craft.PracticeStatus.choices,
        help_text="The status the user thinks is right; unknown when they are not sure.",
    )
    source = serializers.CharField(
        max_length=MAX_SOURCE_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        help_text=(
            "What the right status is based on: a citation or a link, such as the UNESCO List "
            "of Intangible Cultural Heritage in Need of Urgent Safeguarding."
        ),
    )
    note = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")

    def validate(self, data):
        if not data["source"] and not data["note"]:
            raise serializers.ValidationError({"source": [SOURCE_OR_NOTE]})
        return data


class StatusProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusProposal
        fields = ["id", "craft", "practice_status", "source", "note", "status", "created_at"]
        read_only_fields = fields


class ProposedCraftSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    status = serializers.CharField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    practice_status = serializers.ChoiceField(choices=Craft.PracticeStatus.choices, read_only=True)
    practice_status_source = serializers.CharField(read_only=True)


class StatusProposalReviewSerializer(serializers.ModelSerializer):
    craft = ProposedCraftSerializer(read_only=True)
    proposer = PersonSerializer(read_only=True)
    reviewed_by = PersonSerializer(read_only=True, allow_null=True)

    class Meta:
        model = StatusProposal
        fields = [
            "id",
            "craft",
            "proposer",
            "practice_status",
            "source",
            "note",
            "status",
            "created_at",
            "reviewed_by",
            "review_reason",
            "reviewed_at",
        ]
        read_only_fields = fields


class StatusProposalQueueFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[*StatusProposal.Status.values, "all"], default="all")


class StatusProposalActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=PROPOSAL_ACTIONS,
        help_text="approved sets the craft's practice status and source; rejected leaves them.",
    )
    reason = serializers.CharField(max_length=1000)


class PracticeStatusSetSerializer(serializers.Serializer):
    practice_status = serializers.ChoiceField(choices=Craft.PracticeStatus.choices)
    source = serializers.CharField(
        max_length=MAX_SOURCE_LENGTH,
        required=False,
        allow_blank=True,
        default="",
        help_text="Required unless the status is unknown.",
    )
    reason = serializers.CharField(max_length=1000)

    def validate(self, data):
        data["source"] = data["source"].strip()
        if data["practice_status"] != Craft.PracticeStatus.UNKNOWN and not data["source"]:
            raise serializers.ValidationError({"source": [NO_SOURCE]})
        return data
