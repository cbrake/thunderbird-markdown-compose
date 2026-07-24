# Per-window enable/disable toggle

## Problem

The add-on assumes the compose window holds Markdown source and converts at two
moments: on paste (rich text becomes Markdown) and on send (Markdown becomes
HTML). When you want to write an ordinary rich-text message, both conversions
get in the way — a paste is flattened to Markdown, and send re-renders what you
typed. There is no way to stand the add-on down for a single message.

## Goal

Let the author disable conversion for one compose window, covering **both** the
on-paste and on-send conversion, and show that state on the toolbar button.

## Scope decisions

- **Per compose window, defaulting to active.** Each new window starts active;
  there is nothing to persist. This keeps the "no configuration until someone
  needs it" rule — the switch is a per-window mode, not a stored preference.
- **The toggle lives inside the existing preview popup.** A MailExtension can
  declare only one `compose_action` (a single manifest object, not an array), so
  a second dedicated toolbar button is not possible in plain Manifest V3. Rather
  than move preview elsewhere and spend a `menus` permission, the one button
  keeps opening the preview popup, and the on/off control goes inside it.
- **No new manifest permission and no new manifest scripts.** The design reuses
  `composeAction` (button + badge) and `runtime` messaging.

## Behavior

- The toolbar button opens the preview popup as it does today.
- The popup gains a checkbox at the top: *"Convert this message to HTML"*,
  checked by default. Unchecking it disables conversion for that window;
  re-checking restores it.
- While a window is disabled:
  - `paste.js` leaves a paste alone, so Thunderbird's own rich-text paste runs.
  - `onBeforeSend` sends the body exactly as written.
  - The popup replaces the rendered preview with a single line: *"Conversion is
    off — this message will be sent as written."* (No value in rendering raw
    HTML you are already editing in WYSIWYG.)
- The button reflects state with a **badge**: an "off" badge on a red background
  while the window is disabled, cleared when active. A badge rather than an icon
  swap because Thunderbird applies `context-fill` theming only to
  manifest-declared action icons; an icon set at runtime with `setIcon()`
  rasterises blank (a regression present since Thunderbird 128). A badge is
  themed by Thunderbird and shows on any toolbar. The manifest `default_icon`
  stays in place and is never replaced.

## Source of truth: the compose script

Each window's on/off state is a `let active = true` inside `paste.js`, the
compose script, which is the single source of truth.

This placement is deliberate. The background is a Manifest V3 event page that
Thunderbird may terminate while a compose window sits idle with no events, so a
flag kept there could be lost mid-compose and silently revert a disabled window
to converting on send. The compose script lives exactly as long as its window,
so the flag never outlives or underlives the window it describes. No storage
API, no permission, no restart mismatch.

## Messaging protocol

A small `runtime.onMessage` protocol, with the compose script answering:

- `{ type: "mdc:get" }` → the compose script replies `{ active }`.
- `{ type: "mdc:set", active }` → the compose script sets its flag; may reply
  `{ active }` for confirmation.

Message type strings are namespaced (`mdc:`) so they do not collide with any
other listener.

### paste.js (compose script — owns the flag)

- Holds `let active = true`.
- Registers the `onMessage` handler above.
- Adds one early return to the existing paste handler: `if (!active) return;`,
  before any conversion, so a disabled window falls through to the editor's
  native paste.

### preview.js (popup — reads and writes the flag, updates the badge)

- On open, after resolving the compose tab (it already does this via
  `browser.tabs.query`), it messages the tab `mdc:get` and renders the checkbox
  and preview to match. Plain-text compositions keep their existing message and
  show no checkbox.
- On toggle, it sends `mdc:set` to the compose tab, then updates the button
  badge with `browser.composeAction.setBadgeText({ tabId, text })` ("off" when
  disabled, cleared when active) and re-renders the preview area. It also
  re-asserts the badge on open, so it self-corrects.
- If `mdc:get` cannot be reached, it defaults to active.

### background.js (send path — reads the flag)

- `onBeforeSend` keeps its `isPlainText` early return.
- It then asks the compose script for state; `onBeforeSend` may return a Promise,
  so the round trip is fine:
  `const state = await browser.tabs.sendMessage(tab.id, { type: "mdc:get" }).catch(() => null);`
- If `state && state.active === false`, it returns `{}` (send as written).
  Otherwise it converts as it does today. A compose script that cannot be
  reached defaults to converting, preserving current behavior.

## Toolbar state: a badge, not an icon swap

The button shows state with a per-tab badge, not by changing its icon. An icon
set at runtime with `setIcon()` cannot be themed: Thunderbird supplies
`context-fill` only to manifest-declared action icons, so a runtime SVG
rasterises blank (a regression since Thunderbird 128). The badge, in contrast,
is themed by Thunderbird and shows on any toolbar. `showBadge(tabId, active)`
sets the text to "off" on a red background when disabled and clears it when
active; the manifest `default_icon` (`icons/markdown.svg`) is never replaced.

## Files touched

- `src/paste.js` — flag, message handler, paste early return.
- `src/preview.js` — read/write flag, checkbox rendering, badge update.
- `src/preview.html` — checkbox markup and minimal styling.
- `src/background.js` — query flag in `onBeforeSend`.
- `README.md` — a short "Disabling for a message" note.

`src/render.js`, `src/style.js`, and `src/source.js` are untouched, so the pure,
Node-testable layer stays exactly as it is. `manifest.json` needs no change.

## Edge cases

- **Plain-text compositions:** unchanged. The button is already disabled for
  plain text (`updateComposeAction`), so there is nothing to toggle.
- **Pasting before disabling:** a paste made while active is already converted
  and cannot be un-converted after the fact. The author disables first; the
  "off" badge is the reminder. Noted in the README.
- **Compose script unreachable** (not yet injected, or an unexpected window):
  both the popup and `onBeforeSend` default to active/convert, matching today's
  behavior.

## Testing

The changes are all browser-API and DOM glue, which this project already keeps
out of the `node --test` suite (as it does for `paste.js` and `source.js`). No
new Node tests. Verification is manual in Thunderbird:

1. Load the temporary add-on; open a compose window; confirm no badge.
2. Open the popup, uncheck the toggle; confirm the "off" badge appears.
3. Paste rich text; confirm it stays rich (no Markdown flattening).
4. Send; confirm the message arrives as written, not re-rendered.
5. Re-check the toggle; confirm paste and send convert again.

## Out of scope

- A global default or persisted preference (deliberately excluded per the
  configuration rule).
- A separate dedicated toggle button (not possible in plain MV3).
- Rendering the raw body in the popup while disabled — a plain message is used
  instead; the sandboxed-frame view can be added later if it proves wanted.
