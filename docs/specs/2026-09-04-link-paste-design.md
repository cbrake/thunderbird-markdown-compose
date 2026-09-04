# Wrap a selection in a link when a URL is pasted

## Problem

Turning a phrase into a link is a two-step edit today. You type or paste the
URL, then go back and put the brackets and parentheses around the right words,
and the text you wanted to link is usually already sitting on screen, selected,
at the moment the URL reaches the clipboard.

Every rich-text editor treats that gesture as one action: select some text,
paste a URL, and the selection becomes the link. The compose window holds
Markdown source rather than rich text, so nothing supplies it here.

Note that this is not about whether URLs become links at all. `renderMarkdown()`
runs markdown-it with `linkify: true`, so a bare URL in the source is already a
link in the sent message. What is missing is the ability to give that link its
text.

## Goal

When text is selected in the compose window and the clipboard holds a URL,
pasting replaces the selection with `[selected text](url)`.

Everything else about pasting stays as it is.

## Scope decisions

- **The existing paste listener handles it.** `src/paste.js` already sees every
  paste in the compose editor, and the compose window remains the editor. No new
  UI, no new permission, no configuration.
- **The clipboard's plain text decides.** The rule is that the `text/plain`
  flavour, trimmed, is a single URL. This is what a browser's "Copy Link" puts
  on the clipboard, and it is a rule an author can predict without knowing what
  else the source page attached.
- **The new branch runs before the Turndown branch.** Copying a link from a
  browser puts both flavours on the clipboard: the URL as `text/plain` and an
  `<a>` element as `text/html`. Today the HTML flavour wins and inserts
  `[page title](url)`, discarding the selection. With a selection present, the
  link-wrap branch has to be reached first.
- **Declining is the safe outcome.** Every case the rules do not clearly cover
  falls through to the behavior the add-on has today.

## Behavior

Given a selection of `the docs` and a clipboard holding
`https://example.com/docs`, pasting produces:

    See [the docs](https://example.com/docs).

The insertion goes through `document.execCommand("insertHTML", …)`, which
replaces the selection and keeps the paste on the editor's undo stack, so Ctrl+Z
restores the selected text exactly as the editor does for any other paste.

A window with conversion switched off is unaffected: the `if (!active) return;`
guard at the top of the paste listener already precedes everything.

### What counts as a URL

The trimmed `text/plain` flavour matches `^(?:https?:\/\/|mailto:)\S+$`.

The scheme is required. Accepting a bare `example.com` would mean an ordinary
word paste occasionally rewrites the selection into a link, which is a worse
failure than declining to help, because it is silent and needs undoing.

Internal whitespace disqualifies a paste as well, so a sentence that happens to
contain a URL takes the ordinary path.

### When it declines

The paste falls through to the existing behavior when:

- the selection is collapsed, so there is no text to link;
- the selection trims to nothing, as when only whitespace is selected;
- the selection contains a line break, since wrapping a paragraph in link syntax
  is rarely the intent;
- the selection already contains `](`, meaning a link is being replaced rather
  than created;
- the URL contains `<` or `>`, which neither link form can carry unescaped.

### Escaping

- `[` and `]` in the selected text are backslash-escaped, so a selection with
  unbalanced brackets still produces a link rather than broken output.
- A URL containing `(` or `)` is emitted in angle-bracket form, `[text](<url>)`,
  which markdown-it accepts and which unbalanced parentheses would otherwise
  break. Wikipedia article URLs are the common case.
- Leading and trailing whitespace inside the selection is moved outside the
  link, so a double-click that picked up a trailing space still gives a link
  whose text ends at the word.

## The pure part

The two decisions above are string in, string out, so they go in a new
`src/link.js` alongside `render.js` and `style.js` in the layer that touches no
Thunderbird API and no DOM:

- `pastedUrl(clipboardText)` returns the URL, or `""` when the clipboard is not
  a lone URL.
- `linkMarkdown(selectedText, url)` returns the Markdown link, or `""` when one
  of the decline rules applies.

`paste.js` then reads as a guard clause:

```js
const url = pastedUrl(event.clipboardData?.getData("text/plain") ?? "");
const link = url && linkMarkdown(window.getSelection()?.toString() ?? "", url);
if (link) {
  event.preventDefault();
  document.execCommand("insertHTML", false, markdownToEditorHtml(link));
  return;
}
```

Keeping the rules out of `paste.js` is what makes the interesting cases —
`mailto:`, parentheses in a URL, brackets in the selection — testable under
`node --test`. `paste.js` itself stays untestable in Node, as it is today,
because it needs the compose DOM and the Turndown globals.

## Files touched

- `src/link.js` — new; the two pure functions.
- `src/paste.js` — the branch above, added ahead of the existing HTML handling.
- `manifest.json` — `src/link.js` in `compose_scripts`, before `src/paste.js`.
- `test/link.test.js` — new; loads `src/link.js` into a `vm` context the way
  `test/render.test.js` loads the renderer.
- `README.md` — a paragraph in "Pasting rich text".
- `CHANGELOG.md` — an entry under the next version.

`src/render.js`, `src/style.js`, `src/source.js`, `src/background.js`, and the
preview are untouched. The compose body gains ordinary Markdown source, and the
send path has always known how to render a link.

## Edge cases

- **Nothing selected.** Unchanged: a bare URL has no formatting for the HTML
  branch to convert, so Thunderbird's plain-text paste inserts it, and `linkify`
  makes it a link when the message is sent.
- **A selection that is itself a URL.** `[https://a.example](https://b.example)`
  is what was asked for, so it is what is produced.
- **Selected text containing Markdown**, such as `**bold**`, is carried into the
  link text and renders inside the link.
- **A URL copied from the compose window itself.** The rules do not distinguish
  where the clipboard came from, and the result is the same link either way.
- **Plain-text compositions.** The compose script is only injected into HTML
  compose windows, so there is nothing to consider.

## Testing

`node --test` covers `src/link.js`:

- a plain `https://` URL, a `mailto:` address, and a URL with a trailing slash
  are recognised; a bare domain, a sentence containing a URL, and empty text are
  not;
- brackets in the selection are escaped;
- a URL with parentheses uses the angle-bracket form;
- surrounding whitespace in the selection moves outside the link;
- each decline rule returns `""`.

The rest is verified by hand in Thunderbird:

1. Load the temporary add-on and open a compose window.
2. Select a phrase, copy a URL from a browser with "Copy Link", and paste.
   Confirm the phrase becomes `[phrase](url)`.
3. Press Ctrl+Z. Confirm the original phrase returns.
4. Copy a link by selecting it on a page rather than through "Copy Link", so the
   plain text is the link's visible text. Confirm the existing conversion still
   runs.
5. With nothing selected, paste a URL. Confirm it inserts as before.
6. Switch conversion off for the window and repeat step 2. Confirm the paste is
   left alone.
7. Send a message containing a wrapped link and confirm the received mail.

## Out of scope

- **Fetching a page title** to name a link pasted with no selection. It needs a
  network request and a host permission, and the author usually has better words
  for the link than the page's own title.
- **Linkifying URLs found inside a longer paste.** The whole clipboard is either
  a URL or it is not.
- **A keyboard shortcut** for the same operation. The paste gesture is the one
  people already have.
