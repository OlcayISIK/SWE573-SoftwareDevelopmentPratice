import { useState } from "react";
import { Link } from "react-router";

import { useAuth } from "@/features/auth/context";
import { PracticeStatusDialog } from "@/features/moderation/components/PracticeStatusDialog";
import { SignInPrompt } from "@/features/social/components/SignInPrompt";

import { PRACTICE_STATUS_HINTS, type PracticeStatus } from "../../practiceStatus";
import type { CraftDetail } from "../../types";
import { PracticeStatusBadge, SourceText } from "../PracticeStatusBadge";

/**
 * Whether the craft is still practiced, and the source that says so. The author sets it in the
 * craft form; other users can report it if they think it is wrong, and admins review the report
 * or set it directly.
 */
export function PracticeStatusPanel({ craft }: { craft: CraftDetail }) {
  const auth = useAuth();
  const [dialog, setDialog] = useState<"report" | "set" | null>(null);
  const known = craft.practice_status !== "unknown";
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";
  const isAuthor = auth.status === "authenticated" && auth.user.id === craft.author.id;
  const reportLabel = known ? "Report this status" : "Suggest a status";

  return (
    <section
      aria-labelledby="practice-heading"
      className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
    >
      <h2 id="practice-heading" className="text-lg font-semibold">
        Is it still practiced?
      </h2>
      {known ? (
        <div className="mt-3 space-y-2">
          <PracticeStatusBadge status={craft.practice_status} />
          <p className="text-sm text-stone-700">
            {PRACTICE_STATUS_HINTS[craft.practice_status as PracticeStatus]}
          </p>
          {craft.practice_status_source && (
            <p className="text-sm text-stone-700">
              <span className="font-semibold">Source: </span>
              <SourceText source={craft.practice_status_source} />
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-stone-700">
          Not known yet. If you know whether it is living, endangered, or no longer practiced, you
          can suggest it.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {auth.status === "guest" && (
          <SignInPrompt
            label={known ? "Log in to report this status" : "Log in to suggest a status"}
          />
        )}
        {isAuthor && !isAdmin && (
          <Link to={`/crafts/${craft.id}/edit`} className="btn-secondary">
            Change it in the edit form
          </Link>
        )}
        {auth.status === "authenticated" && !isAdmin && !isAuthor && (
          <button type="button" className="btn-secondary" onClick={() => setDialog("report")}>
            {reportLabel}
          </button>
        )}
        {isAdmin && (
          <button type="button" className="btn-secondary" onClick={() => setDialog("set")}>
            Set the status
          </button>
        )}
      </div>
      {dialog && (
        <PracticeStatusDialog craft={craft} mode={dialog} onClose={() => setDialog(null)} />
      )}
    </section>
  );
}
