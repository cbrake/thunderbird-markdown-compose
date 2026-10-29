# Markdown footer Implementation Plan

**Goal:** Insert a Markdown footer, set in an options page, into each new
message, reply, and forward when it opens, above the quoted message. See
`docs/specs/2026-10-29-markdown-footer-design.md`.

## Tasks

1. **Options page.** `src/options.html` and `src/options.js`: a text area that
   saves to `browser.storage.local` on input, with a rendered preview using the
   shared render scripts. Register with `options_ui` and add the `storage`
   permission.
2. **Background.** In `src/background.js`, answer `mdc:layout` from a compose
   tab with `{footer}` when the composition is HTML and of type `new`,
   `reply`, or `forward`, and `null` otherwise.
3. **Compose script.** `src/footer.js`, loaded after `src/paste.js`: request the
   layout on load and insert the footer before the first generated top-level
   block, or at the end.
4. **Selection replies.** When the first top-level quote does not start with a
   whole-message marker, remove the blank lines above the cite line, add a
   cursor block and the footer below the quote, and move the caret there.
5. **Docs.** README section and file table, permission notes in README and
   SECURITY.md, CLAUDE.md architecture note, changelog entry.

## Verification

`make test` covers nothing new: the change is browser-API and DOM glue. Manual,
in Thunderbird, with a footer set:

- New message: footer at the end, cursor at the top.
- Reply: footer between the cursor line and the cite line.
- Reply with the signature set above the quote: footer above the signature.
- Forward: footer above the forwarded message.
- Save a draft, close, reopen: one footer.
- Edit the footer in a message and send: the edited text is sent.
- Close an untouched new message: note whether it asks to save.
- Select a passage, reply: cursor and footer below the quote, nothing above
  the cite line. Repeat with no footer set, and for a plain-text message.
