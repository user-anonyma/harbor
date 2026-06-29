// Geometric spatial navigation: lets the whole app be driven with a d-pad or
// arrow keys (TV / remote style). It moves DOM focus to the nearest focusable
// element in the pressed direction and scrolls it into view. This is a retrofit
// that works without instrumenting every component, because Harbor's cards, nav
// items and controls are already real focusable elements (buttons / links), and
// focus-visible outlines already exist in index.css.
//
// It deliberately yields to: text inputs, the player (which owns arrow keys for
// seek/volume — suspended via setSpatialNavSuspended), any handler that already
// called preventDefault, and elements that opt out with [data-native-arrows].

type Dir = "up" | "down" | "left" | "right";

let suspended = false;
let installed = false;

export function setSpatialNavSuspended(value: boolean): void {
  suspended = value;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isVisible(el: Element): boolean {
  const node = el as HTMLElement;
  if (node.hasAttribute("disabled")) return false;
  if (node.getAttribute("aria-hidden") === "true") return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const cs = getComputedStyle(node);
  if (cs.visibility === "hidden" || cs.display === "none" || cs.pointerEvents === "none") {
    return false;
  }
  // offsetParent is null for display:none and for position:fixed; allow fixed.
  return node.offsetParent !== null || cs.position === "fixed";
}

// Scope candidates to the topmost open modal so focus can't escape a dialog.
function scopeRoot(): ParentNode {
  const dialogs = Array.from(
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
  ).filter((d) => isVisible(d));
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

function candidates(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
}

function move(dir: Dir): void {
  const root = scopeRoot();
  const all = candidates(root);
  if (all.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body || !(root as Element).contains?.(active)) {
    all[0].focus();
    all[0].scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const a = active.getBoundingClientRect();
  const acx = a.left + a.width / 2;
  const acy = a.top + a.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    if (el === active) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - acx;
    const dy = cy - acy;

    let forward: number;
    let cross: number;
    if (dir === "right") {
      if (r.left < a.right - 1) continue;
      forward = dx;
      cross = Math.abs(dy);
    } else if (dir === "left") {
      if (r.right > a.left + 1) continue;
      forward = -dx;
      cross = Math.abs(dy);
    } else if (dir === "down") {
      if (r.top < a.bottom - 1) continue;
      forward = dy;
      cross = Math.abs(dx);
    } else {
      if (r.bottom > a.top + 1) continue;
      forward = -dy;
      cross = Math.abs(dx);
    }
    if (forward <= 0) continue;
    // Prefer the closest in the travel direction, strongly penalising drift on
    // the cross axis so we stay in the same row/column.
    const score = forward + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    best.focus();
    best.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function dirFor(key: string): Dir | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (suspended) return;
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const dir = dirFor(e.key);
  if (!dir) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
    return;
  }
  if (target?.closest("[data-native-arrows]")) return;
  e.preventDefault();
  move(dir);
}

export function initSpatialNav(): () => void {
  if (installed) return () => {};
  installed = true;
  // Bubble phase: component-level handlers run first, so anything that calls
  // preventDefault wins and we skip (checked above).
  window.addEventListener("keydown", onKeyDown, false);
  return () => {
    window.removeEventListener("keydown", onKeyDown, false);
    installed = false;
  };
}
