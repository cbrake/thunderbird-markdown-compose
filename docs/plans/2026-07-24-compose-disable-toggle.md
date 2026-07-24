# Per-window enable/disable toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author disable Markdown conversion for a single compose window — both on paste and on send — toggled inside the preview popup and shown by swapping the toolbar-button icon.

**Architecture:** The compose script (`paste.js`) holds a per-window `active` flag and is the single source of truth, reached through a tiny `runtime` message protocol. The preview popup reads and writes the flag and swaps the button icon; the send path (`onBeforeSend`) reads the flag and skips conversion when a window is off. No manifest change and no new permission.

**Tech Stack:** Thunderbird MailExtension (Manifest V3), plain scripts sharing one global scope, no bundler. `browser.runtime` messaging, `browser.composeAction.setIcon`, `browser.compose.onBeforeSend`.

## Global Constraints

- Thunderbird 151+ (Manifest V3). No new manifest permission; no new `background.scripts` or `compose_scripts` entries.
- Seven-plain-scripts model: files reference each other by global name; the two contexts (compose script vs. background/popup) never share a scope, only messages.
- `render.js`, `style.js`, `source.js` stay untouched — the pure, Node-testable layer does not change.
- No `node --test` coverage is added: these changes are browser-API/DOM glue, which this project verifies manually in Thunderbird (as it already does for `paste.js` and `source.js`). Each task's verification is a manual step in the Debug Add-ons flow: **Tools → Developer Tools → Debug Add-ons → Load Temporary Add-on → select `manifest.json`**, reloading after each change.
- Message protocol (namespaced `mdc:` to avoid collisions):
  - `{ type: "mdc:get" }` → reply `{ active: boolean }`
  - `{ type: "mdc:set", active: boolean }` → set the flag, reply `{ active: boolean }`
- Icon paths (relative to extension root): active `icons/markdown.svg` (the manifest default), disabled `icons/markdown-off.svg`.

---

### Task 1: Outline "off" icon

**Files:**
- Create: `icons/markdown-off.svg`

**Interfaces:**
- Consumes: nothing.
- Produces: `icons/markdown-off.svg` — an outline (hollow) Markdown mark that mirrors the frame of the solid `icons/markdown.svg`, used by Task 4's icon swap.

- [ ] **Step 1: Create the outline icon**

Write `icons/markdown-off.svg`. It reuses the exact outer rounded-rectangle path from `icons/markdown.svg` but strokes it instead of filling it, and draws the M and down-arrow as strokes, so the interior reads as white/hollow. `stroke="context-fill"` keeps Thunderbird theming it to the toolbar, matching the solid icon.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"
     fill="none" stroke="context-fill" stroke-opacity="context-fill-opacity"
     stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round">
  <path d="M1.5 3h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
  <path d="M3 11V5l2.4 3L7.8 5v6"/>
  <path d="M11.6 5v4.2M10 8.2l1.6 1.8L13.2 8.2"/>
</svg>
```

- [ ] **Step 2: Verify it renders as a hollow mark**

Open both `icons/markdown.svg` and `icons/markdown-off.svg` in a browser or image viewer side by side.
Expected: the "off" icon is the same rounded-rectangle frame as the solid one, but hollow, with an outlined M and down-arrow. If the strokes look too heavy or thin against the solid version, adjust `stroke-width` (roughly 0.9–1.3) and re-check.

- [ ] **Step 3: Commit**

```bash
git add icons/markdown-off.svg
git commit -m "feat: add outline icon for the disabled state"
```

---

### Task 2: The per-window flag in the compose script

**Files:**
- Modify: `src/paste.js`

**Interfaces:**
- Consumes: the message protocol (Global Constraints).
- Produces: a compose script that answers `mdc:get`/`mdc:set` and, while `active` is false, lets the editor's native paste run instead of converting. This flag is the source of truth Task 3 and Task 4 read.

- [ ] **Step 1: Add the flag and message handler**

In `src/paste.js`, after the `turndown` setup block (the `turndown.use(...)` line) and before `function markdownFromClipboard`, add:

```js
/**
 * Whether this compose window converts. The add-on can be stood down for a
 * single message, and this flag is the source of truth for that window: a
 * compose script lives exactly as long as its window, whereas the background
 * event page may be terminated between events. The preview popup reads and
 * writes it, and the send path reads it, through the messages below.
 */
let active = true;

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "mdc:get") {
    return Promise.resolve({ active });
  }
  if (message?.type === "mdc:set") {
    active = message.active !== false;
    return Promise.resolve({ active });
  }
});
```

- [ ] **Step 2: Gate the paste handler on the flag**

In the same file, add a single early return as the first line inside the `paste` event listener callback, before `const html = ...`:

```js
document.addEventListener(
  "paste",
  (event) => {
    if (!active) return;
    const html = event.clipboardData?.getData("text/html");
    if (!html) return;
```

(Leave the rest of the handler unchanged.)

- [ ] **Step 3: Verify the flag disables paste conversion**

Temporarily change `let active = true;` to `let active = false;`. Load the add-on (Debug Add-ons → Load Temporary Add-on → `manifest.json`), open an HTML compose window, and paste some rich text copied from a web page.
Expected: the paste keeps its formatting (Thunderbird's native paste), rather than being flattened to Markdown source.

Now change it back to `let active = true;`, reload the temporary add-on, and paste the same rich text again.
Expected: the paste is converted to Markdown source, as before this change.

- [ ] **Step 4: Commit**

```bash
git add src/paste.js
git commit -m "feat: add a per-window convert on/off flag to the compose script"
```

---

### Task 3: Honour the flag on send

**Files:**
- Modify: `src/background.js`

**Interfaces:**
- Consumes: `mdc:get` from the compose script (Task 2).
- Produces: an `onBeforeSend` that sends the body verbatim when the window is off, and converts otherwise.

- [ ] **Step 1: Make onBeforeSend read the flag**

In `src/background.js`, replace the existing `onBeforeSend` listener:

```js
browser.compose.onBeforeSend.addListener((tab, details) => {
  // The compose format of an open window cannot be changed, so a plain text
  // message is sent exactly as written.
  if (details.isPlainText) return {};

  const body = convertComposeBody(details.body);
  return body ? { details: { body } } : {};
});
```

with an async version that first asks the compose script whether this window is off:

```js
browser.compose.onBeforeSend.addListener(async (tab, details) => {
  // The compose format of an open window cannot be changed, so a plain text
  // message is sent exactly as written.
  if (details.isPlainText) return {};

  // The compose script owns the per-window on/off flag. A window that has been
  // switched off is sent exactly as written. If the script cannot be reached,
  // fall back to converting, which is the default behaviour.
  const state = await browser.tabs
    .sendMessage(tab.id, { type: "mdc:get" })
    .catch(() => null);
  if (state && state.active === false) return {};

  const body = convertComposeBody(details.body);
  return body ? { details: { body } } : {};
});
```

- [ ] **Step 2: Verify send still converts by default**

Reload the temporary add-on. In an HTML compose window, write some Markdown (e.g. `# Hello` and `**bold**`) and send it to yourself.
Expected: the received message is rendered HTML, exactly as before this change (no regression).

- [ ] **Step 3: Verify send passes through when the flag is off**

Temporarily change `let active = true;` to `let active = false;` in `src/paste.js`, reload the add-on, write some Markdown in a new HTML compose window, and send it to yourself.
Expected: the received message contains the literal Markdown text (`# Hello`, `**bold**`), not rendered HTML — the send path skipped conversion.

Change `src/paste.js` back to `let active = true;` and reload.

- [ ] **Step 4: Commit**

```bash
git add src/background.js
git commit -m "feat: skip send conversion when a compose window is switched off"
```

---

### Task 4: Toggle and icon swap in the preview popup

**Files:**
- Modify: `src/preview.html`
- Modify: `src/preview.js`

**Interfaces:**
- Consumes: `mdc:get`/`mdc:set` (Task 2), `icons/markdown-off.svg` (Task 1).
- Produces: the user-facing control — a checkbox that reads and writes the flag, swaps the button icon per tab, and re-renders the preview.

- [ ] **Step 1: Add the checkbox to the popup markup**

In `src/preview.html`, inside `<style>`, add a rule for the toggle bar (after the `#message` rule):

```css
      #toggle {
        display: block;
        margin-bottom: 0.75em;
        padding-bottom: 0.75em;
        border-bottom: 1px solid #d0d7de;
        font-family: sans-serif;
        font-size: 0.9em;
        color: #24292f;
      }
      #toggle[hidden] {
        display: none;
      }
```

Then, in `<body>`, add the label as the first child, before `<div id="message">`:

```html
    <label id="toggle" hidden>
      <input type="checkbox" id="toggle-input" checked />
      Convert this message to HTML
    </label>
    <div id="message"></div>
```

- [ ] **Step 2: Wire the popup to the flag and icon**

In `src/preview.js`, replace the entire `showPreview` function (and the trailing `showPreview();` call stays) with:

```js
/** Show the current compose body as it will be sent. */
async function showPreview() {
  const message = document.getElementById("message");
  const preview = document.getElementById("preview");
  const toggle = document.getElementById("toggle");
  const toggleInput = document.getElementById("toggle-input");

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const details = await browser.compose.getComposeDetails(tab.id);

  if (details.isPlainText) {
    message.textContent =
      "This message is in plain text mode, so it will be sent as written.";
    return;
  }

  // The compose script owns the flag; default to active if it cannot be reached.
  const state = await browser.tabs
    .sendMessage(tab.id, { type: "mdc:get" })
    .catch(() => null);
  let active = !(state && state.active === false);

  toggle.hidden = false;
  toggleInput.checked = active;

  // Redraw message and preview for the current state.
  const draw = () => {
    message.textContent = "";
    preview.replaceChildren();

    if (!active) {
      message.textContent =
        "Conversion is off — this message will be sent as written.";
      return;
    }

    const { segments, preserved } = segmentComposeBody(details.body);
    if (!segments.some((segment) => segment.markdown)) {
      message.textContent = "Nothing to preview yet.";
    }

    // Segments are in document order, so writing above a quote, below it, or
    // both previews the way the message will actually read.
    for (const segment of segments) {
      preview.appendChild(
        segment.markdown
          ? renderedBlock(segment.markdown, preserved)
          : passThroughFrame(segment.html),
      );
    }
  };

  toggleInput.addEventListener("change", async () => {
    active = toggleInput.checked;
    await browser.tabs.sendMessage(tab.id, { type: "mdc:set", active });
    await browser.composeAction.setIcon({
      tabId: tab.id,
      path: active ? "icons/markdown.svg" : "icons/markdown-off.svg",
    });
    draw();
  });

  draw();
}

showPreview();
```

- [ ] **Step 3: Verify the toggle end to end**

Reload the temporary add-on (make sure `src/paste.js` reads `let active = true;`).

1. Open an HTML compose window. Confirm the toolbar button shows the solid icon.
2. Write some Markdown, click the button. The popup shows the checkbox checked and the rendered preview.
3. Uncheck the checkbox. The preview is replaced by "Conversion is off — this message will be sent as written." Close the popup; the toolbar button now shows the outline icon.
4. Paste rich text into the body. Expected: it stays rich (no Markdown flattening).
5. Send the message to yourself. Expected: it arrives as written, not re-rendered.
6. In a fresh compose window, write Markdown, open the popup, leave the box checked, and send. Expected: it arrives as rendered HTML. Toggle off then back on in one window and confirm the icon returns to solid and the preview renders again.

- [ ] **Step 4: Commit**

```bash
git add src/preview.html src/preview.js
git commit -m "feat: add convert on/off toggle and icon swap to the preview popup"
```

---

### Task 5: Document disabling in the README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: user-facing documentation of the toggle.

- [ ] **Step 1: Add a note to the Use section**

In `README.md`, in the `## Use` section, after the numbered list (the item that ends "The Markdown is converted to HTML on the way out."), add:

```markdown
To send an ordinary rich-text message instead, open the preview popup and clear
**Convert this message to HTML**. That switches the add-on off for this compose
window: pastes keep their formatting and the message is sent exactly as written.
The toolbar button shows a hollow icon while a window is switched off. Turn it
off before pasting — a paste made while conversion is on is already turned into
Markdown source and cannot be reversed by switching off afterward.
```

- [ ] **Step 2: Verify the wording reads correctly**

Read the edited `## Use` section top to bottom.
Expected: the new paragraph follows the numbered steps and accurately describes the checkbox label ("Convert this message to HTML"), the hollow icon, and the paste-order caveat.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe switching conversion off for a message"
```

---

## Self-Review

**Spec coverage:**
- Per-window, default active → Task 2 (`let active = true`, per compose script). ✓
- Toggle inside preview popup → Task 4. ✓
- Disable both on-paste and on-send → Task 2 (paste early return) + Task 3 (`onBeforeSend`). ✓
- Compose script is source of truth → Task 2, read by Tasks 3 and 4. ✓
- Message protocol `mdc:get`/`mdc:set` → Global Constraints, implemented Task 2, consumed Tasks 3–4. ✓
- "Conversion is off" message when disabled → Task 4 `draw()`. ✓
- Icon swap solid/outline → Task 1 (asset) + Task 4 (`setIcon`). ✓
- No manifest change, no new permission → confirmed in Global Constraints; no task touches `manifest.json`. ✓
- Plain-text unchanged → Task 3 keeps the `isPlainText` early return; Task 4 keeps the plain-text message and leaves the toggle hidden. ✓
- Compose-script-unreachable defaults to convert → Task 3 (`.catch(() => null)`) and Task 4 (`!(state && ...)`). ✓
- README note incl. paste-order caveat → Task 5. ✓

**Type consistency:** message types `mdc:get`/`mdc:set` and field `active` are identical across Tasks 2, 3, 4. Icon paths `icons/markdown.svg` / `icons/markdown-off.svg` match Task 1's filename and the manifest default. Element ids `toggle` / `toggle-input` match between `preview.html` (Task 4 Step 1) and `preview.js` (Task 4 Step 2).

**Placeholder scan:** no TBD/TODO; every code step shows complete code; verification steps state expected outcomes.
