import { ChevronDown, Pencil, PenLine, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { toApiError } from "@/api/envelope";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormAlert } from "@/components/form/FormAlert";
import { TextAreaField } from "@/components/form/TextAreaField";
import { useAuth } from "@/features/auth/context";
import { SignInPrompt } from "@/features/social/components/SignInPrompt";
import { toast } from "@/lib/toast";

import { useStories, useStoryBy, useStoryMutations } from "../../queries";
import type { CraftDetail, CraftStory } from "../../types";
import { RichText } from "./RichText";

const MAX_STORY_LENGTH = 5000;
const PREVIEW_LENGTH = 120;
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

interface Writer {
  id: number;
  display_name: string;
}

interface Entry {
  key: string;
  writer: Writer;
  date: string;
  text: string;
  badge?: string;
  story?: CraftStory;
}

function preview(text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** One story in the accordion. The header names the writer; the panel holds the whole story. */
function StoryItem({
  entry,
  defaultOpen = false,
  children,
}: {
  entry: Entry;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;

  return (
    <li className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
      <h3>
        <button
          id={headerId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-mist"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-wash font-sans text-sm font-semibold text-brand-900"
          >
            {initials(entry.writer.display_name)}
          </span>
          <span className="min-w-0 flex-1 font-sans">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-deep-sea">{entry.writer.display_name}</span>
              {entry.badge && (
                <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-deep-sea">
                  {entry.badge}
                </span>
              )}
              <time dateTime={entry.date} className="text-sm font-normal text-stone-600">
                {dateFormat.format(new Date(entry.date))}
              </time>
            </span>
            {!open && (
              <span className="mt-1 block text-sm font-normal text-stone-600">
                {preview(entry.text)}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`mt-2 h-5 w-5 shrink-0 text-stone-500 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </h3>
      <div id={panelId} aria-labelledby={headerId} hidden={!open} className="px-5 pb-5 sm:pl-17">
        {children}
      </div>
    </li>
  );
}

function StoryForm({
  initial = "",
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (text: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!text.trim()) {
          setFieldError("Write your story first.");
          return;
        }
        setError(null);
        setFieldError(undefined);
        try {
          await onSubmit(text.trim());
        } catch (failure) {
          const apiError = toApiError(failure);
          const textErrors = apiError.errors.text;
          if (Array.isArray(textErrors) && textErrors.length) {
            setFieldError(String(textErrors[0]));
          } else {
            setError(apiError.message);
          }
        }
      }}
    >
      <FormAlert>{error}</FormAlert>
      <TextAreaField
        label="Your story"
        rows={6}
        maxLength={MAX_STORY_LENGTH}
        value={text}
        error={fieldError}
        hint={`What the craft means to you, how it is made where you live, or its history. ${text.length} / ${MAX_STORY_LENGTH} characters.`}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Edit and delete for the story's writer and admins. */
function StoryActions({ craftId, story }: { craftId: number; story: CraftStory }) {
  const { edit, remove } = useStoryMutations(craftId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <div className="mt-4">
        <StoryForm
          initial={story.text}
          submitLabel="Save story"
          pending={edit.isPending}
          onCancel={() => setEditing(false)}
          onSubmit={async (text) => {
            await edit.mutateAsync({ storyId: story.id, text });
            toast.success("Your story was updated.");
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
        <Pencil aria-hidden="true" className="h-4 w-4" />
        Edit story
      </button>
      <button
        type="button"
        className="btn border border-red-200 bg-white text-red-800 hover:border-red-400 hover:bg-red-50"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
        Delete story
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this story?"
          confirmLabel="Delete story"
          tone="danger"
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            remove.mutate(story.id, {
              onSuccess: () => toast.success("The story was deleted."),
              onSettled: () => setConfirming(false),
            })
          }
        >
          The story will be removed from this craft.
        </ConfirmDialog>
      )}
    </div>
  );
}

function StoryBody({ entry, actions }: { entry: Entry; actions?: ReactNode }) {
  return (
    <>
      <RichText text={entry.text} className="text-lg" />
      <p className="mt-4 font-sans text-sm text-stone-600">
        Shared by{" "}
        <Link
          to={`/users/${entry.writer.id}`}
          className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-700"
        >
          {entry.writer.display_name}
        </Link>
      </p>
      {actions}
    </>
  );
}

/** Who may share a story here, and the button or prompt that goes with it. */
function ShareStory({ craft, hasStory }: { craft: CraftDetail; hasStory: boolean | null }) {
  const auth = useAuth();
  const { share } = useStoryMutations(craft.id);
  const [writing, setWriting] = useState(false);

  if (auth.status === "loading" || hasStory !== false) {
    return null;
  }
  if (auth.status === "guest") {
    return <SignInPrompt label="Log in to share your story" />;
  }
  if (auth.user.id === craft.author.id) {
    return null;
  }
  if (!auth.user.is_email_verified) {
    return (
      <p className="text-stone-700">Verify your email address to share your story about it.</p>
    );
  }
  if (!writing) {
    return (
      <button type="button" className="btn-primary" onClick={() => setWriting(true)}>
        <PenLine aria-hidden="true" className="h-4 w-4" />
        Share your story
      </button>
    );
  }
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
      <StoryForm
        submitLabel="Share story"
        pending={share.isPending}
        onCancel={() => setWriting(false)}
        onSubmit={async (text) => {
          await share.mutateAsync(text);
          toast.success("Your story is shared.");
          setWriting(false);
        }}
      />
    </div>
  );
}

/**
 * The craft's stories as an accordion: the author's story first and open, then the viewer's own,
 * then everyone else's, closed, with the writer's name, the date, and a preview in each header.
 */
export function Stories({ craft }: { craft: CraftDetail }) {
  const auth = useAuth();
  const viewer = auth.status === "authenticated" ? auth.user : null;
  const asksForOwn = viewer !== null && viewer.id !== craft.author.id;
  const stories = useStories(craft.id);
  const own = useStoryBy(craft.id, asksForOwn ? viewer.id : null);

  const canManage = (story: CraftStory) =>
    viewer !== null && (viewer.id === story.author.id || viewer.role === "admin");
  const fromStory = (story: CraftStory, badge?: string): Entry => ({
    key: `story-${story.id}`,
    writer: story.author,
    date: story.created_at,
    text: story.text,
    badge,
    story,
  });

  const ownStory = own.data ?? null;
  const others = (stories.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((story) => story.id !== ownStory?.id);
  const entries: Entry[] = [
    ...(craft.story
      ? [
          {
            key: "author",
            writer: craft.author,
            date: craft.created_at,
            text: craft.story,
            badge: "Craft author",
          },
        ]
      : []),
    ...(ownStory ? [fromStory(ownStory, "Your story")] : []),
    ...others.map((story) => fromStory(story)),
  ];
  const total = (craft.story ? 1 : 0) + (stories.data?.pages[0]?.total ?? craft.story_count);
  const hasStory = asksForOwn ? (own.isPending ? null : ownStory !== null) : false;

  return (
    <section aria-labelledby="stories-heading" className="mt-12">
      <div className="woven-band rounded-full" aria-hidden="true" />
      <h2 id="stories-heading" className="mt-6 text-2xl font-semibold">
        Stories{total > 0 && <span className="text-stone-500"> ({total})</span>}
      </h2>
      <p className="mt-1 text-stone-700">
        How people understand this craft: its history, its meaning, and its place in their lives.
      </p>

      {stories.isError && (
        <p role="alert" className="mt-4 text-stone-700">
          Stories could not be loaded.
        </p>
      )}
      {entries.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {entries.map((entry, index) => (
            <StoryItem key={entry.key} entry={entry} defaultOpen={index === 0}>
              <StoryBody
                entry={entry}
                actions={
                  entry.story && canManage(entry.story) ? (
                    <StoryActions craftId={craft.id} story={entry.story} />
                  ) : undefined
                }
              />
            </StoryItem>
          ))}
        </ul>
      ) : (
        !stories.isPending &&
        !stories.isError && <p className="mt-4 text-stone-700">No stories yet.</p>
      )}
      {stories.isPending && (
        <div role="status" className="mt-5 space-y-3">
          <span className="sr-only">Loading stories…</span>
          <div className="skeleton h-16 w-full !rounded-xl" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-3">
        {stories.hasNextPage && (
          <button
            type="button"
            className="btn-secondary"
            disabled={stories.isFetchingNextPage}
            onClick={() => stories.fetchNextPage()}
          >
            {stories.isFetchingNextPage ? "Loading…" : "Show more stories"}
          </button>
        )}
        <div className="w-full sm:w-auto sm:flex-1">
          <ShareStory craft={craft} hasStory={hasStory} />
        </div>
      </div>
    </section>
  );
}
