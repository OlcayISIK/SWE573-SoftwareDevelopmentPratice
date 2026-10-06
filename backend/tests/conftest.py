import pytest
from django.core.cache import cache
from rest_framework.test import APIClient


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_for():
    def make(user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    return make


@pytest.fixture
def user(db):
    from tests.factories import UserFactory

    return UserFactory()


@pytest.fixture
def unverified_user(db):
    from tests.factories import UserFactory

    return UserFactory(is_email_verified=False)


@pytest.fixture
def admin_user(db):
    from tests.factories import AdminFactory

    return AdminFactory()
