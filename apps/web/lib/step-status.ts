import type { StepStatus } from "@repo/contracts";

export function statusLabel(status: StepStatus): string {
  switch (status) {
    case "PENDING":
      return "Chờ chạy";
    case "QUEUED":
      return "Trong hàng đợi";
    case "RUNNING":
      return "Đang chạy…";
    case "WAITING_FOR_HUMAN":
      return "Chờ bạn duyệt";
    case "COMPLETED":
      return "Hoàn tất";
    case "FAILED":
      return "Thất bại";
    case "STALE":
      return "Đã cũ (cần chạy lại)";
  }
}

export function statusBadgeClass(status: StepStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "RUNNING":
    case "QUEUED":
      return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300";
    case "WAITING_FOR_HUMAN":
      return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse";
    case "FAILED":
      return "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300";
    case "STALE":
      return "border-zinc-300 bg-zinc-100 text-zinc-500 line-through dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

/** Chấm màu cho cây thực thi / timeline. */
export function statusDotClass(status: StepStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500";
    case "RUNNING":
    case "QUEUED":
      return "bg-sky-500 animate-pulse";
    case "WAITING_FOR_HUMAN":
      return "bg-amber-500";
    case "FAILED":
      return "bg-red-500";
    case "STALE":
      return "bg-zinc-400";
    default:
      return "bg-muted-foreground/40";
  }
}
