# DESIGN AUDIT: Workspace Studio v2

## Overall Assessment

The application has strong foundational design decisions -- dark glass morphism, Lucide icons throughout, well-structured quest-to-forge-to-world pipeline, and thoughtful reveal animations. However, it suffers from three systemic issues: `pulse-glow` on CTA buttons creates anxiety instead of confidence, inconsistent surface/border patterns across screens, and missing accessibility infrastructure (no skip-link, no ARIA live regions for async operations, and focus management gaps in modals and bottom sheet). The design system in `layout.css` is well-organized but under-utilized -- components redefine glass variants inline rather than using the tokens.

---

## PHASE 1 -- Critical

Issues that actively hurt usability, hierarchy, responsiveness, or consistency.

### 1.1 Global: pulse-glow on CTA Buttons Creates Anxiety

**What's wrong**: The `pulse-glow` animation (a 2s infinite box-shadow oscillation) is applied to primary CTAs on 4 screens: "Start Quest" (`apps/quest/src/routes/+page.svelte:158`), "Enter the Forge" inside the reveal modal (`apps/quest/src/routes/quest/+page.svelte:348`), "Complete Space" in the forge sidebar (`apps/quest/src/routes/forge/[spaceId]/+page.svelte:558`), and "Explore Your World" in the world modal (`apps/quest/src/routes/world/+page.svelte:207`). Pulsing box-shadow on a call-to-action makes the button feel urgent/alarming rather than inviting. Infinite animations on buttons are an anti-pattern for user trust -- they signal "loading" or "warning," not "click me."
**What it should be**: Remove `pulse-glow` from all CTA buttons. Replace with a static, generous `box-shadow` that elevates the button and a subtle scale/shadow increase on hover. The button should feel solid and confident, not anxious.
**Why this matters**: A primary CTA must communicate stability and confidence. Pulsing animations create cognitive pressure that undermines the exploratory, creative tone of the app.

### 1.2 Quest: Option Cards Have No Loading State for Images

**What's wrong**: In `apps/quest/src/routes/quest/+page.svelte:179-183`, the option images (`engine.step?.optionA.image`) are loaded from `/assets/` with no loading/skeleton state. If images are large JPEGs (the filenames like `WS 01.jpg`, `PROJECT ROOM 01.jpg` suggest full-resolution photos), there is a flash of empty space before the image loads, breaking the quiz's polished feel.
**What it should be**: Add a `bg-slate-800` background to the image container and an `opacity-0 transition-opacity duration-300` on the `<img>` with an `onload` handler to fade it to `opacity-100`. The 4:3 aspect ratio container (`aspect-[4/3]`) already provides the skeleton shape.
**Why this matters**: This is a seminar app -- users are on shared WiFi. Slow-loading images with no placeholder make the quiz feel broken.

### 1.3 Forge: Mobile Bottom Sheet Renders CommandBar Twice

**What's wrong**: In `apps/quest/src/routes/forge/[spaceId]/+page.svelte:643-733`, when the BottomSheet is in `peek` mode it renders `CommandBar` (line 644-649), and when expanded to `full` mode it renders CommandBar again inside `{#snippet fullContent()}` (line 653-658). This means two instances of the component exist simultaneously, each with their own state. The user may type a prompt in the peek CommandBar, then swipe to full, and the text disappears because they are looking at a different instance.
**What it should be**: Use a single CommandBar instance. Pass the CommandBar as children to the BottomSheet and use CSS to control its layout rather than rendering two separate instances. Alternatively, lift the prompt state up so both instances share it.
**Why this matters**: Users lose their typed prompt when switching sheet states. This is a data-loss bug disguised as a UI issue.

### 1.4 Forge: Error Toast Competes with Bottom Sheet z-index

**What's wrong**: The error toast in `apps/quest/src/routes/forge/[spaceId]/+page.svelte:826-840` uses `z-[60]` and `fixed bottom-6`. The BottomSheet in `packages/shared/src/components/BottomSheet.svelte:187` uses `z-50`. On mobile, the error toast renders at `bottom-6` which is likely BEHIND the bottom sheet (peek height is 220px). The toast also uses its own animation system (`animate-in`, `animate-shrink` from layout.css) rather than the shared `Toast.svelte` component.
**What it should be**: Remove the custom error toast from forge page entirely. Use the shared `toast()` function from `@zyeta/shared/utils/toast.svelte` which renders at `top-4 right-4 z-[200]` via the `Toast.svelte` component (already mounted in `+layout.svelte`). The forge page already imports `toast` nowhere -- this is a parallel toast system that should not exist.
**Why this matters**: Two competing notification systems create inconsistency. The bottom-positioned toast is invisible on mobile behind the bottom sheet.

### 1.5 Showcase: Missing color-scheme meta tag

**What's wrong**: In `apps/showcase/src/app.html`, there is no `<meta name="color-scheme" content="dark" />` unlike the quest app (`apps/quest/src/app.html:6`). This means form controls, scrollbars, and other UA-styled elements may render in light mode on the showcase app despite the dark background.
**What it should be**: Add `<meta name="color-scheme" content="dark" />` to `apps/showcase/src/app.html:5` (after the viewport meta).
**Why this matters**: Native form controls (range sliders in EditorBar, text inputs in CommandBar) will render with white backgrounds on some browsers, breaking the dark aesthetic.

### 1.6 Global: No Skip-to-Content Link

**What's wrong**: Neither `apps/quest/src/app.html` nor `apps/showcase/src/app.html` includes a skip-to-content link. The quest app has a fixed floating header (`apps/quest/src/routes/+page.svelte:35-45`) that keyboard users must tab through on every page.
**What it should be**: Add a visually-hidden skip link as the first child of `<body>` in both `app.html` files: `<a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to content</a>`. Add `id="main-content"` to the `<main>` element in each layout.
**Why this matters**: WCAG 2.1 SC 2.4.1 (Bypass Blocks) -- keyboard users cannot efficiently navigate the app.

### 1.7 Forge: Canvas Touch Targets Below 44px on Desktop

**What's wrong**: In `apps/quest/src/routes/forge/[spaceId]/+page.svelte:383-446`, the floating tool selector buttons are `h-11 w-11` (44px) on mobile but `md:h-8 md:w-8` (32px) on desktop. While 32px is acceptable for desktop mouse targets, the version history thumbnails (`apps/quest/src/routes/forge/[spaceId]/+page.svelte:589-602`) are `h-14 w-14` (56px) which is good. However, the delete button on the VersionTree (`packages/editor-engine/src/components/VersionTree.svelte:89-99`) is `h-6 w-6` (24px) -- well below the 44px minimum for any touch device.
**What it should be**: Increase VersionTree delete button to `h-8 w-8` (32px) minimum with a larger hit area via padding. The actual icon can remain small (`h-3 w-3`) but the tappable area must be at least 32px on desktop and 44px on touch devices.
**Why this matters**: This is a seminar app likely used on tablets. 24px targets cause misclicks and frustration, especially for destructive actions like delete.

### 1.8 CinematicModal: Focus Trap Incomplete

**What's wrong**: In `packages/shared/src/components/CinematicModal.svelte:42-60`, the Tab key trap logic queries for focusable elements and wraps focus. However, the modal container itself has `tabindex="-1"` (line 69) which means it receives initial focus but is not part of the tab order. The `$effect` that focuses the first focusable element (line 31-38) runs on mount, but if the modal content uses staggered animations (as in the quest reveal), the CTA button may not be visible/interactable yet when focus is set. Also, there is no backdrop click handler -- clicking the backdrop does nothing.
**What it should be**: Add `onclick={onclose}` to the backdrop div (line 75). Delay the initial focus by matching the CTA animation delay (1800ms in the quest reveal case, or use a more general approach: focus the first visible, non-animated element). The modal is well-structured overall; these are edge-case fixes.
**Why this matters**: Users who click outside the modal expect it to close. Keyboard users who land on the modal before content is visible will hear nothing from screen readers.

---

## PHASE 2 -- Refinement

Spacing, typography, color, alignment, and component consistency adjustments.

### 2.1 Global: Inconsistent Glass Morphism Variants

**What's wrong**: The design system defines 5 glass variants in `apps/quest/src/routes/layout.css` (lines 52-87): `.glass`, `.glass-panel`, `.glass-surface`, `.glass-hover`, `.glass-input`. However, components bypass these and use inline Tailwind equivalents:

- Forge sidebar (`apps/quest/src/routes/forge/[spaceId]/+page.svelte:526`): `bg-[#0f111a]/95 backdrop-blur-xl` instead of `.glass-panel`
- BottomSheet (`packages/shared/src/components/BottomSheet.svelte:188`): `bg-[#0f111a]/98 backdrop-blur-xl` instead of `.glass-panel`
- World page controls panel uses `.glass` correctly
- Forge completion modal backdrop uses `bg-black/90 backdrop-blur-xl` -- not a glass variant
  **What it should be**: Standardize on the defined glass tokens. Add a `--glass-panel-bg` CSS custom property set to `rgba(15, 17, 26, 0.95)` and use it in `.glass-panel`. Update forge sidebar and BottomSheet to use `.glass-panel` class. Remove hardcoded `bg-[#0f111a]/95` and `bg-[#0f111a]/98` throughout.
  **Why this matters**: Maintaining two systems (CSS tokens + inline overrides) guarantees drift over time. The two slightly different opacities (95% vs 98%) are imperceptible but create code ambiguity.

### 2.2 Typography: No Type Scale Beyond Two Classes

**What's wrong**: `layout.css` defines only two typography classes: `.text-hero` (2.25rem/800) and `.text-subheading` (0.75rem/600 uppercase). But the actual pages use at least 7 distinct heading patterns:

- Landing h1: `text-4xl font-extrabold tracking-tight sm:text-6xl` (page.svelte:148)
- Quest prompt h1: `text-2xl font-bold sm:text-3xl` (quest/+page.svelte:162)
- Forge h1: `text-lg font-semibold md:text-xl` (forge:216)
- World modal h1: `text-4xl font-extrabold sm:text-5xl` (world:194)
- Complete state h2: `text-2xl font-bold` (forge:281)
- Quest complete h1: `text-3xl font-bold sm:text-4xl` (quest:233)
- Section label: `text-xs font-medium text-slate-400` (forge:585)

None of these use the `.text-hero` or `.text-subheading` classes.
**What it should be**: Define a complete type scale in layout.css using CSS custom properties or utility classes that the pages actually use. At minimum: `.text-display` (4xl/extrabold), `.text-title` (2xl-3xl/bold), `.text-heading` (lg-xl/semibold), `.text-body`, `.text-caption` (xs/medium), `.text-label` (xs/semibold/uppercase/tracking-wide). Then migrate existing inline styles to use them.
**Why this matters**: Without a shared type scale, every new screen invents its own heading sizes. The current `.text-hero` class is dead code.

### 2.3 Dashboard: Space Cards Missing Hover Elevation

**What's wrong**: In `apps/quest/src/routes/+page.svelte:73-100`, the returning user's space cards have `hover:border-purple-500/30` but no shadow or transform elevation on hover. The showcase cards (`apps/showcase/src/routes/+page.svelte:21-29`) have `active:scale-[0.98]` which provides nice press feedback, but the quest dashboard cards have no active state.
**What it should be**: Add `hover:shadow-lg hover:shadow-purple-500/10` and `active:scale-[0.98]` to the space card `<a>` elements. This creates a consistent interactive card pattern across both apps.
**Why this matters**: Cards that change border color on hover but don't elevate feel flat and unresponsive. The user needs spatial feedback that the card is lifting toward them.

### 2.4 Forge: Sidebar and Mobile Sheet Duplicate UI Logic

**What's wrong**: The forge page (`apps/quest/src/routes/forge/[spaceId]/+page.svelte`) has near-identical UI blocks for desktop sidebar (lines 524-637) and mobile bottom sheet full content (lines 651-733). The "Complete Space" button alone has 4 conditional branches duplicated verbatim in both locations. The compare button, version history, and edit limit warning are all copy-pasted between desktop and mobile views.
**What it should be**: Extract a `<ForgeControls>` component that contains the compare button, complete space button (with all conditional states), version history strip, version tree, and edit limit warning. Render it once inside the sidebar (desktop) or bottom sheet (mobile). This eliminates the duplication without changing any visual output.
**Why this matters**: The current duplication means every UI change must be made in two places. The mobile "Complete Space" button (line 685-707) already has a slightly different loading message ("Completing space..." vs "Building your island...") -- evidence of copy-paste drift.

### 2.5 World/Metaverse: Duplicated Controls Panel

**What's wrong**: The controls panel (Overview/Walk/Keyboard buttons) is duplicated nearly identically between `apps/quest/src/routes/world/+page.svelte:300-382` and `apps/quest/src/routes/metaverse/+page.svelte:113-176`. The keyboard shortcuts help panel is also duplicated, including the `.kbd` CSS class defined in `<style>` blocks in both files.
**What it should be**: Extract a `<WorldControls>` component to `packages/world-engine/` that accepts `onreset`, `ontoggleavatar`, `avatarActive`, and `showArrangeButton` props. This component would contain the bottom control bar, keyboard shortcuts help panel, and the `.kbd` style.
**Why this matters**: The metaverse page already has slightly different behavior (no Arrange button) but uses the same visual pattern. A shared component ensures visual consistency and eliminates the duplicated `.kbd` style.

### 2.6 Forge: "Complete Space" Uses pulse-glow on a Functional Button

**What's wrong**: In `apps/quest/src/routes/forge/[spaceId]/+page.svelte:558`, the "Complete Space" button has `pulse-glow` applied. This is a particularly bad instance because it is inside the sidebar next to functional controls (compare, version history). The pulsing makes it look like it is in a loading state rather than a normal interactive button.
**What it should be**: Remove `pulse-glow`. Use `shadow-lg shadow-purple-500/20` for a static glow that communicates importance without animation. Add `hover:shadow-purple-500/30 hover:bg-purple-500` for interactive feedback.
**Why this matters**: In a professional tool context (the forge editor), pulsing buttons create anxiety. The user may think something is processing when nothing is.

### 2.7 Color: Status Badge Colors Lack Semantic Consistency

**What's wrong**: Status badges use different color schemes depending on context:

- Dashboard space cards (`apps/quest/src/routes/+page.svelte:83-96`): complete=emerald, forging=amber, ready=purple
- Forge completion modal progress dots (`forge/[spaceId]/+page.svelte:780-783`): complete=emerald, incomplete=white/20
- Forge header edit count badge (forge:219): purple always
- World page island count (world:292): slate text, no color coding

The "forging" status uses amber on the dashboard but the forge page itself uses purple for everything.
**What it should be**: Establish a consistent semantic color map: `pending` = purple-500, `forging/active` = amber-500, `complete` = emerald-500, `error` = rose-500. Apply this map to all status indicators across all pages.
**Why this matters**: When amber means "in progress" on one screen and purple means "in progress" on another, the color system loses its meaning.

### 2.8 Global: Button Sizing Inconsistency

**What's wrong**: Primary CTA buttons use at least 4 different size patterns:

- Landing "Start Quest": `px-10 py-4 text-xl` (page.svelte:158)
- Quest "Enter the Forge": `px-8 py-3 text-lg` (quest:277, quest:348)
- Forge "Complete Space": `px-4 py-3 font-medium` (forge:558) -- no text size specified
- World "Explore Your World": `px-8 py-3 text-lg` (world:207)
- Dashboard "Continue Forging": `px-8 py-3 text-lg` (page.svelte:107)

Secondary buttons also vary: the dashboard "Enter World" uses `px-8 py-3 text-lg` while forge "Back to Dashboard" uses `px-6 py-3` with no text size.
**What it should be**: Define two button sizes: `.btn-lg` (px-8 py-3 text-lg font-semibold rounded-2xl) for primary page CTAs and `.btn-md` (px-4 py-2.5 text-sm font-medium rounded-lg) for inline/sidebar actions. The "Start Quest" oversized button (px-10 py-4 text-xl) is appropriate as a unique hero CTA -- keep it as an exception.
**Why this matters**: Inconsistent button sizing creates visual noise. When every button is a different size, none of them feel authoritative.

---

## PHASE 3 -- Polish

Micro-interactions, transitions, empty/loading/error states, and fine details.

### 3.1 Quest: Reveal Modal Animations Not Covered by prefers-reduced-motion

**What's wrong**: The staggered reveal animations in `apps/quest/src/routes/quest/+page.svelte:393-464` (`.reveal-icon`, `.reveal-subtitle`, `.reveal-name`, `.reveal-description`, `.reveal-spaces`, `.reveal-space-thumb`, `.reveal-cta`) and the `.shimmer-bar` animation (line 365-390) are defined in a `<style>` block, NOT in `layout.css`. The `prefers-reduced-motion` media query in `layout.css` (lines 196-211) only covers `.fade-in`, `.slide-up`, `.zoom-in`, `.celebrate`, `.smooth-transition`, and `.pulse-glow`. The reveal animations and shimmer are not covered.
**What it should be**: Add a `@media (prefers-reduced-motion: reduce)` block inside the quest page's `<style>` section that disables all `.reveal-*` and `.shimmer-bar` animations:

```css
@media (prefers-reduced-motion: reduce) {
	.reveal-icon,
	.reveal-subtitle,
	.reveal-name,
	.reveal-description,
	.reveal-spaces,
	.reveal-space-thumb,
	.reveal-cta {
		animation: none;
		opacity: 1;
		transform: none;
	}
	.shimmer-bar::after {
		animation: none;
	}
}
```

**Why this matters**: Users who have requested reduced motion will still see 8 staggered animations firing over 1.8 seconds. This is a WCAG 2.3.3 failure.

### 3.2 World: pulse-glow Duplicated in Component-Scoped Style

**What's wrong**: In `apps/quest/src/routes/world/+page.svelte:586-598`, the `.pulse-glow` class and its `@keyframes pulse-glow` are redefined inside a `<style>` block, duplicating the identical animation from `layout.css:137-146,174-176`. The world page also does not include the `prefers-reduced-motion` override for this local copy.
**What it should be**: Remove the duplicated `.pulse-glow` definition from `world/+page.svelte`. The global `layout.css` definition (which includes the reduced-motion override) will apply automatically. The pulse-glow color differs slightly (layout.css uses `rgba(139, 92, 246)`, world uses `rgba(147, 51, 234)`) -- standardize on the layout.css value.
**Why this matters**: Two definitions with different colors means the world modal's glow is purple-600 tinted while everywhere else is violet-tinted. And the local copy bypasses the reduced-motion override.

### 3.3 Forge: No Skeleton/Loading State for Main Canvas Image

**What's wrong**: In `apps/quest/src/routes/forge/[spaceId]/+page.svelte:305-313`, the main canvas `<img>` tag loads `workspace.currentImageUrl` with no loading state. When navigating between versions or after an AI edit completes, there is a flash of broken image while the new URL loads.
**What it should be**: Add `bg-slate-900` to the canvas container as a baseline. Add `opacity-0 transition-opacity duration-200` to the `<img>` and toggle to `opacity-100` via an `onload` handler. During the AI processing overlay (line 337-351), the spinner already covers the image, so this mainly matters for version switching.
**Why this matters**: Version switching is the most frequent user action in the forge. A flash of empty/broken image on every switch degrades the editing experience.

### 3.4 Dashboard: No Empty State for New User Without Quest

**What's wrong**: In `apps/quest/src/routes/+page.svelte:130-163`, the "new user" view has a hero section with "Start Quest" CTA. This is well-designed. However, if a user has a session but NO completed quest and NO spaces (e.g., session expired mid-quest, or database was reset), the page falls through to the "returning user" block (line 47) which shows an empty spaces grid (the `{#if data.spaces.length > 0}` block on line 71 handles this) but still shows "Welcome Back" with "Continue Forging" pointing to an empty `nextSpaceId`. The link would be `/forge/` (no ID), which would 404.
**What it should be**: Add a guard: if `data.hasSession && data.questCompleted` but `data.spaces.length === 0`, show a recovery state: "Your spaces couldn't be found. Start a new quest?" with a reset button.
**Why this matters**: Edge case, but it results in a broken link for the primary CTA. In a seminar setting where sessions may be cleared, this will happen.

### 3.5 Showcase: Error Page Is Visually Disconnected

**What's wrong**: The showcase error page (`apps/showcase/src/routes/+error.svelte`) uses `font-mono text-6xl font-bold text-white/20` for the status code and a simple `border border-white/10 bg-white/5` button. The quest error page (`apps/quest/src/routes/+error.svelte`) uses the Sparkles icon in a red container, 4xl bold heading, and a purple-600 rounded-2xl CTA. These are completely different design languages for the same concept.
**What it should be**: Create a shared `<ErrorPage>` component in `packages/shared/src/components/` that both apps use. It should accept `status`, `message`, and `homeHref` props. Use the quest app's design (icon container + heading + CTA) as the template since it is more polished. Replace the Sparkles icon with `AlertTriangle` from Lucide for clearer error semantics.
**Why this matters**: Users who encounter errors in the showcase will think they are on a different product. Error states are brand touchpoints.

### 3.6 World: Empty State Links Use `{base}` Inconsistently

**What's wrong**: In `apps/quest/src/routes/world/+page.svelte`, links use `{base}/` prefix (e.g., line 253: `href="{base}/"`, line 276: `href="{base}/"`). But in `apps/quest/src/routes/+page.svelte` and `apps/quest/src/routes/quest/+page.svelte`, links use bare `/` (e.g., page.svelte:156: `href="/quest"`, quest:132: `href="/"`). The metaverse page also uses `{base}` (metaverse:60: `href="{base}/"`).
**What it should be**: Use `{base}` consistently on ALL internal links, OR use bare `/` consistently. Since the quest app deploys to Cloudflare Workers at the root path, bare `/` is correct and `{base}` is unnecessary (it evaluates to `""` when `paths.base` is not set). Remove `{base}` from world and metaverse pages to match the rest of the app.
**Why this matters**: Mixing patterns creates confusion about whether a base path is required. If someone later configures a base path, only half the links will work.

### 3.7 Global: Favicon Is the Default Svelte Logo

**What's wrong**: The quest app's favicon (`apps/quest/src/lib/assets/favicon.svg`) is the default Svelte logo (orange flame). The showcase app references `favicon.png` in `apps/showcase/src/app.html:5` but the `showcase/static/` directory does not exist, so there is no favicon.
**What it should be**: Replace the Svelte logo with a custom ZyetaDX favicon that uses the brand purple. Create a simple SVG favicon -- perhaps the Sparkles icon silhouette in purple on transparent. Provide both SVG (quest) and PNG (showcase) versions.
**Why this matters**: The favicon is the first brand element users see in their browser tab. A default framework logo communicates "unfinished."

### 3.8 Toast: No ARIA Live Region

**What's wrong**: The `Toast.svelte` component (`packages/shared/src/components/Toast.svelte`) renders toast notifications as plain `<div>` elements with no `role="alert"` or `aria-live` attribute. Screen readers will not announce when toasts appear or disappear.
**What it should be**: Add `role="status"` and `aria-live="polite"` to the toast container div (line 10). For error toasts, use `role="alert"` and `aria-live="assertive"` to interrupt the screen reader. The type is already available (`t.type`) so the role can be conditional.
**Why this matters**: The toast system is used for success ("added to your world"), error, and info messages. None of these are announced to screen reader users.

### 3.9 BottomSheet: Drag Handle Has No Visible Affordance Label

**What's wrong**: The BottomSheet drag handle (`packages/shared/src/components/BottomSheet.svelte:194-208`) has `role="slider"` with `aria-label="Resize panel"`, which is good. But it uses `cursor-grab` as its only visual affordance -- a thin 10px wide, 1px tall rounded bar. On mobile, this is nearly invisible against the dark background.
**What it should be**: Increase the drag handle pill from `h-1 w-10` to `h-1.5 w-12` and increase its opacity from `bg-white/30` to `bg-white/40`. The touch target area (the 48px tall container) is appropriately sized.
**Why this matters**: Users need to see the drag handle to know the sheet is swipeable. The current handle is 4px tall and 40px wide -- barely perceptible on dark backgrounds.

### 3.10 Forge: Compare Slider Has No Keyboard Support

**What's wrong**: The before/after comparison slider in `apps/quest/src/routes/forge/[spaceId]/+page.svelte:477-485` uses `onmousedown` and `ontouchstart` to initiate dragging. There is no keyboard support -- pressing Arrow keys while the slider button is focused does nothing. The button has `aria-label="Drag to compare"` but no `role`, `aria-valuenow`, or keyboard handlers.
**What it should be**: Add `role="slider"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={compareSlider}`, and a `onkeydown` handler that adjusts `compareSlider` by 5% on ArrowLeft/ArrowRight. Change `aria-label` to `"Compare slider"`.
**Why this matters**: Keyboard-only users cannot operate the comparison feature at all. This is a WCAG 4.1.2 failure.

### 3.11 Forge: Completion Modal Has No Close/Dismiss Mechanism

**What's wrong**: The "Space Forged" modal in `apps/quest/src/routes/forge/[spaceId]/+page.svelte:738-822` has no close button and no backdrop click handler. The only way to dismiss it is to click one of the CTA links ("Forge Next" or "Enter Your World"), which navigate away. If the user wants to stay on the current page and review their completed space, they cannot dismiss the modal.
**What it should be**: Add an Escape key handler and a small close button (X icon) in the top-right corner. Add `onclick` on the backdrop to dismiss. Set `workspace.showCompletionModal = false` on dismiss.
**Why this matters**: Users who want to review their final edit before navigating away are trapped. The modal must be dismissable.

### 3.12 World: Arrange Panel Drag-and-Drop Has No Visual Feedback for Screen Readers

**What's wrong**: The arrange panel in `apps/quest/src/routes/world/+page.svelte:466-571` uses pointer events for drag-and-drop reordering. The items have `role="listitem"` but the container has no `role="list"`. There are no `aria-grabbed`, `aria-dropeffect`, or live region announcements when items are reordered.
**What it should be**: Wrap the hex grid in a `role="list"` container. Add `aria-roledescription="sortable list"`. Each item should have `aria-label="{model.name}, position {i+1} of {orderedModels.length}"`. Add a visually hidden live region that announces reorder results (e.g., "Moved Open Desk to position 3").
**Why this matters**: The arrange feature is completely inaccessible to keyboard and screen reader users.

---

## DESIGN SYSTEM UPDATES REQUIRED

1. **Remove `pulse-glow` from all CTA usage**. Keep the keyframe definition for potential use in actual loading indicators only. Add a comment: `/* For loading indicators only -- never for CTAs */`.

2. **Define CSS custom properties for glass variants**:
   - `--glass-panel-bg: rgba(15, 17, 26, 0.95)` -- replaces all `bg-[#0f111a]/95` and `bg-[#0f111a]/98`
   - `--glass-panel-blur: 24px` -- standardize backdrop-filter strength

3. **Define a formal type scale** in `layout.css`:
   - `.text-display`: text-4xl font-extrabold tracking-tight
   - `.text-title`: text-2xl font-bold sm:text-3xl
   - `.text-heading`: text-lg font-semibold
   - `.text-label`: text-xs font-semibold uppercase tracking-wide
   - Remove dead `.text-hero` and `.text-subheading`

4. **Define button size tokens**:
   - `.btn-lg`: inline-flex items-center gap-2 rounded-2xl px-8 py-3 text-lg font-semibold transition-all hover:scale-105
   - `.btn-md`: inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors

5. **Define semantic status colors**:
   - `--status-pending`: purple-500
   - `--status-active`: amber-500
   - `--status-complete`: emerald-500
   - `--status-error`: rose-500

6. **Add missing `prefers-reduced-motion` coverage** for all `<style>` block animations.

7. **Add ARIA live region** to Toast component.

8. **Create shared components** to eliminate duplication:
   - `<ErrorPage>` -- shared error state
   - `<WorldControls>` -- bottom control bar + keyboard shortcuts
   - `<ForgeControls>` -- sidebar/sheet controls (compare, complete, history)

---

## IMPLEMENTATION TABLE

| #    | File                                                             | Property                         | Old Value                                                                                                                                                                                                 | New Value                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1a | `apps/quest/src/routes/+page.svelte:158`                         | class                            | `pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-10 py-4 text-xl font-bold text-white transition-all hover:scale-105 hover:bg-purple-500`                                          | `inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-10 py-4 text-xl font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:bg-purple-500 hover:shadow-purple-500/40`                                                                                                                                                                                                         |
| 1.1b | `apps/quest/src/routes/quest/+page.svelte:348`                   | class                            | `reveal-cta pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500 disabled:opacity-50`        | `reveal-cta inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:bg-purple-500 hover:shadow-purple-500/40 disabled:opacity-50`                                                                                                                                                                       |
| 1.1c | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:558`         | class                            | `pulse-glow flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white shadow-lg transition-all hover:bg-purple-500 hover:shadow-purple-500/25 disabled:opacity-40` | `flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 font-medium text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-500 hover:shadow-purple-500/30 disabled:opacity-40`                                                                                                                                                                                                     |
| 1.1d | `apps/quest/src/routes/world/+page.svelte:207`                   | class                            | `pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500`                                       | `inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:bg-purple-500 hover:shadow-purple-500/40`                                                                                                                                                                                                      |
| 1.1e | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:795`         | class                            | `pulse-glow inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-emerald-500`                                     | `inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:bg-emerald-500 hover:shadow-emerald-500/40`                                                                                                                                                                                                  |
| 1.1f | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:804`         | class                            | `pulse-glow inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-purple-500`                                       | `inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-105 hover:bg-purple-500 hover:shadow-purple-500/40`                                                                                                                                                                                                      |
| 1.1g | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:813`         | class                            | `pulse-glow inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:scale-105 hover:bg-emerald-500`                                     | `inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 hover:bg-emerald-500 hover:shadow-emerald-500/40`                                                                                                                                                                                                  |
| 1.2  | `apps/quest/src/routes/quest/+page.svelte:178-183`               | img wrapper                      | `<div class="aspect-[4/3] w-full">` + bare `<img>`                                                                                                                                                        | `<div class="aspect-[4/3] w-full bg-slate-800">` + `<img ... class="h-full w-full object-cover opacity-0 transition-opacity duration-300" onload={(e) => e.currentTarget.classList.add('opacity-100')} />`                                                                                                                                                                                                              |
| 1.5  | `apps/showcase/src/app.html:5`                                   | (missing)                        | (no meta color-scheme)                                                                                                                                                                                    | `<meta name="color-scheme" content="dark" />` (add after line 4)                                                                                                                                                                                                                                                                                                                                                        |
| 1.6a | `apps/quest/src/app.html:9`                                      | body first-child                 | `<body data-sveltekit-preload-data="hover">`                                                                                                                                                              | `<body data-sveltekit-preload-data="hover"><a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:rounded-lg focus:bg-purple-600 focus:px-4 focus:py-2 focus:text-white">Skip to content</a>`                                                                                                                                                                |
| 1.6b | `apps/quest/src/routes/+layout.svelte:20`                        | main tag                         | `<main>`                                                                                                                                                                                                  | `<main id="main-content">`                                                                                                                                                                                                                                                                                                                                                                                              |
| 1.7  | `packages/editor-engine/src/components/VersionTree.svelte:89-99` | delete button class              | `class="flex h-6 w-6 items-center justify-center rounded text-slate-500 opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400"`        | `class="flex h-8 w-8 items-center justify-center rounded text-slate-500 opacity-0 transition-all group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-rose-500/20 hover:text-rose-400"`                                                                                                                                                                                                                      |
| 2.1a | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:526`         | sidebar class                    | `bg-[#0f111a]/95 backdrop-blur-xl`                                                                                                                                                                        | `glass-panel` (remove inline bg/backdrop, rely on .glass-panel token)                                                                                                                                                                                                                                                                                                                                                   |
| 2.1b | `packages/shared/src/components/BottomSheet.svelte:188`          | sheet class                      | `bg-[#0f111a]/98 backdrop-blur-xl`                                                                                                                                                                        | `glass-panel` (remove inline bg/backdrop, add glass-panel)                                                                                                                                                                                                                                                                                                                                                              |
| 2.3  | `apps/quest/src/routes/+page.svelte:77`                          | card link class                  | `smooth-transition group overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:border-purple-500/30`                                                                                         | `smooth-transition group overflow-hidden rounded-xl border border-white/10 bg-white/5 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/10 active:scale-[0.98]`                                                                                                                                                                                                                                        |
| 3.1  | `apps/quest/src/routes/quest/+page.svelte`                       | `<style>` block (after line 463) | (no reduced motion override)                                                                                                                                                                              | Add `@media (prefers-reduced-motion: reduce) { .reveal-icon, .reveal-subtitle, .reveal-name, .reveal-description, .reveal-spaces, .reveal-space-thumb, .reveal-cta { animation: none !important; opacity: 1; transform: none; } .shimmer-bar::after { animation: none; } }`                                                                                                                                             |
| 3.2  | `apps/quest/src/routes/world/+page.svelte:586-598`               | scoped style block               | `.pulse-glow { animation: pulse-glow 2s ease-in-out infinite; } @keyframes pulse-glow { ... }`                                                                                                            | Remove entire block (13 lines). Global layout.css definition applies.                                                                                                                                                                                                                                                                                                                                                   |
| 3.7  | `apps/quest/src/lib/assets/favicon.svg`                          | content                          | Svelte orange flame logo                                                                                                                                                                                  | Custom ZyetaDX purple icon (Sparkles silhouette or brand mark)                                                                                                                                                                                                                                                                                                                                                          |
| 3.8a | `packages/shared/src/components/Toast.svelte:10`                 | container div                    | `class="fixed top-4 right-4 z-[200] flex flex-col gap-2"`                                                                                                                                                 | `class="fixed top-4 right-4 z-[200] flex flex-col gap-2" role="region" aria-label="Notifications" aria-live="polite"`                                                                                                                                                                                                                                                                                                   |
| 3.8b | `packages/shared/src/components/Toast.svelte:13`                 | individual toast div             | `class="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-md ...`                                                                                                       | Add `role={t.type === 'error' ? 'alert' : 'status'}` attribute to the div                                                                                                                                                                                                                                                                                                                                               |
| 3.9  | `packages/shared/src/components/BottomSheet.svelte:208`          | drag handle pill                 | `class="h-1 w-10 rounded-full bg-white/30"`                                                                                                                                                               | `class="h-1.5 w-12 rounded-full bg-white/40"`                                                                                                                                                                                                                                                                                                                                                                           |
| 3.10 | `apps/quest/src/routes/forge/[spaceId]/+page.svelte:477-485`     | compare slider button            | `<button ... onmousedown={() => (isDraggingCompare = true)} ontouchstart={() => (isDraggingCompare = true)} aria-label="Drag to compare">`                                                                | `<button ... role="slider" aria-label="Compare slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(compareSlider)} onmousedown={() => (isDraggingCompare = true)} ontouchstart={() => (isDraggingCompare = true)} onkeydown={(e) => { if (e.key === 'ArrowLeft') compareSlider = Math.max(0, compareSlider - 5); if (e.key === 'ArrowRight') compareSlider = Math.min(100, compareSlider + 5); }}>` |

---

## SUMMARY BY PRIORITY

**P0 -- Fix immediately (8 issues):**
1.1 pulse-glow on CTAs, 1.3 double CommandBar, 1.4 competing toast systems, 1.6 skip-link, 1.8 modal focus issues, 3.1 reduced-motion gaps, 3.8 ARIA live on toasts, 3.10 compare slider keyboard

**P1 -- Fix before next deploy (9 issues):**
1.2 image loading states, 1.5 color-scheme meta, 1.7 touch targets, 2.1 glass token standardization, 2.3 card hover elevation, 2.6 sidebar pulse-glow, 2.7 status color consistency, 3.11 completion modal dismissal, 3.12 arrange panel a11y

**P2 -- Fix in next sprint (7 issues):**
2.2 type scale, 2.4 forge controls extraction, 2.5 world controls extraction, 2.8 button sizing tokens, 3.2 duplicated pulse-glow style, 3.3 canvas image loading, 3.5 error page component

**P3 -- Track and schedule (4 issues):**
3.4 empty state edge case, 3.6 base path consistency, 3.7 favicon, 3.9 drag handle visibility
