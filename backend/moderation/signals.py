from django.dispatch import Signal

# Sent inside the review transaction with `report`, `admin`, and `action`.
report_resolved = Signal()
