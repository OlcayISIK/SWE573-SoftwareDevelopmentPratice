import { toast, useToasts } from "@/lib/toast";

const toneClass = {
  error: "border-red-300 bg-red-50 text-red-900",
  success: "border-green-300 bg-green-50 text-green-900",
  info: "border-stone-300 bg-white text-stone-900",
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
          className={`pointer-events-auto flex items-start gap-3 rounded border px-4 py-3 shadow ${toneClass[item.tone]}`}
        >
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
            className="text-sm"
            onClick={() => toast.dismiss(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </section>
  );
}
