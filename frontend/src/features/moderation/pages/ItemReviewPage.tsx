import { useState } from "react";
import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { SelectField } from "@/components/form/SelectField";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { TextField } from "@/components/form/TextField";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { toast } from "@/lib/toast";

import {
  ITEM_ACTION_LABELS,
  ITEM_KIND_LABELS,
  ITEM_REASON_LABELS,
  type ItemActionType,
  type ItemKind,
  type ItemReportReason,
  type ItemReportReview,
} from "../api";
import { useItemReport, useMergeTargets, useReviewItemReport } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const crafts = (count: number) => `${count} craft${count === 1 ? "" : "s"}`;

/** What an action changed, as recorded in the review history. */
function changeSummary(details: unknown) {
  const { name, merged_into_name: mergedInto } = (details ?? {}) as {
    name?: string;
    merged_into_name?: string;
  };
  if (name) return `Renamed to “${name}”.`;
  if (mergedInto) return `Merged into “${mergedInto}”.`;
  return null;
}

function ReviewForm({ report }: { report: ItemReportReview }) {
  const kind = report.item_type as ItemKind;
  const item = report.item;
  const review = useReviewItemReport(report.id);
  const [action, setAction] = useState<ItemActionType | null>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const targets = useMergeTargets(kind, action === "merge");
  const options = (targets.data ?? []).filter((target) => target.id !== item?.id);
  const target = options.find((option) => String(option.id) === mergeInto);
  // A merged-away item can only have its report dismissed.
  const actions = (Object.keys(ITEM_ACTION_LABELS) as ItemActionType[]).filter(
    (value) => item || value === "dismiss",
  );

  const submit = () => {
    setError(null);
    review.mutate(
      {
        action: action!,
        reason: reason.trim(),
        ...(action === "rename" ? { name: name.trim() } : {}),
        ...(action === "merge" ? { merge_into: Number(mergeInto) } : {}),
      },
      {
        onSuccess: () => toast.success("The report has been reviewed."),
        onError: (failure) => {
          const apiError = toApiError(failure);
          const messages = Object.values(apiError.fieldErrors).flat();
          setError(messages.length ? messages.join(" ") : apiError.message);
        },
        onSettled: () => setConfirmingMerge(false),
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
        if (action === "rename" && name.trim().length < 2) return setError("Enter the new name.");
        if (action === "merge" && !target) return setError("Choose the item to merge into.");
        if (!reason.trim()) return setError("Explain the reason for this decision.");
        if (action === "merge") return setConfirmingMerge(true);
        submit();
      }}
    >
      <h2 className="text-xl font-semibold">Review</h2>
      <FormAlert>{error}</FormAlert>
      <fieldset className="space-y-2">
        <legend className="font-medium">Action</legend>
        {actions.map((value) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="action"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
            />
            {ITEM_ACTION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {action === "rename" && (
        <TextField
          label="New name"
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      )}
      {action === "hide" && (
        <p className="text-sm text-stone-700">
          It is removed from the lists. Crafts that use it keep showing it.
        </p>
      )}
      {action === "merge" && (
        <SelectField
          label="Merge into"
          value={mergeInto}
          onChange={(event) => setMergeInto(event.target.value)}
        >
          <option value="">
            {targets.isPending ? "Loading…" : `Choose a ${ITEM_KIND_LABELS[kind].toLowerCase()}`}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </SelectField>
      )}
      <TextAreaField
        label="Reason"
        hint="Recorded with the decision."
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <SubmitButton pending={review.isPending}>Submit review</SubmitButton>
      {confirmingMerge && target && item && (
        <ConfirmDialog
          title={`Merge “${item.name}” into “${target.name}”?`}
          confirmLabel="Merge"
          tone="danger"
          pending={review.isPending}
          onCancel={() => setConfirmingMerge(false)}
          onConfirm={submit}
        >
          The {crafts(item.crafts_count)} that use “{item.name}” will use “{target.name}” instead,
          and “{item.name}” will be deleted. Other open reports on it will be closed too.
        </ConfirmDialog>
      )}
    </form>
  );
}

export function ItemReviewPage() {
  const { id } = useParams();
  const reportId = Number(id);
  const valid = Number.isInteger(reportId) && reportId > 0;
  const report = useItemReport(valid ? reportId : null);

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
  const kindLabel = ITEM_KIND_LABELS[data.item_type as ItemKind];
  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin/item-reports" className="text-sm font-medium text-brand-700 underline">
        Back to reported items
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        Report on the {kindLabel.toLowerCase()} “{data.item_name}”
      </h1>
      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-lg border border-brand-100 bg-white p-5 sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium">Kind</dt>
        <dd>{kindLabel}</dd>
        <dt className="font-medium">Item now</dt>
        <dd>
          {data.item
            ? `${data.item.name}${data.item.is_hidden ? " (hidden)" : ""}`
            : "Merged away or deleted"}
        </dd>
        {data.item && (
          <>
            <dt className="font-medium">Added by</dt>
            <dd>{data.item.added_by?.display_name ?? "Unknown"}</dd>
            <dt className="font-medium">Used by</dt>
            <dd>{crafts(data.item.crafts_count)}</dd>
          </>
        )}
        <dt className="font-medium">Reason</dt>
        <dd>{ITEM_REASON_LABELS[data.reason as ItemReportReason]}</dd>
        <dt className="font-medium">Details</dt>
        <dd className="whitespace-pre-line">{data.note || "No details given."}</dd>
        <dt className="font-medium">Reported by</dt>
        <dd>{data.reporter.display_name}</dd>
        <dt className="font-medium">Reported</dt>
        <dd>{dateFormat.format(new Date(data.created_at))}</dd>
        <dt className="font-medium">Report status</dt>
        <dd className="capitalize">{data.status}</dd>
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
                  {ITEM_ACTION_LABELS[entry.action as ItemActionType]} by {entry.admin.display_name}
                </p>
                <p className="text-sm text-stone-600">
                  {dateFormat.format(new Date(entry.created_at))}
                </p>
                {changeSummary(entry.details) && (
                  <p className="mt-2">{changeSummary(entry.details)}</p>
                )}
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
