# Harbor Android-TV redesign — Sulaiman's request log

Living checklist. Every request he makes (incl. photos/drawings) goes here with status.
Statuses: DONE (committed) · CODE-DONE (written+typechecks, not yet verified/committed) · TODO.

## Active batch (from the reference images, 2026-07-01)

- [DONE] **Context menu = Kodi right panel.** Big right-side panel, same size/placement
  as the Options panel, large TV-sized buttons. Item order exactly: Trakt options, TMDb user
  options, Refresh details, Modify artwork, Play, Play next, Queue item, Information, Mark as
  watched, Add to favourites. Hover-preview card OFF TO THE SIDE (left). (msg 840)
  NOTE: "Trakt options"/"TMDb user options" wired to nearest real actions (watchlist/my-list)
  for now — confirm exact submenu behavior he wants.

- [DONE] **Sidebar hamburger.** Options trigger is now a three-line hamburger. Download/addons/
  settings already fold into Options. (msg 838)

- [DONE] **Sidebar search icon.** Search icon at the top of the sidebar above Home, opens the
  full-screen search page. (msg 843)

- [DONE] **Topbar strip.** Removed the persistent search bar and the watch-together people
  icon. (msg 843)

- [DONE] **Options panel sizing.** Match his Kodi reference exactly: size, top-right
  placement, button size/spacing. (msg 837)

- [DONE] **Artwork picker full-screen.** Keep the tabs on top. Full screen: big selected-art
  preview on the LEFT, grid of options you pick from on the RIGHT. (msg 842)

- [DONE] **Continue Watching episode title.** Episode title under the poster, above the series
  name, prior font. Up-next items need the episode title populated. (msg 844)

- [DONE] **Ratings on banners + detail. (shows when title has RT data)** Home hero AND Discover banners AND detail page show
  IMDb, then RT critics, then RT audience, each with the official RT logo. (msg 847)

- [DONE] **Sidebar default collapsed + remove toggle.** Default sidebarBehavior = collapsed
  always; remove the collapse toggle button entirely (he doesn't want it). (msg 851)

- [DONE] **Density / poster-heavy. (GAP 20->14, default poster 144->128, home gap-12->8)** Whole app tighter, less wasted space, more posters per
  row like Netflix, rows keep scrolling right with the next poster peeking (esp. Continue
  Watching), easy remote scroll. Follow his Kodi build spacing/poster sizing. (msg 851)

- [OPEN QUESTION] He says there was a **search page** request from <1h ago I didn't action.
  Search currently: netflix keyboard, filter, autofill, poster wall movies→shows, opaque,
  TV-sized, respects poster size, no esc/x, opened via sidebar icon. Need him to say what's
  missing. (msg 853)

## Batch 2 (2026-07-01, msgs 863-875)

- [DONE] **RT everywhere.** showRtBadge + showPopcornBadge defaulted ON + one-time
  migration (_rtBadgesOnV1) so existing installs flip on. Data extraction confirmed
  (mdblist "tomatoes"->critics, "popcorn"->audience). Detail + banners + info. (863,867)
- [DONE] **Context-menu preview ratings.** imdb + RT critics + audience on the preview card. (867)
- [DONE] **Hero button.** "Add to Watchlist" -> "More details" (opens detail); Play now plays. (869)
- [DONE] **CW locked to Trakt Up Next.** Only traktCw when present; no stremio/simkl/local mix. (870)
- [DONE] **Row peek.** Sliver of next poster shows on the right when more to scroll. (873)
- [DONE] **Banners pulled up.** home pt-24/28 -> 14/16; sidebar top spacer h-20 -> h-12. (872)
- [IN PROGRESS] **TV sizing / remote-first sweep.** CW cards bumped to 300px landscape + bigger
  episode labels + bigger row headers; awaiting his size confirmation before applying app-wide. Every action a focusable card/button/tile/menu;
  arrows+enter+backspace only, no mouse-only; sized to read from 6ft like an Android TV app;
  match his Kodi sizing esp. CW landscape thumbnails + icons + posters. (875)
- [MOSTLY] **CW landscape thumbnails + episode label** like his Kodi "Your Next Episodes"
  (verify continue-card is landscape 16:9 with the episode label). (875 image)

## Earlier work (done, committed locally, not pushed)

- Search page (Netflix square keyboard, filter, autofill, poster wall movies→shows).
- Options page (Kodi style: Settings/Add-ons/Downloads + Settings/Restart/Quit footer).
- Accent color setting (applies app-wide) + sidebar behavior setting.
- D-pad nav: always-visible focus, focusable tiles, focus-follows-arrows + scroll-into-view,
  Kodi sidebar boundary (Left doesn't jump to sidebar on deep pages; Backspace does).
- Library restructured: Watchlist / History / Favorites.
- Continue Watching sourced from his Trakt Up Next addon (episode thumbnails).
- Context menu on all media types; local artwork override system.
- Window controls removed.

## Standing rules from him
- This runs on a TV (NVIDIA Shield eventually). Everything must be big and readable from
  far away, remote-driven, never tiny.
- Match his reference photos/drawings exactly: size, placement, button sizing.
- Deliver the full set of screenshots/video at once, not piece by piece.
- Keep his Stremio/Trakt logged in + all API keys loaded until he says otherwise.
- Nothing pushed; commit locally.

## Batch 3 (2026-07-01, msgs 863/890 fixes)

- [DONE] **RT everywhere / no TMDb.** showRtBadge + showPopcornBadge default ON + migration.
  Removed the "TMDb" rating fallback on the detail hero (was shown when a title had no imdb).
  Order is imdb -> RT critics -> RT audience with official icons. "Ends at" only on detail/context.
- [DONE] **True Detective / wrong CW items.** Root cause: CW fell back to raw Trakt progress when
  it couldn't read the Up Next addon (raw progress surfaces finished shows). Fix: addon is the sole
  source when installed (never fall back to computed). ALSO safe-fetch now calls api.strem.io
  directly (it sends CORS) so the addon reads reliably on web/dev too. Verified his addon returns
  exactly: Vincenzo, Fallout, The Chestnut Man, Slow Horses, FROM, Sugar, Gangs of London, Goblin Slayer.
- [DONE] **Move everything higher.** home pt-8/10, discover/anime pt-8, sidebar top spacer h-8.
- [DONE] **CW cards a touch smaller.** landscape min 300 -> 270.
- [DONE] **Context-menu preview ratings** (imdb + RT) + **hero "More details" button**.

## Test-env note
- Headless test runs the WEB build; production-only /api-proxy isn't in `vite dev`. Made a dev
  proxy but the repo linter reverts vite.config.js, so instead relied on: (a) direct Stremio API
  (CORS ok), (b) direct addon-API verification. His Tauri build uses native fetch and is unaffected.

## Batch 4 (2026-07-01, msgs 896-902)

- [DONE] **CW show title + order.** Each card shows episode title on top, series name under it
  (addonUpNextOrder now carries the show name -> seriesTitle). Row ordered last-watched-first
  by preserving the addon catalog order (decreasing lastWatched stamp so cwSortKey keeps it).
- [DONE] **"More details" on all banners.** Home hero (done earlier) + feed-hero Save->More details.
  Other banners (cinema/peek/big-card-stack) have no watchlist button.
- [DONE] **imdb-first ratings on all banners.** Shared HeroRatingBadges (imdb -> RT critics ->
  RT audience, official icons) wired into feed-hero, cinema-hero, peek-hero (home hero +
  big-card-stack already had it).
- [IN PROGRESS] **Full TV sizing / remote sweep** (msg 902, repeat of 875). CW cards + labels +
  row headers bumped. Remaining: screen-by-screen size bump + confirm nothing mouse-only.
  Needs his size confirmation on a real TV.

## Push / release
- origin = github.com/harborstremio/harbor (public). main is 53 commits ahead (this session).
- Pushing main triggers the release build all users auto-update to. Asked him: push to main
  (release to all) vs a branch he vets first. AWAITING his call before pushing.

## RELEASED: Harbor 0.9.47 (2026-07-01)
- Cut via the fork orphan-release flow; release.yml dispatched; Windows build succeeded.
- Installer: user-anonyma/harbor releases (tag harbor-windows), Harbor_0.9.47_x64-setup.exe + latest.json.
- Contains all Batch 1-4 work. Awaiting his on-device feedback + the TV-sizing sweep / submenu contents / Shield build.

## Batch 5 (2026-07-02, msg 917) — post-0.9.47 feedback. ONLY these, nothing else.
1. CW: remove play button; poster highlights on hover like other media.
2. Replace "View all" text with harbor-style card/button; only on rows with more items than fit.
3. Search: arrow-key nav across keyboard/filter/autofill/results + Backspace exits (when not in textbox).
4. Sidebar: back-to-sidebar highlights the CURRENT tab regardless of scroll; fix movies/shows right-arrow stuck.
5. Banners (all tabs): don't highlight poster, highlight buttons under it; left/right moves between banners (not dots); side info panel visual-only (not focusable).
6. Arrow focus highlights only the poster, not the whole box (e.g. Top 10 rank cards).
7. Watchlist: only Trakt watchlist items, not watched.
8. Hold Enter 2s on media -> context menu; on CW item -> for that specific episode.
9. Hover animations also on arrow-key focus.
10. imdb + rt critic + rt audience on info page + ALL banners (incl side panel). RECURRING.
11. home/discover/movies/shows/anime same top-banner height, matching discover.

## Batch 5 COMPLETE -> Harbor 0.9.48 (2026-07-02)
All 11 done + committed + typecheck clean:
1 CW play button removed + poster ring; 2 view-all end-card on overflow rows; 3 search arrow-nav
(role=dialog scope, arrow-out-of-input, Backspace exit); 4 sidebar Left->active tab + movies/shows
banner Left/Right slide (fixes stuck); 5 banner poster ring suppressed (harbor-card-focus) + side
panel tabIndex=-1 + Left/Right slide; 6 harbor-card-focus on rank cards (poster-only ring); 7
watchlist trakt-only; 8 hold-Enter 2000ms -> context menu + CW carries exact episode; 9 focus
animations added to rank cards (main cards already had group-focus-within); 10 imdb+RT on banner
side panel; 11 banner heights unified (home 440, movies 440, shows pt-8, anime min-h 440).
Released to fork main + release.yml dispatched.

## Next direction (2026-07-02, msg 937)
He wants Harbor's NAVIGATION FEEL to match his Kodi build (android-TV-first: every focusable
purposeful, smooth glide, remote-driven). Keep Harbor's look, redo the movement.
- Whole folder can't come via Telegram (~20MB bot cap + huge + mostly binaries; can't run Kodi).
- Path given: (1) which Kodi SKIN he uses, (2) a short screen-recording of navigating (shows
  timing/smoothness), (3) optional: zip just the skin folder to Google Drive (readable via Drive MCP).
- AWAITING: skin name + nav clip, then rebuild spatial-nav feel (animation timing, focus glide,
  scroll-into-view, density) to match.

## Arctic Fuse 3 nav-copy (msgs 939-945)
Copy Arctic Fuse 3 (skin.arctic.fuse.3) interaction BACKEND into Harbor. Remote-first, smooth,
every focusable purposeful. Keep Harbor look; keep search VISUAL look (may change its remote-nav).
- [DONE] Settings reset-on-reboot bug fixed (gate persistence until on-disk file loads). (msg 942)
- [TODO] Settings tab fully remote-first accessible. (942)
- [TODO] Study + copy: focus/nav model, animations/smoothness, TV sizing, context menu, tmdbhelper
  + trakt wiring, info/detail, search remote-nav, home/hub. (deep-study workflow running)
- [TODO] How AF3 stores custom artwork + settings (android-built). (942)
- [TODO] All media unified via tmdb(helper); ratings in the banner like kodi; clean. (944)
- [TODO] All animations/visual effects apply on arrow focus too. (942)
- Refs: github.com/jurialmunkey/skin.arctic.fuse.3 ; forum.kodi.tv/showthread.php?tid=383722
- Cloned at /tmp/arctic-fuse-3. He wants heads-down, no pings until done or a question (msg 945).

## Arctic Fuse 3 nav pass -> 0.9.49 (2026-07-02)
Studied AF3 via multi-agent workflow (spec in docs/arctic-fuse-3-nav-spec.json). Most of Harbor's
spatial-nav was already correct; implemented the gaps:
- [DONE] Center-focus in horizontal rows (inline:center for L/R in a horizontal scroller) - Arctic focusposition
- [DONE] Focus bounce 150ms (scale .965->1) + Arctic easing tokens (quad/sine-inout/back-out); reduced-motion guarded
- [DONE] Edge bump (±8px, 240ms) on genuine hard stops instead of silent nothing
- [DONE] Opt-in circular wrap for [data-nav-wrap] (carousels/spotlight); rows stay hard-stop
- [DONE] Per-page default focus ([data-harbor-default]) + focus MEMORY on return (data-focus-id on
  pick-card + continue-card; FocusMemory component keyed on route; remote-only)
- [DONE] Settings reset-on-reboot fix (separate)
- [HELD/QUESTION] Task 8 detail header dim/shrink on entering widgets (changes the look most) - ask him
OPEN QUESTIONS for him: center vs soft-lead-in focus; wrap hero-only?; bounce intensity; detail zoom-out yes/no.

## 0.9.50 (2026-07-02) — his taste answers applied + full QA
Answers to the four open questions:
1. Detail zoom-out: YES. Scroll-driven hero recede (scale 1->0.94, opacity 1->0.3) as you go down; header returns on scroll up. detail.tsx heroRef + rAF scroll effect; play button = data-harbor-default.
2. Focus centering: SOFT lead-in (card ~38% from leading edge) not hard center. spatial-nav softLeadInScroll + focus({preventScroll}).
3. Wrap: kept carousel-only (looks cleanest).
4. Bounce: more pronounced (scale 0.9->1.035->1 overshoot, ease-back-out 240ms) + edge bump 8->14px.
QA (headless Playwright, /tmp/fxtest/qa_flow.mjs + probe_zoom.mjs): home/search/browse/detail/context-menu/back/CW all pass.
Console errors are dev-env only (CORS, fonts CDN, /api-proxy) — absent in native Tauri build. Two intermittent
React dev warnings (dup key, transient nested button) pre-existing, not nav-related, couldn't reproduce on browse/search.
Shipped video + zoom-out/context-menu/search screenshots.

## 0.9.51 (2026-07-02) — rating fallback
His ask: "It can be replaced if it's not available for that specific movie or show."
- Detail hero (hero-ratings.tsx) + banner strip (hero-rating-badges.tsx): priority-fill to ~3 chips.
  Order: IMDb/(MAL) -> RT critics -> RT audience -> Metacritic -> Trakt -> Letterboxd -> MDBList score.
  Show enabled+available first, then backfill from available-but-disabled sources up to 3, then re-sort by priority.
- Verified (CORS-off headless so mdblist loads): Vincenzo (no IMDb) -> RT 89% / audience 83% / Letterboxd 4.1;
  Enola Holmes 3 -> RT 67% / Metacritic 59 / Trakt 71%. Titles with zero ratings anywhere show none (correct).
