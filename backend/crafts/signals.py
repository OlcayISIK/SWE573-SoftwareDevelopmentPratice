from django.dispatch import Signal

# Sent inside the publishing transaction with `craft`.
craft_published = Signal()

# Sent inside the update transaction with `craft` and `actor`.
craft_updated = Signal()
