# Emphasis shortcuts

## Problem

Ctrl+B and Ctrl+I apply the editor's own bold and italic. The compose body
holds Markdown source, and the send path reads only its text, so that
formatting shows in the compose window and is then lost on send.

## Goal

Make the familiar shortcuts write Markdown: Ctrl+B wraps the selection in
`**`, and Ctrl+I wraps it in `_`.

## Behavior

- **A selection is wrapped.** `word` becomes `**word**`. Whitespace the
  selection picked up, from a double click for example, stays outside the
  markers, because `** word**` is not emphasis.
- **A wrapped selection is unwrapped.** Selecting `**word**` and pressing
  Ctrl+B gives `word`, so the shortcut toggles as it does elsewhere.
- **No selection inserts an empty pair** with the cursor between the markers.
- **A selection spanning lines is left alone.** Emphasis cannot cross a
  paragraph, and wrapping each line separately is a guess. The editor's own
  formatting is still suppressed, since it would be lost on send.
- **Ctrl+Z undoes the change**, because the text is inserted with
  `execCommand`, as pastes are.
- **A window with conversion switched off keeps the editor's formatting**,
  since that message is sent exactly as written.

## Design

- `src/emphasis.js` holds `emphasisMarkdown(selected, marker)`: string in,
  string out, tested under `node --test`, like `src/link.js`.
- `src/paste.js` handles `keydown` in the capture phase, next to the paste
  handler that shares its `active` flag, and calls `preventDefault()` so
  Thunderbird's key binding does not also apply bold or italic.
