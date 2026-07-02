import { Check } from "lucide-react";

// The single watched indicator used across all media: a dark-green ring with a
// black inner circle and a dark-green check. Position via `className`.
export function WatchedCheck({ className = "" }: { className?: string }) {
  return (
    <span
      className={`pointer-events-none flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black ring-2 ring-[#1a8f42] shadow-[0_0_8px_rgba(26,143,66,0.55)] ${className}`}
      aria-label="Watched"
      title="Watched"
    >
      <Check size={12} strokeWidth={3.5} className="text-[#1a8f42]" />
    </span>
  );
}
