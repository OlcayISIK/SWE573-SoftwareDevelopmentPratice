import { useState } from "react";
import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "@/lib/toast";

import {
  REASON_LABELS,
  STORY_ACTION_LABELS,
  type ReportReason,
  type StoryActionType,
  type StoryReportReview,
} from "../api";
import { useReviewStoryReport, useStoryReport } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function storyState(story: StoryReportReview["story"]) {
  if (story.is_deleted) return "Removed";
  return story.status === "hidden" ? "Hidden" : "Published";
}

function ReviewForm({ report }: { report: StoryReportReview }) {
  const review = useReviewStoryReport(report.id);
  const [action, setAction] = useState<StoryActionType | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const submit = () => {
    setError(null);
    review.mutate(
      { action: action!, reason: reason.trim() },
      {
        onSuccess: () => toast.success("The report has been reviewed."),
        onError: (failure) => setError(toApiError(failure).message),
        onSettled: () => setConfirmingRemove(false),
      },
    );
  };

  return (
    <form
      noValidate
      className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      onSubmit={(event) => {
        event.preventDefault();
        if (!action) return setError("Choose an action.");
        if (!reason.trim()) return setError("Explain the reason for this decision.");
        if (action === "remove") return setConfirmingRemove(true);
        submit();
      }}
    >
      <h2 className="text-xl font-semibold">Review</h2>
      <FormAlert>{error}</FormAlert>
      <fieldset className="space-y-2">
        <legend className="font-medium">Action</legend>
        {(Object.keys(STORY_ACTION_LABELS) as StoryActionType[]).map((value) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="action"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
            />
            {STORY_ACTION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Reason"
        hint="Recorded with the decision and shared with the reporter."
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <SubmitButton pending={review.isPending}>Submit review</SubmitButton>
      {confirmingRemove && (
        <ConfirmDialog
          title="Remove this story?"
          confirmLabel="Remove story"
          tone="danger"
          pending={review.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={submit}
        >
          The story by {report.story.author.display_name} will be removed from “
          {report.story.craft.name}”. Other open reports on it will be closed too.
        </ConfirmDialog>
      )}
    </form>
  );
}

export function StoryReviewPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const valid = Number.isInteger(reportId) && reportId > 0;
  const report = useStoryReport(valid ? reportId : null);

  if (!valid || (report.isError && toApiError(report.error).status === 404)) {
    return <NotFoundPage title="Report not found" message="This report does not exist." />;
  }
  if (report.isPending) return <PageLoader label="Loading the report" />;
  if (report.isError) {
    return (
      <p role="alert" className="mx-auto max-w-4xl px-4 py-12">
        This report could not be loaded.
      </p>
    );
  }

  const data = report.data;
  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin/story-reports" className="text-sm font-medium text-brand-700 underline">
        Back to reported stories
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        Report on a story about “{data.story.craft.name}”
      </h1>

      <figure className="mt-6 rounded-xl bg-sand-light p-5 shadow-sm ring-1 ring-sand">
        <blockquote className="whitespace-pre-line text-lg leading-relaxed">
          {data.story.text}
        </blockquote>
        <figcaption className="mt-3 text-sm text-stone-700">
          Written by {data.story.author.display_name}
        </figcaption>
      </figure>

      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium">Reason</dt>
        <dd>{REASON_LABELS[data.reason as ReportReason]}</dd>
        <dt className="font-medium">Details</dt>
        <dd className="whitespace-pre-line">{data.note || "No details given."}</dd>
        <dt className="font-medium">Reported by</dt>
        <dd>{data.reporter.display_name}</dd>
        <dt className="font-medium">Reported</dt>
        <dd>{dateFormat.format(new Date(data.created_at))}</dd>
        <dt className="font-medium">Report status</dt>
        <dd className="capitalize">{data.status}</dd>
        <dt className="font-medium">Story</dt>
        <dd>{storyState(data.story)}</dd>
        <dt className="font-medium">Craft</dt>
        <dd>
          <Link to={`/crafts/${data.story.craft.id}`} className="underline">
            {data.story.craft.name}
          </Link>
        </dd>
      </dl>

      {data.actions.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-8">
          <h2 id="history-heading" className="text-xl font-semibold">
            Review history
          </h2>
          <ol className="mt-3 space-y-3">
            {data.actions.map((entry) => (
              <li key={entry.id} className="card p-4">
                <p className="font-medium">
                  {STORY_ACTION_LABELS[entry.action as StoryActionType]} by{" "}
                  {entry.admin.display_name}
                </p>
                <p className="text-sm text-stone-600">
                  {dateFormat.format(new Date(entry.created_at))}
                </p>
                <p className="mt-2">{entry.reason}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {data.status === "open" && <ReviewForm report={data} />}
    </section>
  );
}
