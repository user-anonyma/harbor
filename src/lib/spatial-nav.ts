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
let kbdNav = false;

export function setSpatialNavSuspended(value: boolean): void {
  suspended = value;
}

// True when the user is actively driving with arrow keys / a remote (reset on
// any pointer use). Lets the sidebar auto-open a page on focus only for remote
// users, never stealing navigation from the mouse.
export function isKeyboardNavigating(): boolean {
  return kbdNav;
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

function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement;
  while (n) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
    n = n.parentElement;
  }
  return null;
}

// True when the element sits inside a horizontally-scrolling strip (a row), so
// left/right focus should glide the strip and keep the focused card centered
// (Arctic Fuse focusposition), rather than parking it at the viewport edge.
function horizontalScroller(el: HTMLElement): HTMLElement | null {
  let n = el.parentElement;
  while (n) {
    const cs = getComputedStyle(n);
    if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 4) return n;
    n = n.parentElement;
  }
  return null;
}

// Soft lead-in scroll (Arctic Fuse focusposition): instead of hard-centering the
// focused card, park it slightly left of center so you can see more of what's
// coming next in the row. Left/right symmetric by direction of travel.
function softLeadInScroll(scroller: HTMLElement, el: HTMLElement, dir: Dir): void {
  const sr = scroller.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  // Lead fraction: card sits ~38% from the leading edge, so ~62% of the strip
  // shows the direction you're heading. Flip for left travel.
  const lead = 0.38;
  const frac = dir === "left" ? 1 - lead : lead;
  const targetLeft = sr.width * frac - er.width / 2;
  const delta = er.left - sr.left - targetLeft;
  scroller.scrollBy({ left: delta, behavior: "smooth" });
}

// A one-shot edge "bump" so a hard stop feels intentional instead of silent.
function bump(el: HTMLElement, axis: "x" | "y", positive: boolean): void {
  const cls = axis === "x" ? "harbor-bump-x" : "harbor-bump-y";
  el.style.setProperty("--harbor-bump", `${positive ? 14 : -14}px`);
  el.classList.remove(cls);
  // reflow so re-adding the class restarts the animation
  void el.offsetWidth;
  el.classList.add(cls);
  const done = () => {
    el.classList.remove(cls);
    el.style.removeProperty("--harbor-bump");
    el.removeEventListener("animationend", done);
  };
  el.addEventListener("animationend", done);
}

// Find the nearest focusable in `dir` from `active`. When requireOverlap is set,
// only consider candidates that share the perpendicular band (same row for
// left/right, same column for up/down) — this keeps row travel straight and
// makes the end of a row a hard stop.
function pick(
  active: HTMLElement,
  all: HTMLElement[],
  dir: Dir,
  requireOverlap: boolean,
): HTMLElement | null {
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
    let forward: number;
    let cross: number;
    if (dir === "right" || dir === "left") {
      if (requireOverlap && Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) <= 0) continue;
      forward = dir === "right" ? cx - acx : acx - cx;
      if (dir === "right" ? r.left < a.right - 1 : r.right > a.left + 1) continue;
      cross = Math.abs(cy - acy);
    } else {
      if (requireOverlap && Math.min(a.right, r.right) - Math.max(a.left, r.left) <= 0) continue;
      forward = dir === "down" ? cy - acy : acy - cy;
      if (dir === "down" ? r.top < a.bottom - 1 : r.bottom > a.top + 1) continue;
      cross = Math.abs(cx - acx);
    }
    if (forward <= 0) continue;
    const score = forward + cross * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
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

  // Kodi-style boundary: on a deep page (detail / player), Left does not spill
  // into the sidebar — you exit with Back / Backspace instead. On browse pages
  // the sidebar stays reachable by pressing Left at the start of a row.
  let pool = all;
  if (
    dir === "left" &&
    active.closest('[data-harbor-page="deep"]') &&
    !active.closest("[data-harbor-nav]")
  ) {
    pool = all.filter((el) => !el.closest("[data-harbor-nav]"));
  }

  // Left/right: stay in the row; the end of a row is a hard stop (no wrap).
  // Up/down: prefer the same column, but fall back to any next row so you can
  // always traverse the whole page; if nothing focusable remains, scroll.
  let best = pick(active, pool, dir, true);
  if (!best && (dir === "up" || dir === "down")) {
    best = pick(active, all, dir, false);
    if (!best) {
      const sc = scrollableAncestor(active) ?? document.scrollingElement ?? document.documentElement;
      if (sc) sc.scrollBy({ top: (dir === "down" ? 1 : -1) * sc.clientHeight * 0.85, behavior: "smooth" });
      else bump(active, "y", dir === "down");
      return;
    }
  }

  // Opt-in circular wrap for carousels/spotlight (Arctic wraplist): when a
  // left/right move hits the end inside a [data-nav-wrap] container, jump to the
  // opposite end of that same container instead of stopping.
  if (!best && (dir === "left" || dir === "right")) {
    const wrap = active.closest<HTMLElement>("[data-nav-wrap]");
    if (wrap) {
      const inWrap = candidates(wrap);
      if (inWrap.length > 1) best = dir === "right" ? inWrap[0] : inWrap[inWrap.length - 1];
    }
  }

  if (best) {
    // Entering the sidebar from the content always lands on the CURRENT tab
    // (the one whose page you're on), regardless of where in the page you were.
    if (
      dir === "left" &&
      best.closest("[data-harbor-nav]") &&
      !active.closest("[data-harbor-nav]")
    ) {
      const activeTab = document.querySelector<HTMLElement>("[data-harbor-nav][data-active]");
      if (activeTab) best = activeTab;
    }
    // preventScroll so the browser's default focus-scroll doesn't fight our own
    // smooth lead-in below.
    best.focus({ preventScroll: true });
    // Soft lead-in when travelling along a horizontal row (Arctic focusposition):
    // the strip glides under a fixed cursor and the focused card sits slightly
    // toward the leading edge so you see what's coming. Keep edge-nearest for
    // vertical moves and non-row focusables.
    const scroller =
      dir === "left" || dir === "right"
        ? best.closest("[data-harbor-nav]")
          ? null
          : horizontalScroller(best)
        : null;
    if (scroller) {
      softLeadInScroll(scroller, best, dir);
    } else {
      best.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  } else if (dir === "left" || dir === "right") {
    // Genuine hard stop at the end of a row: bump instead of silent nothing.
    bump(active, "x", dir === "right");
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
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  const typing =
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!target?.isContentEditable;

  // Backspace jumps focus back to the sidebar (unless already there or typing).
  if (e.key === "Backspace" && !typing && !target?.closest("[data-harbor-nav]")) {
    const sb =
      (document.querySelector("[data-harbor-nav][data-active]") as HTMLElement | null) ??
      (document.querySelector("[data-harbor-nav]") as HTMLElement | null);
    if (sb) {
      kbdNav = true;
      e.preventDefault();
      sb.focus();
      sb.scrollIntoView({ block: "nearest" });
      return;
    }
  }

  const dir = dirFor(e.key);
  if (!dir) return;
  if (typing) return;
  if (target?.closest("[data-native-arrows]")) return;
  kbdNav = true;
  e.preventDefault();
  move(dir);
}

export function initSpatialNav(): () => void {
  if (installed) return () => {};
  installed = true;
  // Bubble phase: component-level handlers run first, so anything that calls
  // preventDefault wins and we skip (checked above).
  window.addEventListener("keydown", onKeyDown, false);
  const onPointer = () => {
    kbdNav = false;
  };
  window.addEventListener("pointerdown", onPointer, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, false);
    window.removeEventListener("pointerdown", onPointer, true);
    installed = false;
  };
}

// ---- Per-page default focus + focus memory (Arctic <defaultcontrol> + focus
// restore). Session-scoped: leaving a page remembers where you were; returning
// puts focus back there, else on the page's deliberate default. Only acts while
// the user is driving with the remote/keyboard, never for mouse users. ----
const focusMemory = new Map<string, string>();

export function rememberFocus(routeKey: string): void {
  const a = document.activeElement as HTMLElement | null;
  const id = a?.getAttribute?.("data-focus-id");
  if (id) focusMemory.set(routeKey, id);
  else focusMemory.delete(routeKey);
}

// Restore the last-focused item for a route, or fall back to the page's default
// control ([data-harbor-default]) / first focusable. No-op for mouse users.
export function restoreOrDefaultFocus(routeKey: string): void {
  if (!kbdNav) return;
  const saved = focusMemory.get(routeKey);
  if (saved) {
    const el = document.querySelector<HTMLElement>(`[data-focus-id="${CSS.escape(saved)}"]`);
    if (el && isVisible(el)) {
      el.focus();
      el.scrollIntoView({ block: "nearest", inline: "center" });
      return;
    }
  }
  const def =
    document.querySelector<HTMLElement>("[data-harbor-default]") ?? candidates(document)[0] ?? null;
  if (def && isVisible(def)) {
    def.focus();
    def.scrollIntoView({ block: "nearest" });
  }
}
