import { useState } from "react";

import { useAuth } from "@/features/auth/context";
import { PracticeStatusDialog } from "@/features/moderation/components/PracticeStatusDialog";
import { SignInPrompt } from "@/features/social/components/SignInPrompt";

import { PRACTICE_STATUS_HINTS, type PracticeStatus } from "../../practiceStatus";
import type { CraftDetail } from "../../types";
import { PracticeStatusBadge, SourceText } from "../PracticeStatusBadge";

/**
 * Whether the craft is still practiced, and the source that says so. Signed-in users can
 * propose a status with a source for admins to review; admins can set it directly.
 */
export function PracticeStatusPanel({ craft }: { craft: CraftDetail }) {
  const auth = useAuth();
  const [dialog, setDialog] = useState<"propose" | "set" | null>(null);
  const known = craft.practice_status !== "unknown";
  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

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
          Not known yet. If a reliable source says whether it is living, endangered, or no longer
          practiced, you can propose it.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {auth.status === "guest" && <SignInPrompt label="Log in to propose a status" />}
        {auth.status === "authenticated" && !isAdmin && (
          <button type="button" className="btn-secondary" onClick={() => setDialog("propose")}>
            Propose a status
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
