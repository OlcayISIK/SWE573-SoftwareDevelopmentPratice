from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "pageSize"
    max_page_size = 100

    def get_paginated_response(self, data):
        paginator = self.page.paginator
        return Response(
            {
                "items": data,
                "total": paginator.count,
                "page": self.page.number,
                "pageSize": paginator.per_page,
                "totalPages": paginator.num_pages,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "required": ["items", "total", "page", "pageSize", "totalPages"],
            "properties": {
                "items": schema,
                "total": {"type": "integer"},
                "page": {"type": "integer"},
                "pageSize": {"type": "integer"},
                "totalPages": {"type": "integer"},
            },
        }
