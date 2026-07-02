// Rotten Tomatoes Popcornmeter (audience) badge: a red striped popcorn bucket
// with kernels for fresh (>=60), muted green and tipped for spilled (<60).
// Mirrors RtBadge so the audience score reads as the official popcorn meter.
export function PopcornBadge({ score, className }: { score: number; className?: string }) {
  const fresh = score >= 60;
  const bucket = fresh ? "#FA320A" : "#6B7A4A";
  const corn = fresh ? "#F7C948" : "#BFC6A6";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={fresh ? undefined : { transform: "rotate(7deg)" }}
      aria-hidden
    >
      <g fill={corn}>
        <circle cx="8" cy="6.2" r="2.1" />
        <circle cx="12" cy="4.6" r="2.4" />
        <circle cx="16" cy="6.2" r="2.1" />
        <circle cx="10" cy="7.6" r="1.7" />
        <circle cx="14" cy="7.6" r="1.7" />
      </g>
      <path d="M6 9 H18 L16.4 21 H7.6 Z" fill={bucket} />
      <g stroke="#ffffff" strokeWidth="1.3" opacity="0.85" strokeLinecap="round">
        <line x1="9.2" y1="9.8" x2="8.7" y2="20.2" />
        <line x1="12" y1="9.8" x2="12" y2="20.2" />
        <line x1="14.8" y1="9.8" x2="15.3" y2="20.2" />
      </g>
    </svg>
  );
}
