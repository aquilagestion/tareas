import { cn } from "@/lib/utils";
import type { UserType } from "@grefa/shared";
import { USER_TYPE_LABELS } from "@grefa/shared";

export function UserTypeBadge({ userType }: { userType: UserType }) {
  const isWorker = userType === "TRABAJADOR_GREFA";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold text-white",
        isWorker ? "bg-[var(--grefa-blue)]" : "bg-[var(--grefa-green)]"
      )}
    >
      {isWorker ? "🔵" : "🟢"} {USER_TYPE_LABELS[userType]}
    </span>
  );
}
