# Markdown footer

## Problem

Thunderbird's signature is HTML or plain text, not Markdown, and on a reply it
sits wherever the account settings put it, which by default is below the quoted
message. A footer written below the quote is easy for a recipient to miss, and
there is no way to write one in Markdown.

## Goal

Let the author write one footer in Markdown and have it placed in each new
message, directly below their own text and above the earlier messages in the
thread, where they can edit or remove it before sending.

## Scope decisions

- **One footer, stored in an options page.** This is the add-on's first
  preference. The README already names where one goes when it earns its place:
  `options_ui` in `manifest.json`.
- **Inserted when the compose window opens, as Markdown source.** The footer is
  ordinary text in the body, so it can be edited or deleted for one message,
  and the send path and preview need no changes. Drafts are saved with the
  footer as it stands.
- **New messages, replies, and forwards only.** A reopened draft already holds
  the footer, or deliberately does not.
- **One footer for all accounts.** Per-identity footers wait until someone
  needs them.
- **`storage` permission.** The footer is kept in `browser.storage.local`.

## Behavior

- **Tools → Add-ons and Themes → Markdown Compose → Preferences** shows a text
  area for the footer and a rendered preview of it. Changes save as you type.
  An empty footer means no footer.
- When an HTML compose window opens for a new message, reply, or forward, the
  footer is inserted immediately before the first top-level block Thunderbird
  generated (a cite line, quoted message, forward, or signature). With none of
  those, it goes at the end of the body. The cursor stays where Thunderbird put
  it.
- A blank line separates the footer from the text above it, so the two render
  as separate paragraphs.
- Plain-text compositions get no footer.

### Replying to a selection

Selecting a passage in a message and replying quotes only that passage. Such a
reply is an answer to those lines, so it is laid out bottom-posted: the cursor
and the footer go directly below the quote, and the empty line Thunderbird
leaves above the cite line for a reply on top is removed. A reply to the whole
message keeps the layout above. This applies even with no footer set.

A whole-message quote starts with the original's content-type `<meta>` for an
HTML message, or with Thunderbird's own wrapper (`.moz-text-flowed`,
`.moz-text-plain`, `pre.moz-quote-pre`) for a plain-text one. A selection quote
starts with the selected content. Checked against drafts of both kinds of reply
to HTML messages. A misjudged quote falls back to bottom-posting a whole
message, or top-posting a selection, so the result is always a usable layout.

Thunderbird's own signature is left in place. To use the footer in its place,
clear the signature in the account settings.

## Design

Only the background page can read the composition type
(`compose.getComposeDetails().type`), and only the compose script can edit the
body without replacing it. So:

1. `src/footer.js`, a compose script loaded after `paste.js`, sends
   `{type: "mdc:layout"}` when it loads.
2. `background.js` answers `{footer}` if the window is HTML and its type is
   `new`, `reply`, or `forward`, and `null` otherwise.
3. For a selection reply, the compose script adds a `<div class="mdc-cursor">`
   after the quote, the footer after that, and puts the caret in the cursor
   block. Otherwise it inserts the footer as a `<div class="mdc-footer">`
   before the first generated block. The footer is converted with
   `markdownToEditorHtml()`. Both classes let a reinjected script (after an
   add-on reload) skip a window it has already laid out.

Asking from the compose script, rather than pushing from `tabs.onCreated`,
means the footer is requested only once the editor exists.

## Files touched

- `manifest.json`: `storage` permission, `options_ui`, and `src/footer.js`.
- `src/footer.js`: new compose script for the footer and selection replies.
- `src/options.html`, `src/options.js`: new options page.
- `src/background.js`: the `mdc:layout` handler.
- `README.md`, `SECURITY.md`, `CLAUDE.md`, `CHANGELOG.md`.

## Open questions for manual testing

- That Thunderbird has finished building the reply (cite line, quote,
  signature) by the time the compose script runs.
- Whether the insertion marks an untouched message as modified, so closing it
  asks to save.
- How "Edit as New" and templates report their type.
- Selection replies to plain-text messages, whose quote markup is unverified.

## Out of scope

- Per-identity footers.
- Removing or moving Thunderbird's own signature.
