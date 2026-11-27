import { Link } from "react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { Pagination } from "@/components/Pagination";
import { PRACTICE_STATUS_LABELS, type PracticeStatus } from "@/features/crafts/practiceStatus";

import type { ProposalQueueStatus } from "../api";
import { StatusTabs } from "../components/StatusTabs";
import { PROPOSAL_TABS, useQueueParams } from "../hooks/useQueueParams";
import { useStatusProposalQueue } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function StatusProposalQueuePage() {
  const { status, page, setPage } = useQueueParams<ProposalQueueStatus>(PROPOSAL_TABS);
  const queue = useStatusProposalQueue(status, page);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-semibold">Status proposals</h1>
      <p className="mt-2 text-stone-700">
        Users propose whether a craft is still practiced, with a source. Check the source, then
        approve or reject.
      </p>
      <StatusTabs
        basePath="/admin/status-proposals"
        status={status}
        tabs={PROPOSAL_TABS}
        label="Proposal status"
      />

      {queue.isPending ? (
        <PageLoader label="Loading proposals" />
      ) : queue.isError ? (
        <p role="alert" className="mt-6">
          Proposals could not be loaded.
        </p>
      ) : queue.data.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No proposals here.">Nothing waits for review in this list.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Practice status proposals, open ones first</caption>
              <thead className="bg-brand-50">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Craft
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Proposed status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Proposed by
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Proposed
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.data.items.map((proposal) => (
                  <tr
                    key={proposal.id}
                    className="border-t border-stone-100 transition-colors hover:bg-sky-wash/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/status-proposals/${proposal.id}`}
                        className="font-medium underline"
                      >
                        {proposal.craft.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {PRACTICE_STATUS_LABELS[proposal.practice_status as PracticeStatus]}
                    </td>
                    <td className="px-4 py-3">{proposal.proposer.display_name}</td>
                    <td className="px-4 py-3">
                      {dateFormat.format(new Date(proposal.created_at))}
                    </td>
                    <td className="px-4 py-3 capitalize">{proposal.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={queue.data.page}
            totalPages={queue.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
