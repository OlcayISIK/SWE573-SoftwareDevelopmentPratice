import { Link } from "react-router";

import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { Pagination } from "@/components/Pagination";

import { REASON_LABELS, type ReportReason } from "../api";
import { StatusTabs } from "../components/StatusTabs";
import { useQueueParams } from "../hooks/useQueueParams";
import { useStoryReviewQueue } from "../queries";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 60 ? `${flat.slice(0, 60).trimEnd()}…` : flat;
}

export function StoryReviewQueuePage() {
  const { status, page, setPage } = useQueueParams();
  const queue = useStoryReviewQueue(status, page);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-4xl font-semibold">Reported stories</h1>
      <p className="mt-2 text-stone-700">Stories users shared about crafts that others reported.</p>
      <StatusTabs basePath="/admin/story-reports" status={status} />

      {queue.isPending ? (
        <PageLoader label="Loading reports" />
      ) : queue.isError ? (
        <p role="alert" className="mt-6">
          Reports could not be loaded.
        </p>
      ) : queue.data.items.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No reports here.">Nothing waits for review in this list.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Reported stories, newest first</caption>
              <thead className="bg-brand-50">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Story
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Craft
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Written by
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
                  <tr
                    key={report.id}
                    className="border-t border-stone-100 transition-colors hover:bg-sky-wash/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/story-reports/${report.id}`}
                        className="font-medium underline"
                      >
                        {preview(report.story.text)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{report.story.craft.name}</td>
                    <td className="px-4 py-3">{report.story.author.display_name}</td>
                    <td className="px-4 py-3">{REASON_LABELS[report.reason as ReportReason]}</td>
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
