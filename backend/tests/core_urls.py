from django.urls import path
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from core.exceptions import ConflictError, NotFoundError
from core.pagination import StandardPagination


class OkView(APIView):
    def get(self, request):
        return Response({"value": 1})

    def delete(self, request):
        return Response(status=204)


class NotFoundView(APIView):
    def get(self, request):
        raise NotFoundError("Thing not found.")


class ConflictView(APIView):
    def get(self, request):
        raise ConflictError(errors={"name": ["Already taken."]})


class NameSerializer(serializers.Serializer):
    name = serializers.CharField()


class ValidationView(APIView):
    def post(self, request):
        NameSerializer(data=request.data).is_valid(raise_exception=True)
        return Response({})


class PaginatedView(APIView):
    def get(self, request):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(list(range(45)), request, view=self)
        return paginator.get_paginated_response(page)


class CrashView(APIView):
    def get(self, request):
        raise RuntimeError("boom")


urlpatterns = [
    path("ok/", OkView.as_view()),
    path("not-found/", NotFoundView.as_view()),
    path("conflict/", ConflictView.as_view()),
    path("validation/", ValidationView.as_view()),
    path("paginated/", PaginatedView.as_view()),
    path("crash/", CrashView.as_view()),
]
