import factory

from accounts.models import User
from crafts.models import Category, Craft, CraftType, Culture
from moderation.models import Report

DEFAULT_PASSWORD = "Str0ng-Passw0rd!"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    is_email_verified = True

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", DEFAULT_PASSWORD)
        return model_class.objects.create_user(*args, password=password, **kwargs)


class AdminFactory(UserFactory):
    email = factory.Sequence(lambda n: f"admin{n}@example.com")
    role = User.Role.ADMIN


class CategoryFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Category

    name = factory.Sequence(lambda n: f"Test Category {n}")
    slug = factory.Sequence(lambda n: f"test-category-{n}")


class CraftFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Craft

    name = factory.Sequence(lambda n: f"Craft {n}")
    category = factory.SubFactory(CategoryFactory)
    craft_type = factory.LazyAttribute(
        lambda craft: CraftType.objects.get_or_create(category=craft.category, name="Tile")[0]
    )
    culture = factory.LazyFunction(lambda: Culture.objects.get(name="Turkish"))
    address = "Kütahya, Türkiye"
    city = "Kütahya"
    country = "Türkiye"
    latitude = "39.419200"
    longitude = "29.983300"
    description = "Hand-painted glazed tile, shaped, painted, glazed, and fired in a kiln."
    attributes = factory.LazyFunction(dict)
    author = factory.SubFactory(UserFactory)


class ReportFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Report

    craft = factory.SubFactory(CraftFactory)
    reporter = factory.SubFactory(UserFactory)
    reason = Report.Reason.INACCURATE
    note = "The culture looks wrong."
