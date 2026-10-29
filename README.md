<img src="icons/markdown-compose.svg" alt="" width="64">

# Markdown Compose

Write email in Markdown in Thunderbird's normal compose window, preview the
result, and send it as HTML.

There is no separate editor, no sidebar, and no custom UI to learn. You type
Markdown into the message body the way you always type, press a button to check
how it looks, and Thunderbird sends the rendered HTML.

_Disclaimer: This plugin was written with Claude Code._

## Features

- **Write in Markdown, send HTML.** The compose body holds Markdown source and
  is converted when you send. Drafts stay as Markdown.
- **Preview** the rendered message in a popup without changing what you wrote.
- **Paste rich text as Markdown.** Tables, links, lists, and headings from a web
  page arrive as editable Markdown source.
- **Link selected text** by pasting a URL over it.
- **Markdown footer** placed above the quoted thread on new messages, replies,
  and forwards.
- **Top or bottom posting**, chosen per reply by whether you select a passage
  first.
- **Quotes, forwards, and signatures pass through unchanged**, wherever you
  write around them.
- **Styled for real mail clients**, with inline styles and Outlook-friendly
  image sizes.
- **Per-message off switch** to send ordinary rich text instead.

## Requirements

- Thunderbird 151 or later (MailExtensions, Manifest V3). The floor is set by
  the `compose_scripts` manifest key, which paste handling uses.
- Compose window in HTML mode. This is Thunderbird's default; if you have set
  plain text as the default for an account, hold Shift while clicking Write to
  get an HTML composition.

## Install

1. Download the `.xpi` from the
   [latest release](https://github.com/cbrake/thunderbird-markdown-compose/releases/latest).
2. In Thunderbird, open **Add-ons Manager** (**Tools → Add-ons and Themes**).
3. Click the gear icon and choose **Install Add-on From File**, then select the
   downloaded `.xpi`.

### Development install

To run from a checkout instead:

1. Clone this repository.
2. In Thunderbird, open **Tools → Developer Tools → Debug Add-ons**.
3. Choose **Load Temporary Add-on** and select `manifest.json`.

The add-on is removed when Thunderbird restarts. To build the same package the
releases ship:

```sh
make
```

That writes `build/markdown-compose-<version>.xpi`, which installs the same way
as a downloaded release. The `.xpi` is an ordinary zip of the repository files;
`make` only packages them, and `make clean` removes the build directory.

## Use

1. Open a compose window and write your message in Markdown.
2. Click **Preview** in the compose toolbar to see the rendered HTML in a popup.
   Close the popup and keep editing; your source text is untouched. On a reply,
   quoted messages and your signature appear in place, so the preview reads in
   the order the message will.
3. Send as usual. The Markdown is converted to HTML on the way out.

To send an ordinary rich-text message instead, open the preview popup and clear
**Convert this message to HTML**. That switches the add-on off for this compose
window: pastes keep their formatting and the message is sent exactly as written.
The toolbar button shows an "off" badge while a window is switched off. Turn it
off before pasting — a paste made while conversion is on is already turned into
Markdown source and cannot be reversed by switching off afterward.

Your message body is not converted until you send. Drafts stay as Markdown
source, so you can close a draft and pick it up later without losing the
original text.

## Pasting rich text

Paste a formatted table, a link, or a styled article from a web page, and it
arrives in the compose window as Markdown source rather than as styled HTML:

    ## Q3 results

    | Item | Qty |
    | --- | --- |
    | bolt | 4 |

    See [the docs](https://example.com/docs).

The conversion happens at the moment you paste, so what you see is what will be
sent, and you can edit the result like anything else you typed. Links keep their
URLs, images keep their sources, and headings, lists, tables, emphasis, and code
blocks keep their structure. Presentation that Markdown cannot express, such as
colors and font choices, is dropped.

An image pasted as raw clipboard data, such as a screenshot, has no HTML around
it and so arrives as an ordinary embedded image. Markdown has nowhere to put the
attachment that Thunderbird builds from it, so the element is set aside during
conversion and dropped back into the rendered output in the same position. You
keep seeing the image in the compose window, and it is embedded in the sent
message as usual.

A paste that carries no formatting is left to Thunderbird's ordinary plain text
paste. That keeps copying a passage from one part of your own message to another
from being escaped on the way through.

## Linking selected text

Select a phrase, paste a URL over it, and the phrase becomes the link text:

    See [the docs](https://example.com/docs).

Ctrl+Z puts the phrase back, as it does for any other paste.

The clipboard has to hold the URL and nothing else, which is what a browser's
"Copy Link" gives you. A paste made with nothing selected is left alone, and so
is one where the URL sits inside a longer passage. A bare URL needs no help in
any case: it arrives as a link in the sent message whether or not it is written
as one.

## Footer

To start each message with a footer, open **Tools → Add-ons and Themes**,
choose **Markdown Compose**, and open its **Preferences**. Write the footer in
Markdown; it saves as you type, and an empty footer means none.

When you open a new message, reply, or forward, the footer is placed in the body
as Markdown source, below where you write and above the quoted message, so a
reader sees it before the earlier thread. On a new message it goes at the end.
It is ordinary text from then on: edit it or delete it for that message as you
like. A reopened draft keeps whatever footer it was saved with.

## Top and bottom posting

Both styles work, and you choose per reply:

- **Top posting:** reply to the whole message. The cursor starts at the top,
  and the footer sits below your text and above the quoted thread.
- **Bottom posting:** select the passage you are answering, then reply.
  Thunderbird quotes only that passage, and the cursor and footer start below
  it, so your answer reads after the lines it responds to.

The layout is only a starting point. Text you write above a quote, below it, or
on both sides is converted the same way when you send.

Thunderbird's own signature stays where your account settings put it. To use
the footer in its place, clear the signature in **Account Settings**.

## Image sizes

An image is held to 600 pixels wide, and shrinks further on a window narrower
than that. Images already smaller are left as they are.

To choose a size yourself, give the image a title of its dimensions:

    ![A device label](https://example.com/label.png "400x")

The width alone is usually what you want, since the height then follows the
aspect ratio. `"400x260"` sets both, and `"x260"` sets the height alone. A title
that is anything else stays an ordinary tooltip.

Markdown has no syntax of its own for this. The title is used because it is the
only slot the parser already offers: the `=400x` convention stops markdown-it
recognising the image at all, and Pandoc's `{width=400}` is left behind as stray
text. Both would mean a parser extension for a feature this size.

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
- **Editing existing HTML mail as Markdown.** HTML becomes Markdown only when
  you paste it. The message body itself is converted once, at send time, in one
  direction.
- **Presentation without semantics.** Colors, fonts, and alignment in pasted
  content are discarded, because Markdown has no way to say them.
- **Quoted text, forwards, and signatures.** Quoted blocks and signatures are
  passed through unchanged and are not treated as Markdown. Text you write
  around them is converted, whether it sits above, below, or on both sides.

These are deliberate omissions. Each one avoids a class of bugs that would
outweigh its value.

## How it works

The whole extension is ten small files, loaded as plain scripts sharing one
global scope. There is no bundler and no module graph.

| File                | Role                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `manifest.json`     | Declares the toolbar button, options page, and permissions.       |
| `src/background.js` | Registers the toolbar button and the `compose.onBeforeSend` hook. |
| `src/paste.js`      | Converts pasted rich text to Markdown, inside the compose editor. |
| `src/source.js`     | Recovers Markdown source from the compose editor's HTML.          |
| `src/link.js`       | Wraps a selection in a link when a URL is pasted.                 |
| `src/footer.js`     | Places the footer and cursor when a compose window opens.         |
| `src/render.js`     | Markdown source in, HTML string out. No Thunderbird APIs.         |
| `src/style.js`      | The inline stylesheet, plus the image width cap. No logic.        |
| `src/preview.*`     | The preview popup, including the sandboxed quoted-message frame.  |
| `src/options.*`     | The options page, where the footer is written.                    |

The interesting part is `render.js`, and it is deliberately boring. It takes a
string and returns a string, which means it can be tested with a plain assertion
runner and no Thunderbird instance:

```sh
node --test
```

On send, `background.js` receives the compose body from `onBeforeSend` and asks
`source.js` to break it into segments. Each segment is either Markdown you
wrote, recovered from the editor's HTML by unwrapping paragraphs and line
breaks, or generated markup to pass through, such as a quoted reply or a
signature. The Markdown segments go through `render.js`, the rest are left
alone, and the pieces are reassembled in order for Thunderbird to send.

Segments are what make the position of your text irrelevant: writing above a
quote, below it, or on both sides is the same operation applied to a different
number of segments.

Styling is applied during rendering rather than as a post-processing pass:
`render.js` hooks markdown-it's renderer and writes a `style` attribute onto
each token from the map in `style.js`.

## Dependencies

Three, all vendored into `vendor/` as single files and checked into the
repository rather than fetched during packaging. Packaging is a zip and nothing
more, and a dependency step would cost more than the files it saves.

| Library                                                                  | Used by     |
| ------------------------------------------------------------------------ | ----------- |
| [markdown-it](https://github.com/markdown-it/markdown-it)                | `render.js` |
| [turndown](https://github.com/mixmark-io/turndown)                       | `paste.js`  |
| [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) | `paste.js`  |

To update one, replace the file and record the version in `vendor/VERSION`.

## Design notes

Three rules keep this project small:

1. **The compose window is the editor.** Every feature that would require custom
   editing UI is out of scope.
2. **Conversion is a pure function.** Anything that touches Thunderbird APIs
   stays in `background.js`, so the logic worth testing has no environment to
   mock. (`source.js` needs a DOM and therefore sits between the two; it is kept
   as small as the job allows.)
3. **No configuration until someone needs it.** Preferences are the most
   reliable way to turn a small add-on into a large one. If an option earns its
   place, it goes in `manifest.json` under `options_ui` and nowhere else.

## Security

The add-on holds two permissions, `compose` and `storage` (for the footer),
makes no network connections of its own, and treats pasted clipboard HTML and
quoted messages as content someone else wrote. [SECURITY.md](SECURITY.md) records how that content is handled, what
was checked, and the limitations that are known.

## Contributing

Issues and pull requests are welcome. Small, focused changes are easiest to
review, and a change that removes code is always worth discussing.

## License

MIT. See [LICENSE](LICENSE).
