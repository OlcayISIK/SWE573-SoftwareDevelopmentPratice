import { useState } from "react";
import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { useCraft } from "@/features/crafts/queries";
import { toast } from "@/lib/toast";

import {
  ACTION_LABELS,
  REASON_LABELS,
  type CraftTextChanges,
  type ReportReason,
  type ReportReview,
  type ReviewActionType,
} from "../api";
import { useReport, useReviewReport } from "../queries";

const TEXT_FIELDS: [keyof CraftTextChanges, string][] = [
  ["name", "Name"],
  ["description", "Description"],
  ["story", "Story"],
];

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function EditChanges({
  craftId,
  changes,
  onChange,
}: {
  craftId: number;
  changes: CraftTextChanges;
  onChange: (changes: CraftTextChanges) => void;
}) {
  const craft = useCraft(craftId);
  if (craft.isPending) return <PageLoader label="Loading the craft" />;
  if (craft.isError) return <FormAlert>The craft could not be loaded for editing.</FormAlert>;

  return (
    <fieldset className="space-y-4 rounded border border-stone-300 p-4">
      <legend className="px-1 font-medium">Corrections</legend>
      <p className="text-sm text-stone-600">Only the fields you change are sent.</p>
      {TEXT_FIELDS.map(([field, label]) => {
        const value = changes[field] ?? craft.data[field];
        const update = (next: string) => {
          const updated = { ...changes };
          if (next === craft.data[field]) delete updated[field];
          else updated[field] = next;
          onChange(updated);
        };
        return field === "name" ? (
          <TextField
            key={field}
            label={label}
            value={value}
            onChange={(e) => update(e.target.value)}
          />
        ) : (
          <TextAreaField
            key={field}
            label={label}
            value={value}
            onChange={(e) => update(e.target.value)}
          />
        );
      })}
    </fieldset>
  );
}

function ReviewForm({ report }: { report: ReportReview }) {
  const review = useReviewReport(report.id);
  const [action, setAction] = useState<ReviewActionType | null>(null);
  const [reason, setReason] = useState("");
  const [changes, setChanges] = useState<CraftTextChanges>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const submit = () => {
    setError(null);
    review.mutate(
      { action: action!, reason: reason.trim(), ...(action === "edit" ? { changes } : {}) },
      {
        onSuccess: () => toast.success("The report has been reviewed."),
        onError: (failure) => {
          const apiError = toApiError(failure);
          const fieldMessages = Object.entries(apiError.fieldErrors).map(
            ([field, messages]) => `${field}: ${messages.join(" ")}`,
          );
          setError(fieldMessages.length ? fieldMessages.join(" ") : apiError.message);
        },
        onSettled: () => setConfirmingRemove(false),
      },
    );
  };

  return (
    <form
      noValidate
      className="mt-8 space-y-6 rounded-lg border border-brand-100 bg-white p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!action) return setError("Choose an action.");
        if (!reason.trim()) return setError("Explain the reason for this decision.");
        if (action === "edit" && Object.keys(changes).length === 0) {
          return setError("Make at least one correction to the craft.");
        }
        if (action === "remove") return setConfirmingRemove(true);
        submit();
      }}
    >
      <h2 className="text-xl font-semibold">Review</h2>
      <FormAlert>{error}</FormAlert>
      <fieldset className="space-y-2">
        <legend className="font-medium">Action</legend>
        {(Object.keys(ACTION_LABELS) as ReviewActionType[]).map((value) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="action"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
            />
            {ACTION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {action === "edit" && (
        <EditChanges craftId={report.craft.id} changes={changes} onChange={setChanges} />
      )}
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
          title="Remove this craft?"
          confirmLabel="Remove craft"
          tone="danger"
          pending={review.isPending}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={submit}
        >
          “{report.craft.name}” will be removed from the site. Other open reports on it will be
          closed too.
        </ConfirmDialog>
      )}
    </form>
  );
}

export function ReviewReportPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const valid = Number.isInteger(reportId) && reportId > 0;
  const report = useReport(valid ? reportId : null);

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
      <Link to="/admin/reports" className="text-sm font-medium text-brand-700 underline">
        Back to reported crafts
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">Report on “{data.craft.name}”</h1>
      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-lg border border-brand-100 bg-white p-5 sm:grid-cols-[10rem_1fr]">
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
        <dt className="font-medium">Craft</dt>
        <dd>
          {data.craft.is_deleted ? (
            "Removed"
          ) : (
            <Link to={`/crafts/${data.craft.id}`} className="underline">
              View craft ({data.craft.status}) by {data.craft.author.display_name}
            </Link>
          )}
        </dd>
      </dl>

      {data.actions.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-8">
          <h2 id="history-heading" className="text-xl font-semibold">
            Review history
          </h2>
          <ol className="mt-3 space-y-3">
            {data.actions.map((entry) => (
              <li key={entry.id} className="rounded border border-brand-100 bg-white p-4">
                <p className="font-medium">
                  {ACTION_LABELS[entry.action as ReviewActionType]} by {entry.admin.display_name}
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
