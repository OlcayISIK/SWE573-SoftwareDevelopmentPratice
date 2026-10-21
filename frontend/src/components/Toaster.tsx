import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

import { toast, useToasts } from "@/lib/toast";

const toneClass = {
  error: "border-l-red-700 text-red-900",
  success: "border-l-lagoon text-deep-sea",
  info: "border-l-brand-700 text-deep-sea",
};

const toneIcon = {
  error: <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />,
  success: <CircleCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-lagoon" />,
  info: <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />,
};

export function Toaster() {
  const toasts = useToasts();

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[1500] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={`animate-slide-up pointer-events-auto flex items-start gap-3 rounded-xl border-l-4 bg-white px-4 py-3 shadow-lg ring-1 ring-stone-200 ${toneClass[item.tone]}`}
        >
          {toneIcon[item.tone]}
          <p className="flex-1 text-sm">{item.message}</p>
          {item.action && (
            <button
              type="button"
              className="text-sm font-semibold underline"
              onClick={() => {
                toast.dismiss(item.id);
                item.action?.onClick();
              }}
            >
              {item.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-full p-0.5 text-stone-500 hover:bg-stone-100 hover:text-deep-sea"
            onClick={() => toast.dismiss(item.id)}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </section>
  );
}
