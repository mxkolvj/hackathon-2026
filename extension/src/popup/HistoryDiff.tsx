import type { WaybackResult } from "@fakescope/shared";
import { AlertTriangle } from "lucide-react";

interface Props {
  wayback: WaybackResult | null;
}

export function HistoryDiff({ wayback }: Props) {
  if (!wayback || wayback.snapshots_count === 0) {
    return (
      <div className="p-2 rounded bg-gray-50 text-xs text-gray-500">
        Nie znaleziono historii tego URL w Wayback Machine.
      </div>
    );
  }
  const warn = (wayback.change_percent ?? 0) > 30;
  return (
    <div
      className={`p-2 rounded text-xs ${warn ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-700"}`}
    >
      <div className="font-semibold uppercase tracking-wide text-[10px] mb-1">
        Historia Wayback Machine
      </div>
      <div>
        <strong>{wayback.snapshots_count}</strong> zrzutów od{" "}
        <strong>
          {wayback.first_snapshot
            ? new Date(wayback.first_snapshot).toLocaleDateString("pl-PL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "?"}
        </strong>
      </div>
      {wayback.change_percent !== null && (
        <div className="space-y-1">
          Odchył treści: <strong>{wayback.change_percent}%</strong>{" "}
          {warn && (
            <div className="flex items-center gap-1 font-semibold">
              <AlertTriangle size={14} className="text-amber-600" />
              Znaczące zmiany
            </div>
          )}
        </div>
      )}
    </div>
  );
}
