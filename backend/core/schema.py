from drf_spectacular.openapi import AutoSchema


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
        return response
