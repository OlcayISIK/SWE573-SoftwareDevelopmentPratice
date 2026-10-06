from rest_framework import serializers

from .models import Report


class ReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["reason", "note"]


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ["id", "craft", "reason", "note", "status", "created_at"]
        read_only_fields = fields
