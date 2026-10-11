import { cn } from "@/lib/utils";

/**
 * The Rangmanch mark: six stage panels rising from a curved stage.
 * The panel colours are the brand's rainbow — they are used here (and only
 * here) at full saturation. Elsewhere in Rangverse gold is the single accent.
 */
export function RangmanchMark({
  className,
  title = "Rangmanch",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 48 44" role="img" aria-label={title} className={cn("size-8", className)}>
      <g>
        <rect
          x="4"
          y="13"
          width="6"
          height="25"
          rx="1"
          fill="#E0564B"
          transform="rotate(-9 7 25)"
        />
        <rect
          x="11"
          y="9"
          width="6"
          height="29"
          rx="1"
          fill="#E89A3C"
          transform="rotate(-5 14 23)"
        />
        <rect
          x="18"
          y="7"
          width="6"
          height="31"
          rx="1"
          fill="#E8C64A"
          transform="rotate(-2 21 22)"
        />
        <rect x="25" y="7" width="6" height="31" rx="1" fill="#5FBF6A" transform="rotate(2 28 22)" />
        <rect
          x="32"
          y="9"
          width="6"
          height="29"
          rx="1"
          fill="#4FA3DC"
          transform="rotate(5 35 23)"
        />
        <rect
          x="38"
          y="13"
          width="6"
          height="25"
          rx="1"
          fill="#C45BB0"
          transform="rotate(9 41 25)"
        />
      </g>

      {/* The stage arc sits in front of the panels so they appear to stand on it. */}
      <path d="M0 38.5c6-6.4 14.3-9.6 24-9.6s18 3.2 24 9.6V44H0z" fill="currentColor" />
    </svg>
  );
}

/**
 * Full lockup used in the sidebar, the sign-in screen and document chrome.
 */
export function RangverseLogo({
  className,
  showTagline = true,
  compact = false,
}: {
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <RangmanchMark
        className={cn("text-background shrink-0", compact ? "size-7" : "size-9")}
      />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="font-heading text-foreground text-[0.95rem] font-bold tracking-[0.14em]">
            RANGVERSE
          </span>
          {showTagline && (
            <span className="text-muted-foreground mt-1 truncate text-[0.6rem] tracking-[0.18em] uppercase">
              The Workspace Behind the Stage
            </span>
          )}
        </span>
      )}
    </span>
  );
}
