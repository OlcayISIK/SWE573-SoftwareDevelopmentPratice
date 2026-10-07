import pytest
from rest_framework.throttling import ScopedRateThrottle

from core.exceptions import PermissionDeniedError
from crafts import services as craft_services
from crafts.models import Category, Craft, CraftType, Culture, Material, Tool
from moderation.models import ItemReport, ItemReviewAction
from tests.factories import CraftFactory, UserFactory

pytestmark = pytest.mark.django_db

QUEUE_URL = "/api/v1/moderation/item-reports/"


def report_url(items, item):
    return f"/api/v1/{items}/{item.id}/report/"


def action_url(report_id):
    return f"{QUEUE_URL}{report_id}/actions/"


def review(client, report_id, action, reason="Checked the lists.", **extra):
    return client.post(
        action_url(report_id), {"action": action, "reason": reason, **extra}, format="json"
    )


@pytest.fixture
def adder():
    return UserFactory()


@pytest.fixture
def rug(adder):
    """A tool a user added by mistake, used by one craft."""
    tool = Tool.objects.create(name="Rug", created_by=adder)
    craft = CraftFactory(author=adder)
    craft.tools.add(tool)
    return tool


@pytest.fixture
def admin_client(client_for, admin_user):
    return client_for(admin_user)


def report(client, items, item, reason="duplicate", note=""):
    return client.post(report_url(items, item), {"reason": reason, "note": note}, format="json")


@pytest.fixture
def open_report(client_for, user, rug):
    return report(client_for(user), "tools", rug, note="Not a tool.").json()["data"]["id"]


# Reporting


def test_users_report_items_added_by_others(client_for, user, rug):
    response = report(client_for(user), "tools", rug, note="Not a tool.")

    assert response.status_code == 201
    data = response.json()["data"]
    assert (data["item_type"], data["item_id"], data["item_name"]) == ("tool", rug.id, "Rug")
    assert (data["reason"], data["note"], data["status"]) == ("duplicate", "Not a tool.", "open")


@pytest.mark.parametrize(
    ("items", "make"),
    [
        (
            "categories",
            lambda by: Category.objects.create(name="Feathers", slug="f", created_by=by),
        ),
        (
            "craft-types",
            lambda by: CraftType.objects.create(
                name="Rag rug", category=Category.objects.get(slug="textiles"), created_by=by
            ),
        ),
        ("materials", lambda by: Material.objects.create(name="Plastic", created_by=by)),
        ("cultures", lambda by: Culture.objects.create(name="Made up", created_by=by)),
    ],
)
def test_every_kind_of_item_can_be_reported(client_for, user, adder, items, make):
    response = report(client_for(user), items, make(adder))

    assert response.status_code == 201


def test_seeded_items_cannot_be_reported(client_for, user):
    response = report(client_for(user), "tools", Tool.objects.get(name="Loom"))

    assert response.status_code == 400
    assert "added by users" in response.json()["message"]


def test_users_cannot_report_their_own_items(client_for, adder, rug):
    assert report(client_for(adder), "tools", rug).status_code == 400


def test_hidden_and_unknown_items_return_404(client_for, user, rug):
    client = client_for(user)
    rug.is_hidden = True
    rug.save()

    assert report(client, "tools", rug).status_code == 404
    assert client.post("/api/v1/tools/999999/report/", {"reason": "duplicate"}).status_code == 404


def test_one_open_report_per_user_per_item(client_for, user, rug):
    client = client_for(user)
    report(client, "tools", rug)

    response = report(client, "tools", rug)

    assert response.status_code == 409
    assert ItemReport.objects.count() == 1


def test_reason_must_be_valid(client_for, user, rug):
    response = report(client_for(user), "tools", rug, reason="boring")

    assert response.status_code == 400
    assert "reason" in response.json()["errors"]


def test_guests_cannot_report(api_client, rug):
    assert report(api_client, "tools", rug).status_code == 401


def test_reporting_shares_the_report_rate_limit(client_for, user, adder, monkeypatch):
    monkeypatch.setitem(ScopedRateThrottle.THROTTLE_RATES, "report", "2/hour")
    client = client_for(user)
    tools = [Tool.objects.create(name=f"Odd tool {n}", created_by=adder) for n in range(3)]

    assert [report(client, "tools", tool).status_code for tool in tools] == [201, 201, 429]


# Review queue


def test_review_endpoints_are_admin_only(client_for, user, open_report):
    member = client_for(user)

    assert member.get(QUEUE_URL).status_code == 403
    assert member.get(f"{QUEUE_URL}{open_report}/").status_code == 403
    assert review(member, open_report, "hide").status_code == 403


def test_queue_shows_the_item_and_who_added_it(admin_client, adder, rug, open_report):
    data = admin_client.get(QUEUE_URL).json()["data"]

    assert data["total"] == 1
    entry = data["items"][0]
    assert entry["id"] == open_report
    assert entry["item"] == {
        "id": rug.id,
        "name": "Rug",
        "is_hidden": False,
        "added_by": {"id": adder.id, "display_name": adder.profile.display_name},
        "crafts_count": 1,
    }


def test_queue_query_count_does_not_grow_with_reports(
    admin_client, adder, client_for, django_assert_max_num_queries
):
    for n in range(5):
        item = Material.objects.create(name=f"Odd material {n}", created_by=adder)
        report(client_for(UserFactory()), "materials", item)

    with django_assert_max_num_queries(8):
        admin_client.get(QUEUE_URL)


# Review actions


def test_rename_fixes_the_name(admin_client, rug, open_report):
    response = review(admin_client, open_report, "rename", name="  rug   hook ")

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "resolved"
    assert data["item"]["name"] == "Rug hook"
    assert data["actions"][0]["details"] == {"name": "Rug hook"}


def test_rename_to_an_existing_name_suggests_merging(admin_client, open_report):
    response = review(admin_client, open_report, "rename", name="loom")

    assert response.status_code == 409
    assert "Merge" in response.json()["message"]
    assert ItemReport.objects.get(pk=open_report).status == "open"


def test_hide_removes_the_item_from_the_lists(admin_client, api_client, rug, open_report):
    review(admin_client, open_report, "hide")

    names = [tool["name"] for tool in api_client.get("/api/v1/tools/").json()["data"]]
    assert "Rug" not in names
    # The craft that used it still shows it.
    craft = Craft.objects.get(tools=rug)
    detail = api_client.get(f"/api/v1/crafts/{craft.id}/").json()["data"]
    assert [tool["name"] for tool in detail["tools"]] == ["Rug"]


def test_hide_and_merge_close_the_other_reports_on_the_item(
    admin_client, client_for, rug, open_report
):
    other = report(client_for(UserFactory()), "tools", rug).json()["data"]["id"]

    review(admin_client, open_report, "hide")

    assert ItemReport.objects.get(pk=other).status == "resolved"
    assert ItemReviewAction.objects.filter(report_id=other, action="hide").exists()


def test_dismiss_keeps_the_item_and_other_reports(admin_client, client_for, rug, open_report):
    other = report(client_for(UserFactory()), "tools", rug).json()["data"]["id"]

    response = review(admin_client, open_report, "dismiss")

    assert response.json()["data"]["status"] == "dismissed"
    assert ItemReport.objects.get(pk=other).status == "open"
    rug.refresh_from_db()
    assert rug.is_hidden is False


def test_merge_moves_crafts_to_the_other_item(admin_client, rug, open_report):
    craft = Craft.objects.get(tools=rug)
    loom = Tool.objects.get(name="Loom")
    rug.craft_types.add(CraftType.objects.get(name="Kilim"))

    response = review(admin_client, open_report, "merge", merge_into=loom.id)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["item"] is None
    assert data["item_name"] == "Rug"
    assert data["actions"][0]["details"] == {"merged_into": loom.id, "merged_into_name": "Loom"}
    assert not Tool.objects.filter(pk=rug.pk).exists()
    assert list(craft.tools.all()) == [loom]
    assert loom.craft_types.filter(name="Kilim").exists()


def test_merging_a_culture_moves_its_crafts(admin_client, client_for, user, adder):
    duplicate = Culture.objects.create(name="Navajo", created_by=adder)
    craft = CraftFactory(culture=duplicate)
    report_id = report(client_for(user), "cultures", duplicate).json()["data"]["id"]
    dine = Culture.objects.get(name="Diné (Navajo)")

    review(admin_client, report_id, "merge", merge_into=dine.id)

    craft.refresh_from_db()
    assert craft.culture == dine


def test_merging_a_category_brings_its_craft_types(admin_client, client_for, user, adder):
    rugs = Category.objects.create(name="Rugs", slug="rugs", created_by=adder)
    textiles = Category.objects.get(slug="textiles")
    own_type = CraftType.objects.create(name="Rag rug", category=rugs, created_by=adder)
    twin = CraftType.objects.create(name="carpet", category=rugs, created_by=adder)
    craft = CraftFactory(category=rugs, craft_type=twin)
    report_id = report(client_for(user), "categories", rugs).json()["data"]["id"]

    review(admin_client, report_id, "merge", merge_into=textiles.id)

    own_type.refresh_from_db()
    craft.refresh_from_db()
    assert own_type.category == textiles
    # A craft type with the same name in the target is merged into it.
    assert craft.category == textiles
    assert craft.craft_type == CraftType.objects.get(category=textiles, name="Carpet")
    assert not Category.objects.filter(pk=rugs.pk).exists()


@pytest.mark.parametrize("target", ["itself", "hidden", "missing"])
def test_merge_needs_another_visible_item(admin_client, rug, open_report, target):
    loom = Tool.objects.get(name="Loom")
    if target == "hidden":
        loom.is_hidden = True
        loom.save()
    merge_into = {"itself": rug.id, "hidden": loom.id, "missing": 999999}[target]

    response = review(admin_client, open_report, "merge", merge_into=merge_into)

    assert response.status_code == 400
    assert "merge_into" in response.json()["errors"]
    assert Tool.objects.filter(pk=rug.pk).exists()


def test_craft_types_merge_only_within_their_category(admin_client, client_for, user, adder):
    duplicate = CraftType.objects.create(
        name="Kilim rug", category=Category.objects.get(slug="textiles"), created_by=adder
    )
    report_id = report(client_for(user), "craft-types", duplicate).json()["data"]["id"]
    tile = CraftType.objects.get(name="Tile")

    response = review(admin_client, report_id, "merge", merge_into=tile.id)

    assert response.status_code == 400


@pytest.mark.parametrize(("action", "field"), [("rename", "name"), ("merge", "merge_into")])
def test_rename_and_merge_need_their_input(admin_client, open_report, action, field):
    response = review(admin_client, open_report, action)

    assert response.status_code == 400
    assert field in response.json()["errors"]


def test_a_report_is_reviewed_once(admin_client, open_report):
    review(admin_client, open_report, "dismiss")

    assert review(admin_client, open_report, "hide").status_code == 409


def test_reports_on_a_merged_item_can_only_be_dismissed(admin_client, client_for, rug):
    first = report(client_for(UserFactory()), "tools", rug).json()["data"]["id"]
    ItemReport.objects.filter(pk=first).update(status="dismissed")
    second = report(client_for(UserFactory()), "tools", rug).json()["data"]["id"]
    rug.delete()

    assert review(admin_client, second, "hide").status_code == 409
    assert review(admin_client, second, "dismiss").status_code == 200


def test_lookup_changes_are_admin_only_in_the_service(rug, user):
    with pytest.raises(PermissionDeniedError):
        craft_services.hide_lookup(item=rug, actor=user)
