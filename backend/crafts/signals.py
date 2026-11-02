from django.dispatch import Signal

# Sent inside the publishing transaction with `craft`.
craft_published = Signal()

# Sent inside the update transaction with `craft` and `actor`.
craft_updated = Signal()

# Sent inside the transaction with `story` when a user shares a story about a craft.
story_shared = Signal()
