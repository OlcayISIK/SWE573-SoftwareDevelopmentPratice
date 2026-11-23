from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import OpenApiExample, OpenApiResponse
from rest_framework import serializers


def _envelope(data):
    return {"success": True, "data": data, "message": "OK"}


class EnvelopeAutoSchema(AutoSchema):
    """Documents successful responses inside the same envelope the renderer produces."""

    def _get_response_for_code(self, serializer, status_code, *args, **kwargs):
        response = super()._get_response_for_code(serializer, status_code, *args, **kwargs)
        if not str(status_code).startswith("2") or str(status_code) == "204":
            return response
        for media in response.get("content", {}).values():
            if "schema" not in media:
                continue
            media["schema"] = {
                "type": "object",
                "required": ["success", "data", "message"],
                "properties": {
                    "success": {"type": "boolean"},
                    "data": media["schema"],
                    "message": {"type": "string"},
                },
            }
            # Examples describe the data, so they get the same envelope as the schema.
            for example in media.get("examples", {}).values():
                if "value" in example:
                    example["value"] = _envelope(example["value"])
        return response


class ErrorEnvelopeSerializer(serializers.Serializer):
    """The body of every error response."""

    success = serializers.BooleanField(default=False)
    data = serializers.JSONField(allow_null=True, default=None)
    message = serializers.CharField()
    errors = serializers.DictField(help_text="Messages for each field that failed, if any.")


def error_response(description, *examples):
    """An error response with its envelope schema and examples of real error bodies."""
    return OpenApiResponse(
        response=ErrorEnvelopeSerializer, description=description, examples=list(examples)
    )


def error_example(name, message, errors=None, summary=None):
    """An example error body exactly as the API returns it."""
    return OpenApiExample(
        name,
        summary=summary or message,
        value={"success": False, "data": None, "message": message, "errors": errors or {}},
        response_only=True,
    )
