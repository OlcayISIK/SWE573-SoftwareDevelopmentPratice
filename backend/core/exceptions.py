import logging

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


class DomainError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "The request could not be processed."

    def __init__(self, message=None, errors=None):
        self.message = message or self.default_message
        self.errors = errors or {}
        super().__init__(self.message)


class NotFoundError(DomainError):
    status_code = status.HTTP_404_NOT_FOUND
    default_message = "Not found."


class PermissionDeniedError(DomainError):
    status_code = status.HTTP_403_FORBIDDEN
    default_message = "You do not have permission to perform this action."


class ValidationError(DomainError):
    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "Validation failed."


class ConflictError(DomainError):
    status_code = status.HTTP_409_CONFLICT
    default_message = "The request conflicts with the current state."


class ServiceUnavailableError(DomainError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_message = "An outside service is not available right now."


def _message_and_errors(data):
    if isinstance(data, dict) and "detail" in data:
        return str(data["detail"]), {}
    if isinstance(data, list):
        return ValidationError.default_message, {"non_field_errors": data}
    return ValidationError.default_message, data


def api_exception_handler(exc, context):
    if isinstance(exc, DomainError):
        return Response({"message": exc.message, "errors": exc.errors}, status=exc.status_code)

    response = drf_exception_handler(exc, context)
    if response is None:
        if settings.DEBUG:
            return None
        logger.error("Unhandled API error", exc_info=exc)
        return Response(
            {"message": "Internal server error.", "errors": {}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    message, errors = _message_and_errors(response.data)
    response.data = {"message": message, "errors": errors}
    return response
