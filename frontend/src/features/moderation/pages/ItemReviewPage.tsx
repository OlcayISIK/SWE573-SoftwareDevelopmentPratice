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
import { WikidataPicker } from "@/features/crafts/form/WikidataPicker";
import { wikidataUrl } from "@/features/crafts/wikidata";
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

/** Other names typed one per line or separated by commas, each once. */
function parseNames(text: string) {
  const names = text
    .split(/[\n,]/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  return names.filter(
    (name, index) =>
      names.findIndex((other) => other.toLowerCase() === name.toLowerCase()) === index,
  );
}

const sameNames = (a: string[], b: string[]) => a.join("\n") === b.join("\n");

/** What an action changed, as recorded in the review history. */
function changeSummary(details: unknown) {
  const {
    name,
    description,
    merged_into_name: mergedInto,
    wikidata_id: wikidataId,
    other_names: otherNames,
  } = (details ?? {}) as {
    name?: string;
    description?: string;
    merged_into_name?: string;
    wikidata_id?: string;
    other_names?: string[];
  };
  if (mergedInto) return `Merged into “${mergedInto}”.`;
  const changes = [
    name && `Renamed to “${name}”.`,
    description !== undefined &&
      (description ? `Description set to “${description}”.` : "Description removed."),
    wikidataId !== undefined &&
      (wikidataId ? `Linked to Wikidata ${wikidataId}.` : "Wikidata link removed."),
    otherNames !== undefined &&
      (otherNames.length ? `Other names set to ${otherNames.join(", ")}.` : "Other names removed."),
  ].filter(Boolean);
  return changes.length ? changes.join(" ") : null;
}

function ReviewForm({ report }: { report: ItemReportReview }) {
  const kind = report.item_type as ItemKind;
  const item = report.item;
  const review = useReviewItemReport(report.id);
  const [action, setAction] = useState<ItemActionType | null>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [wikidataId, setWikidataId] = useState(item?.wikidata_id ?? "");
  const [wikidataSearch, setWikidataSearch] = useState(item?.name ?? "");
  const [otherNames, setOtherNames] = useState((item?.other_names ?? []).join("\n"));
  // Only the fields the admin changed are sent.
  const names = parseNames(otherNames);
  const edits = {
    ...(name.trim() !== item?.name ? { name: name.trim() } : {}),
    ...(description.trim() !== item?.description ? { description: description.trim() } : {}),
    ...(wikidataId.trim() !== (item?.wikidata_id ?? "") ? { wikidata_id: wikidataId.trim() } : {}),
    ...(!sameNames(names, item?.other_names ?? []) ? { other_names: names } : {}),
  };
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
        ...(action === "edit" ? edits : {}),
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
      className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      onSubmit={(event) => {
        event.preventDefault();
        if (!action) return setError("Choose an action.");
        if (action === "edit" && name.trim().length < 2) return setError("Enter the name.");
        if (action === "edit" && Object.keys(edits).length === 0) {
          return setError("Change the name, description, Wikidata link, or other names.");
        }
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
      {action === "edit" && (
        <>
          <TextField
            label="Name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextAreaField
            label="Description"
            hint="Shown when people point at the item."
            rows={3}
            maxLength={300}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <TextAreaField
            label="Other names"
            hint="One per line, such as rug for Carpet. Searches find the item by these names too."
            rows={3}
            value={otherNames}
            onChange={(event) => setOtherNames(event.target.value)}
          />
          <fieldset className="space-y-3 rounded bg-brand-50 p-3">
            <legend className="font-medium">Wikidata link</legend>
            <p className="text-sm text-stone-700">
              Its names in English and Turkish come from the linked Wikidata item.
            </p>
            <TextField
              label="Wikidata item"
              hint="An id such as Q163446. Leave it empty to remove the link."
              maxLength={16}
              value={wikidataId}
              onChange={(event) => setWikidataId(event.target.value)}
            />
            <TextField
              label="Find on Wikidata"
              maxLength={80}
              value={wikidataSearch}
              onChange={(event) => setWikidataSearch(event.target.value)}
            />
            <WikidataPicker
              name={wikidataSearch}
              value={wikidataId}
              onChange={(picked) => picked && setWikidataId(picked)}
            />
          </fieldset>
        </>
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
      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:grid-cols-[10rem_1fr]">
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
            <dt className="font-medium">Description</dt>
            <dd>{data.item.description || "None"}</dd>
            <dt className="font-medium">Added by</dt>
            <dd>{data.item.added_by?.display_name ?? "Unknown"}</dd>
            <dt className="font-medium">Used by</dt>
            <dd>{crafts(data.item.crafts_count)}</dd>
            <dt className="font-medium">Wikidata</dt>
            <dd>
              {data.item.wikidata_id ? (
                <a
                  href={wikidataUrl(data.item.wikidata_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {data.item.wikidata_id}
                </a>
              ) : (
                "Not linked"
              )}
            </dd>
            <dt className="font-medium">Other names</dt>
            <dd>{[...data.item.other_names, ...data.item.wikidata_names].join(", ") || "None"}</dd>
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
              <li key={entry.id} className="card p-4">
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
