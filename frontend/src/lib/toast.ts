import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "error" | "success" | "info";
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, "id">;

const DISMISS_AFTER_MS = 8000;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export const toast = {
  show(input: ToastInput) {
    if (toasts.some((existing) => existing.message === input.message)) {
      return;
    }
    const id = nextId++;
    toasts = [...toasts, { ...input, id }];
    emit();
    setTimeout(() => toast.dismiss(id), DISMISS_AFTER_MS);
  },
  error(message: string, action?: Toast["action"]) {
    toast.show({ message, tone: "error", action });
  },
  success(message: string) {
    toast.show({ message, tone: "success" });
  },
  dismiss(id: number) {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  },
  clear() {
    toasts = [];
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => toasts,
};

export function useToasts() {
  return useSyncExternalStore(toast.subscribe, toast.getSnapshot);
}
