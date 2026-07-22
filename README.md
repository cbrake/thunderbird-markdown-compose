# tb-markdown

Write email in Markdown in Thunderbird's normal compose window, preview the
result, and send it as HTML.

There is no separate editor, no sidebar, and no custom UI to learn. You type
Markdown into the message body the way you always type, press a button to check
how it looks, and Thunderbird sends the rendered HTML.

## Status

Early. The extension does one thing, and the goal is to keep it that way.

## Requirements

- Thunderbird 128 or later (MailExtensions, Manifest V3)
- Compose window in HTML mode. This is Thunderbird's default; if you have set
  plain text as the default for an account, hold Shift while clicking Write to
  get an HTML composition.

## Install

Development install:

1. Clone this repository.
2. In Thunderbird, open **Tools → Developer Tools → Debug Add-ons**.
3. Choose **Load Temporary Add-on** and select `manifest.json`.

The add-on is removed when Thunderbird restarts. For a permanent install, zip
the repository contents and install the `.xpi` from
**Add-ons Manager → Install Add-on From File**.

## Use

1. Open a compose window and write your message in Markdown.
2. Click **Preview** in the compose toolbar to see the rendered HTML in a popup.
   Close the popup and keep editing; your source text is untouched.
3. Send as usual. The Markdown is converted to HTML on the way out.

Nothing is converted until you send. Drafts stay as Markdown source, so you can
close a draft and pick it up later without losing the original text.

## What is supported

CommonMark plus GitHub-flavored tables, strikethrough, and autolinks, courtesy
of [markdown-it](https://github.com/markdown-it/markdown-it). That covers
headings, emphasis, lists, links, images, block quotes, fenced code blocks,
inline code, tables, and horizontal rules.

Rendered HTML is styled with a small inline stylesheet so it survives mail
clients that discard `<style>` blocks. The stylesheet lives in `src/style.js`
and is a single object of CSS declarations; edit it there if you want different
typography.

## What is not supported, and why

- **Plain text compositions.** Thunderbird does not allow an extension to switch
  a composition from plain text to HTML, so the toolbar button is disabled in
  plain-text windows.
- **Syntax highlighting in code blocks.** It would roughly triple the bundle
  size for a feature that most mail clients strip anyway.
- **Round-tripping HTML back to Markdown.** Conversion runs once, at send time,
  in one direction.
- **Quoted text, forwards, and signatures.** Everything from the first quoted
  block or signature onward is passed through unchanged and is not treated as
  Markdown. A consequence is that text typed *below* a quote is not converted.

These are deliberate omissions. Each one avoids a class of bugs that would
outweigh its value.

## How it works

The whole extension is six small files, loaded as plain scripts sharing one
global scope. There is no bundler and no module graph.

| File                | Role                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `manifest.json`     | Declares the compose action button and the `compose` permission.    |
| `src/background.js` | Registers the toolbar button and the `compose.onBeforeSend` hook.   |
| `src/source.js`     | Recovers Markdown source from the compose editor's HTML.            |
| `src/render.js`     | Markdown source in, HTML string out. No Thunderbird APIs.           |
| `src/style.js`      | The inline stylesheet, as a map of tag name to CSS declarations.    |
| `src/preview.*`     | The preview popup: two `<div>`s and a handful of lines of script.   |

The interesting part is `render.js`, and it is deliberately boring. It takes a
string and returns a string, which means it can be tested with a plain
assertion runner and no Thunderbird instance:

```sh
node --test
```

On send, `background.js` receives the compose body from `onBeforeSend`, asks
`source.js` to turn the editor's HTML back into the Markdown you typed
(unwrapping paragraphs and line breaks, and splitting off any quoted reply or
signature), hands that to `render.js`, and returns the rendered result for
Thunderbird to send.

Styling is applied during rendering rather than as a post-processing pass:
`render.js` hooks markdown-it's renderer and writes a `style` attribute onto
each token from the map in `style.js`.

## Dependencies

One: `markdown-it`, vendored into `vendor/` as a single file. It is checked into
the repository rather than pulled at build time, because there is no build step
and adding one would cost more than the file it saves.

To update it, replace `vendor/markdown-it.min.js` and record the version in
`vendor/VERSION`.

## Design notes

Three rules keep this project small:

1. **The compose window is the editor.** Every feature that would require custom
   editing UI is out of scope.
2. **Conversion is a pure function.** Anything that touches Thunderbird APIs
   stays in `background.js`, so the logic worth testing has no environment to
   mock.
   (`source.js` needs a DOM and therefore sits between the two; it is kept as
   small as the job allows.)
3. **No configuration until someone needs it.** Preferences are the most
   reliable way to turn a small add-on into a large one. If an option earns its
   place, it goes in `manifest.json` under `options_ui` and nowhere else.

## Contributing

Issues and pull requests are welcome. Small, focused changes are easiest to
review, and a change that removes code is always worth discussing.

## License

MIT. See [LICENSE](LICENSE).
