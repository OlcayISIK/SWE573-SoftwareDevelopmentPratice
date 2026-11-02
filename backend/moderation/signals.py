from django.dispatch import Signal

# Sent inside the review transaction with `report`, `admin`, and `action`.
report_resolved = Signal()

# Sent inside the review transaction with `report` (a StoryReport), `admin`, and `action`.
story_report_resolved = Signal()
