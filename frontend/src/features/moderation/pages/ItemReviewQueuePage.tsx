import { Link } from "react-router";

import { Pagination } from "@/components/Pagination";
import { PageLoader } from "@/components/PageLoader";

import { ITEM_KIND_LABELS, ITEM_REASON_LABELS, type ItemKind, type ItemReportReason } from "../api";
import { StatusTabs } from "../components/StatusTabs";
import { useQueueParams } from "../hooks/useQueueParams";
import { useItemReviewQueue } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

const crafts = (count: number) => `${count} craft${count === 1 ? "" : "s"}`;

export function ItemReviewQueuePage() {
  const { status, page, setPage } = useQueueParams();
  const queue = useItemReviewQueue(status, page);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Reported items</h1>
      <p className="mt-2 text-stone-700">
        Categories, craft types, tools, materials, and cultures that users added and others
        reported.
      </p>
      <StatusTabs basePath="/admin/item-reports" status={status} />

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
              <caption className="sr-only">Reported items, newest first</caption>
              <thead className="bg-brand-50">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Kind
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Used by
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Reason
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
                      <Link
                        to={`/admin/item-reports/${report.id}`}
                        className="font-medium underline"
                      >
                        {report.item?.name ?? report.item_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{ITEM_KIND_LABELS[report.item_type as ItemKind]}</td>
                    <td className="px-4 py-3">
                      {report.item ? crafts(report.item.crafts_count) : "Merged away"}
                    </td>
                    <td className="px-4 py-3">
                      {ITEM_REASON_LABELS[report.reason as ItemReportReason]}
                    </td>
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
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
