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
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-lagoon/30 bg-lagoon-wash text-lagoon";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`animate-fade-up rounded-sm border p-3 text-sm ${classes}`}
    >
      {children}
    </div>
  );
}
