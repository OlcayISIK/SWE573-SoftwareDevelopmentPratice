import { Link, useSearchParams } from "react-router";

import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";

import { REASON_LABELS, type QueueStatus, type ReportReason } from "../api";
import { useReviewQueue } from "../queries";

const TABS: [QueueStatus, string][] = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["all", "All"],
];

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export function ReviewQueuePage() {
  const [params, setParams] = useSearchParams();
  const status = (TABS.find(([value]) => value === params.get("status"))?.[0] ??
    "open") as QueueStatus;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const queue = useReviewQueue(status, page);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Review queue</h1>
      <nav aria-label="Report status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            to={value === "open" ? "/admin/reports" : `/admin/reports?status=${value}`}
            aria-current={status === value ? "page" : undefined}
            className={`rounded px-3 py-2 text-sm font-medium ${
              status === value ? "bg-brand-700 text-white" : "bg-white hover:bg-brand-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {queue.isPending ? (
        <PageLoader label="Loading reports" />
      ) : queue.isError ? (
        <p role="alert" className="mt-6">
          Reports could not be loaded.
        </p>
      ) : queue.data.items.length === 0 ? (
        <p className="mt-6 text-stone-700">No reports here.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-lg border border-brand-100 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Reports, newest first</caption>
              <thead className="bg-brand-50">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Craft
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reason
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reported by
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reported
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.data.items.map((report) => (
                  <tr key={report.id} className="border-t border-brand-100">
                    <td className="px-4 py-3">
                      <Link to={`/admin/reports/${report.id}`} className="font-medium underline">
                        {report.craft.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{REASON_LABELS[report.reason as ReportReason]}</td>
                    <td className="px-4 py-3">{report.reporter.display_name}</td>
                    <td className="px-4 py-3">{dateFormat.format(new Date(report.created_at))}</td>
                    <td className="px-4 py-3 capitalize">{report.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={queue.data.page}
            totalPages={queue.data.totalPages}
            onChange={(next) =>
              setParams((current) => {
                const updated = new URLSearchParams(current);
                updated.set("page", String(next));
                return updated;
              })
            }
          />
        </>
      )}
    </section>
  );
}
