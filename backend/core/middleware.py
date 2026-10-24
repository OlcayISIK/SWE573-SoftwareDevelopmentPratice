import json
import logging
import re
import time
import uuid

from django.conf import settings

logger = logging.getLogger("api.requests")

REQUEST_ID_HEADER = "X-Request-ID"
MASK = "***"

_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_SENSITIVE_KEY = re.compile(r"password|token|secret|refresh|access|authorization", re.IGNORECASE)
_TEXT_TYPES = ("text/", "application/xml", "application/javascript")


def _mask(value):
    """Replaces the values of password, token, and similar keys at any depth."""
    if isinstance(value, dict):
        return {
            key: MASK if _SENSITIVE_KEY.search(str(key)) else _mask(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_mask(item) for item in value]
    return value


def _truncate(text):
    limit = settings.REQUEST_LOG_BODY_LIMIT
    if len(text) <= limit:
        return text
    return f"{text[:limit]}... ({len(text) - limit} more characters)"


def _query_dict(data):
    return _mask({key: values if len(values) > 1 else values[0] for key, values in data.lists()})


def _render(raw, content_type):
    """A body as loggable text: JSON and forms masked, text cut to the limit, binary as a size."""
    if not raw:
        return None
    if "json" in content_type:
        try:
            return _truncate(json.dumps(_mask(json.loads(raw)), ensure_ascii=False))
        except ValueError:
            pass
    if "x-www-form-urlencoded" in content_type:
        from django.http import QueryDict

        return _truncate(json.dumps(_query_dict(QueryDict(raw)), ensure_ascii=False))
    if content_type.startswith(_TEXT_TYPES) or "json" in content_type:
        return _truncate(raw.decode("utf-8", errors="replace"))
    return f"<{len(raw)} bytes>"


def _level(status):
    if status >= 500:
        return logging.ERROR
    return logging.WARNING if status >= 400 else logging.INFO


class RequestLogMiddleware:
    """Logs every request as one line: method, path, status, time taken, user, and both bodies.

    Sensitive fields are masked, uploaded files are logged by name and size, and long bodies are
    cut to REQUEST_LOG_BODY_LIMIT characters. Each request gets an ID, returned in the
    X-Request-ID header, so a user's error report can be matched to its log line.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in settings.REQUEST_LOG_SKIP_PATHS:
            return self.get_response(request)

        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request.request_id = incoming if _REQUEST_ID.match(incoming) else uuid.uuid4().hex
        content_type = request.content_type or ""
        request_body = self._read_body(request, content_type)

        started = time.perf_counter()
        response = self.get_response(request)
        duration_ms = round((time.perf_counter() - started) * 1000, 1)

        response[REQUEST_ID_HEADER] = request.request_id
        if content_type.startswith("multipart/"):
            request_body = self._multipart_body(request)

        status = response.status_code
        logger.log(
            _level(status),
            "%s %s %s %sms",
            request.method,
            request.path,
            status,
            duration_ms,
            extra={
                "request_id": request.request_id,
                "method": request.method,
                "path": request.path,
                "query": request.META.get("QUERY_STRING", ""),
                "status": status,
                "duration_ms": duration_ms,
                "user_id": self._user_id(request),
                "client_ip": self._client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
                "request_size": int(request.META.get("CONTENT_LENGTH") or 0),
                "response_size": self._response_size(response),
                "request_body": request_body,
                "response_body": self._response_body(response),
            },
        )
        return response

    @staticmethod
    def _read_body(request, content_type):
        # Multipart bodies hold files; they are logged after the view has parsed them.
        if not request.META.get("CONTENT_LENGTH") or content_type.startswith("multipart/"):
            return None
        size = int(request.META["CONTENT_LENGTH"])
        if size > settings.DATA_UPLOAD_MAX_MEMORY_SIZE:
            return f"<{size} bytes>"
        return _render(request.body, content_type)

    @staticmethod
    def _multipart_body(request):
        # Django and DRF keep the parsed form on the request; parsing it here would read the
        # stream a second time.
        fields = getattr(request, "_post", None)
        files = getattr(request, "_files", None)
        body = _query_dict(fields) if fields is not None else {}
        if files:
            body["files"] = [
                {"field": field, "name": upload.name, "size": upload.size}
                for field, upload in files.items()
            ]
        return _truncate(json.dumps(body, ensure_ascii=False)) if body else None

    @staticmethod
    def _response_body(response):
        if response.streaming:
            return "<streamed>"
        return _render(response.content, response.get("Content-Type", ""))

    @staticmethod
    def _response_size(response):
        if response.streaming:
            return int(response.get("Content-Length") or 0)
        return len(response.content)

    @staticmethod
    def _user_id(request):
        user = getattr(request, "user", None)
        return user.pk if user is not None and user.is_authenticated else None

    @staticmethod
    def _client_ip(request):
        # Behind Render's proxy the client is the first address in X-Forwarded-For.
        forwarded = request.headers.get("X-Forwarded-For", "")
        return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
