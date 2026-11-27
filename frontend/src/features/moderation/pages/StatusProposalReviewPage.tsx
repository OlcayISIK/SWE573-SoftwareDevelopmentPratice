import { useState } from "react";
import { Link, useParams } from "react-router";

import { toApiError } from "@/api/envelope";
import { FormAlert } from "@/components/form/FormAlert";
import { SubmitButton } from "@/components/form/SubmitButton";
import { TextAreaField } from "@/components/form/TextAreaField";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PageLoader } from "@/components/PageLoader";
import { SourceText } from "@/features/crafts/components/PracticeStatusBadge";
import { PRACTICE_STATUS_LABELS, type PracticeStatus } from "@/features/crafts/practiceStatus";
import { toast } from "@/lib/toast";

import { PROPOSAL_ACTION_LABELS, type ProposalAction, type StatusProposalReview } from "../api";
import { useReviewStatusProposal, useStatusProposal } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const statusLabel = (status: string) => PRACTICE_STATUS_LABELS[status as PracticeStatus];

function craftState(craft: StatusProposalReview["craft"]) {
  if (craft.is_deleted) return "Removed";
  return craft.status === "hidden" ? "Hidden" : "Published";
}

function ReviewForm({ proposal }: { proposal: StatusProposalReview }) {
  const review = useReviewStatusProposal(proposal.id);
  const [action, setAction] = useState<ProposalAction | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      className="mt-8 space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      onSubmit={(event) => {
        event.preventDefault();
        if (!action) return setError("Choose accept or reject.");
        if (!reason.trim()) return setError("Explain the reason for this decision.");
        setError(null);
        review.mutate(
          { action, reason: reason.trim() },
          {
            onSuccess: () => toast.success("The report has been reviewed."),
            onError: (failure) => setError(toApiError(failure).message),
          },
        );
      }}
    >
      <h2 className="text-xl font-semibold">Review</h2>
      <FormAlert>{error}</FormAlert>
      <fieldset className="space-y-2">
        <legend className="font-medium">Decision</legend>
        {(Object.keys(PROPOSAL_ACTION_LABELS) as ProposalAction[]).map((value) => (
          <label key={value} className="flex items-center gap-3">
            <input
              type="radio"
              name="action"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
            />
            {PROPOSAL_ACTION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Reason"
        hint="Recorded with the decision and shared with the person who reported it."
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <SubmitButton pending={review.isPending}>Submit review</SubmitButton>
    </form>
  );
}

export function StatusProposalReviewPage() {
  const { id } = useParams();
  const proposalId = Number(id);
  const valid = Number.isInteger(proposalId) && proposalId > 0;
  const proposal = useStatusProposal(valid ? proposalId : null);

  if (!valid || (proposal.isError && toApiError(proposal.error).status === 404)) {
    return <NotFoundPage title="Report not found" message="This report does not exist." />;
  }
  if (proposal.isPending) return <PageLoader label="Loading the report" />;
  if (proposal.isError) {
    return (
      <p role="alert" className="mx-auto max-w-4xl px-4 py-12">
        This report could not be loaded.
      </p>
    );
  }

  const data = proposal.data;
  return (
    <section className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/admin/status-proposals" className="text-sm font-medium text-brand-700 underline">
        Back to reported statuses
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        Report on the practice status of “{data.craft.name}”
      </h1>

      <dl className="mt-6 grid gap-x-6 gap-y-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200 sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium">Should be</dt>
        <dd>
          {data.practice_status === "unknown"
            ? "Not sure, but the current status is wrong"
            : statusLabel(data.practice_status)}
        </dd>
        <dt className="font-medium">Source</dt>
        <dd className="whitespace-pre-line">
          {data.source ? <SourceText source={data.source} /> : "No source given."}
        </dd>
        <dt className="font-medium">Note</dt>
        <dd className="whitespace-pre-line">{data.note || "No note given."}</dd>
        <dt className="font-medium">Reported by</dt>
        <dd>{data.proposer.display_name}</dd>
        <dt className="font-medium">Reported</dt>
        <dd>{dateFormat.format(new Date(data.created_at))}</dd>
        <dt className="font-medium">Report status</dt>
        <dd className="capitalize">{data.status}</dd>
        <dt className="font-medium">Craft</dt>
        <dd>
          <Link to={`/crafts/${data.craft.id}`} className="underline">
            {data.craft.name}
          </Link>{" "}
          ({craftState(data.craft)})
        </dd>
        <dt className="font-medium">Marked as</dt>
        <dd>
          {statusLabel(data.craft.practice_status)}
          {data.craft.practice_status_source && (
            <span className="block text-sm text-stone-600">
              Source: <SourceText source={data.craft.practice_status_source} />
            </span>
          )}
        </dd>
      </dl>

      {data.reviewed_by && data.reviewed_at && (
        <section aria-labelledby="decision-heading" className="mt-8">
          <h2 id="decision-heading" className="text-xl font-semibold">
            Decision
          </h2>
          <div className="card mt-3 p-4">
            <p className="font-medium capitalize">
              {data.status} by {data.reviewed_by.display_name}
            </p>
            <p className="text-sm text-stone-600">
              {dateFormat.format(new Date(data.reviewed_at))}
            </p>
            <p className="mt-2">{data.review_reason}</p>
          </div>
        </section>
      )}

      {data.status === "open" && <ReviewForm proposal={data} />}
    </section>
  );
}
