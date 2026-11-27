import type { ReactNode } from "react";
import { Link } from "react-router";

import { PRACTICE_STATUS_LABELS, type PracticeStatus } from "@/features/crafts/practiceStatus";

import type { AppNotification } from "../api";

const REVIEW_OUTCOMES: Record<string, string> = {
  hide: "the craft was hidden",
  remove: "the craft was removed",
  edit: "the craft was corrected",
  dismiss: "no change was needed",
};

const STORY_OUTCOMES: Record<string, string> = {
  hide: "the story was hidden",
  remove: "the story was removed",
  dismiss: "no change was needed",
};

const timeFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

function message(notification: AppNotification): ReactNode {
  const actor = notification.actor?.display_name ?? "Someone";
  const craft = notification.craft;
  const craftLink = craft ? (
    <Link to={`/crafts/${craft.id}`} className="font-medium underline">
      {craft.name}
    </Link>
  ) : null;
  const data = (notification.data ?? {}) as {
    action?: string;
    subject?: string;
    decision?: string;
    practice_status?: PracticeStatus;
  };
  const status = PRACTICE_STATUS_LABELS[data.practice_status ?? "unknown"]?.toLowerCase();

  switch (notification.type) {
    case "new_craft_from_followed":
      return craftLink ? (
        <>
          {actor} added {craftLink}.
        </>
      ) : (
        `${actor} added a craft that is no longer available.`
      );
    case "favorite_updated":
      return craftLink ? (
        <>{craftLink}, one of your favorites, was updated.</>
      ) : (
        "A craft you favorited was updated, but it is no longer available."
      );
    case "report_resolved": {
      if (data.subject === "story") {
        const outcome = STORY_OUTCOMES[data.action ?? ""] ?? "it was reviewed";
        return craftLink ? (
          <>
            Your report on a story about {craftLink} was reviewed: {outcome}.
          </>
        ) : (
          `Your report on a story was reviewed: ${outcome}.`
        );
      }
      const outcome = REVIEW_OUTCOMES[data.action ?? ""] ?? "it was reviewed";
      return craftLink ? (
        <>
          Your report on {craftLink} was reviewed: {outcome}.
        </>
      ) : (
        `Your report was reviewed: ${outcome}.`
      );
    }
    case "new_story":
      return craftLink ? (
        <>
          {actor} shared a story about {craftLink}.
        </>
      ) : (
        `${actor} shared a story about a craft that is no longer available.`
      );
    case "practice_status_changed":
      return craftLink ? (
        <>
          {craftLink}, one of your favorites, is now marked as {status}.
        </>
      ) : (
        `A craft you favorited is now marked as ${status}.`
      );
    case "status_proposal_reviewed": {
      const outcome =
        data.decision === "approved"
          ? `accepted, so it is now marked as ${status}`
          : "reviewed, and the status was kept";
      return craftLink ? (
        <>
          Your report on the practice status of {craftLink} was {outcome}.
        </>
      ) : (
        `Your report on a practice status was ${outcome}.`
      );
    }
    default:
      return "You have a new notification.";
  }
}

export function NotificationItem({ notification }: { notification: AppNotification }) {
  return (
    <li
      className={`animate-fade-up relative rounded-xl px-5 py-4 shadow-sm ring-1 transition-colors ${
        notification.is_read ? "bg-white ring-stone-200" : "bg-sky-wash/70 ring-brand-200"
      }`}
    >
      {!notification.is_read && (
        <span
          aria-hidden="true"
          className="absolute left-2 top-5 h-1.5 w-1.5 rounded-full bg-brand-700"
        />
      )}
      <p className={notification.is_read ? "" : "font-medium"}>
        {!notification.is_read && <span className="sr-only">New: </span>}
        {message(notification)}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        {timeFormat.format(new Date(notification.created_at))}
      </p>
    </li>
  );
}
