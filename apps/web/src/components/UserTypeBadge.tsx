import type { UserType } from "@grefa/shared";
import { USER_TYPE_LABELS } from "@grefa/shared";

export function UserTypeBadge({ userType }: { userType: UserType }) {
  const isWorker = userType === "TRABAJADOR_GREFA";
  return (
    <span className={`badge ${isWorker ? "badge-blue" : "badge-green"}`}>
      {isWorker ? "🔵" : "🟢"} {USER_TYPE_LABELS[userType]}
    </span>
  );
}
