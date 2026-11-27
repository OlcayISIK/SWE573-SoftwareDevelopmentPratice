from django.db import connection
from django.http import Http404, HttpResponse
from django.views import View
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StoredFile
from .storage import content_type


class HealthView(APIView):
    """For the host's health checks: answers when the app and its database are up.

    It is not logged or rate limited, since it is called every few seconds.
    """

    authentication_classes = []
    throttle_classes = []

    @extend_schema(
        responses=inline_serializer("Health", {"status": serializers.CharField()}),
        tags=["health"],
    )
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return Response({"status": "ok"})


class StoredFileView(View):
    """
    Serves a file kept in the database (see core.storage). Names are unique and a changed file
    gets a new name, so browsers may keep a file for a year.
    """

    def get(self, request, path):
        stored = StoredFile.objects.filter(name=path).only("content").first()
        if stored is None:
            raise Http404("File not found.")
        response = HttpResponse(bytes(stored.content), content_type=content_type(path))
        response["Cache-Control"] = "public, max-age=31536000, immutable"
        response["X-Content-Type-Options"] = "nosniff"
        return response
