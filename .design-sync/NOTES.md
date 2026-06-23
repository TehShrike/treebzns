# design-sync notes — treebzns

## Shape & approach
- **Off-script build.** This repo is NOT a React component library. It's a Svelte SPA whose
  design system is **pure CSS**: `public/98.css` (a modified Win98 look) plus
  `public/global_reset.css`, `public/global_variables.css`, `public/global_styles.css`, and the
  `public/98-icon/*.svg` assets the CSS `url()`s reference.
- The design-sync converter (`package-build.mjs`) cannot run here — there is no React package,
  no `dist/`, nothing to bundle into `window.<globalName>.*`. The layout under `ds-bundle/` is
  authored by hand.
- User decision: **CSS + documented markup** (no authored React wrappers). The claude.ai/design
  agent writes plain JSX/HTML elements using our classNames; `styles.css` (the full @import
  closure) is the styling layer, and the conventions header + per-component `.prompt.md` files
  teach the class vocabulary.
- `_ds_bundle.js` is an **empty-bodied** IIFE (`window.Treebzns98 = {}`) — the "tokens-only DS"
  pattern. There are no importable components by design.
- "Components" are HTML element + class patterns documented in
  `client/route/design_system/DesignSystem.State.svelte` (the de-facto Storybook). Preview cards
  (`<Name>.html`) are static HTML that render without React.

## Target
- Fresh project "treebzns Design System" (011cabf9-e06e-4eb2-a60e-981954d1564e), created because
  a separate hand-built "98.css Design System" project already existed and the user chose not to
  touch it.

## Verification
- The repo CSS uses `:has()` + CSS `&`-nesting + `::before` for checkbox/radio glyphs,
  progress-bar fill, tree connectors, etc. **Verify cards with a modern browser** — the
  Homebrew `chromium` here is **v98** (pre-nesting, Chrome 112) and renders those glyphs/fills
  blank. Use `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new`.
- All 14 cards verified rendering correctly in Chrome 149 on 2026-06-19.

## Re-sync risks
- No deterministic converter runs here, so a re-sync is a re-run of the hand-authored build.
  If `public/98.css` or the global CSS files change, `styles.css`'s copied closure must be
  rebuilt and the affected component cards/docs re-checked by hand.
- `_ds_sync.json` is hand-produced (the storybook recipe's story facts don't apply); a re-sync
  has a weaker anchor and should re-verify the cards visually.
