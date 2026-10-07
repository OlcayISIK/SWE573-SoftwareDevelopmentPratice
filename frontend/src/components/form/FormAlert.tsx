import type { ReactNode } from "react";

export function FormAlert({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "success";
}) {
  if (!children) {
    return null;
  }
  const classes =
    tone === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : "border-green-300 bg-green-50 text-green-900";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded border p-3 text-sm ${classes}`}
    >
      {children}
    </div>
  );
}
