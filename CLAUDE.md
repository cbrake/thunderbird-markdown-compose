# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Thunderbird MailExtension (Manifest V3, Thunderbird 151+) that lets you write
email as Markdown in the ordinary compose window and sends it as HTML. There is
no custom editor UI: the compose body holds Markdown source, and conversion
happens at two moments only — on paste, and on send.

## Commands

```sh
make          # package build/markdown-compose-<version>.xpi (version from manifest.json)
make test     # node --test
make clean    # remove build/
node --test test/render.test.js               # one file
node --test --test-name-pattern "renders lists"   # one test
```

There is no bundler, linter, or install step. Dependencies are vendored into
`vendor/` as single files; to update one, replace the file and record the
version in `vendor/VERSION`.

To try a change in Thunderbird: **Tools → Developer Tools → Debug Add-ons →
Load Temporary Add-on**, and select `manifest.json`. Reloading is manual, and a
temporary add-on is dropped on restart.

## Architecture

Seven plain scripts sharing one global scope. There are no modules and no
imports — a file uses another file's functions by name, and load order is
declared in `manifest.json` (`background.scripts` and `compose_scripts`).
**Adding a source file means adding it to `manifest.json`, and to the `vm`
context list in `test/render.test.js` if the tests need it.**

Two independent contexts:

- **Compose script** (`vendor/turndown*`, `src/paste.js`) runs inside the
  compose editor document. It has no `browser.compose` access and exists only to
  turn pasted rich text into Markdown source at the moment of the paste.
- **Background event page** (`vendor/markdown-it.min.js`, `src/style.js`,
  `src/render.js`, `src/source.js`, `src/background.js`) holds the toolbar
  button and the `compose.onBeforeSend` hook. It is an event page and may be
  restarted between events, so every listener is registered at the top level.

The preview popup (`src/preview.*`) loads the same rendering scripts as the
background page and renders the compose body without modifying it.

### The send path

`background.js` receives the compose body from `onBeforeSend` and hands it to
`segmentComposeBody()` (`source.js`), which splits the body into an ordered list
of segments that are either `{markdown}` (what you wrote) or `{html}` (what
Thunderbird generated: quoted replies, cite lines, signatures, forwards — see
`PRESERVED_SELECTOR`). Markdown segments go through `renderMarkdown()`
(`render.js`); pass-through segments are emitted verbatim; the pieces are
rejoined in document order.

Segments are why the position of your text does not matter: writing above a
quote, below it, or on both sides is the same operation on a different number of
segments. Segmenting works on the **top level** of the compose body only, so
anything nested inside a `blockquote[type=cite]` belongs to that quote.

Elements Markdown cannot express — currently images — are replaced in the
recovered source by `placeholderFor(i)`, a `{{markdown-compose-N}}` marker that
survives rendering as ordinary text, and restored afterwards by
`restorePreserved()`. Any new pass-through element should use the same
mechanism rather than a second one.

### Layering rule

`render.js` and `style.js` touch no Thunderbird APIs and no DOM, which is what
makes them testable under `node --test` with no mocking. Keep it that way:
Thunderbird APIs belong in `background.js`, and `source.js` sits between the two
because it needs a DOM (`DOMParser`), so it has no Node tests.

### Two constraints that shape the code

- **Mail clients discard `<style>` blocks**, so styling is inlined per element.
  `render.js` hooks markdown-it's `renderToken`, its `image` rule, and the few
  rules that bypass `renderToken` (`code_inline`, `code_block`, `fence`),
  writing declarations from the `MARKDOWN_STYLES` map in `style.js`. Change how
  sent mail looks by editing `style.js` alone.
- **Outlook renders mail through Word**, which honours `width`/`height`
  attributes and ignores their CSS equivalents. Image sizes therefore go in
  attributes, not in CSS (`applyImageSize()` in `render.js`, `imageHtml()` in
  `source.js`).

The editor's own HTML quirks — `<br>` for line breaks, `<div>` wrapping, and
non-breaking spaces for leading and repeated spaces — are produced by
`markdownToEditorHtml()` in `paste.js` and reversed by `nodesToText()` in
`source.js`. Changes to one usually need a matching change in the other.

## Design rules

From README.md, and worth honouring in new work:

1. **The compose window is the editor.** Anything needing custom editing UI is
   out of scope.
2. **Conversion is a pure function.** Testable logic stays free of Thunderbird.
3. **No configuration until someone needs it.** Preferences are how a small
   add-on becomes a large one.

Deferred ideas live in `IDEAS.md` with enough context to pick up later; an idea
that stays unclaimed there is evidence it was not needed. Prefer recording a
possibility there over building it speculatively.

## Design specs and plans

Design documents for planned work live in `docs/specs/`, named
`YYYY-MM-DD-<topic>-design.md`, and their implementation plans live in
`docs/plans/`, named `YYYY-MM-DD-<topic>.md`. Write the spec (and, for
non-trivial work, the plan) before implementing, and commit them alongside the
change.
