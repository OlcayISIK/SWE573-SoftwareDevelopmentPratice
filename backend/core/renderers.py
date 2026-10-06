from rest_framework import status
from rest_framework.renderers import JSONRenderer


class EnvelopeJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = (renderer_context or {}).get("response")
        if response is None:
            return super().render(data, accepted_media_type, renderer_context)
        if response.status_code == status.HTTP_204_NO_CONTENT:
            return b""

        if response.status_code >= 400:
            details = data if isinstance(data, dict) else {}
            body = {
                "success": False,
                "data": None,
                "message": details.get("message", "The request could not be processed."),
                "errors": details.get("errors", {}),
            }
        else:
            body = {"success": True, "data": data, "message": "OK"}
        return super().render(body, accepted_media_type, renderer_context)
