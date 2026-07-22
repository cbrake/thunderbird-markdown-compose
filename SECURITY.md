# Security

This add-on runs inside a mail client, so it handles content written by people
you have never met. This document records what it does with that content, what
was checked, and what is known to be imperfect.

## Reporting a vulnerability

Please report privately to <cbrake@bec-systems.com> rather than in a public
issue, and allow a little time for a fix before disclosure. A report that
includes the message or clipboard content that triggers the problem is the
fastest kind to act on.

## What the add-on can reach

- **One permission: `compose`.** There are no host permissions, so the add-on
  cannot read your mail folders, your accounts, or any website.
- **No network access of its own.** Nothing in `src/` opens a connection,
  and there is no telemetry, no update check, and no remote configuration.
  Everything it needs is in the package.
- **Three dependencies**, all vendored into `vendor/` as files in the
  repository. Nothing is fetched while building; `make` only zips the tree.

## Where untrusted content enters

Two places, and they are the ones to read closely when changing this code.

1. **The clipboard**, handled by `src/paste.js`. Copying from a web page brings
   that page's HTML with it, including anything the page's author put there.
2. **The compose body**, handled by `src/source.js`. On a reply or a forward,
   the body holds the original message, which was written by the sender.

Both are parsed with `DOMParser`, which builds a document with no browsing
context: scripts in the markup never run, and no remote resource is fetched
during parsing.

## What was checked

Confirmed by running the relevant strings through `renderMarkdown()`:

- **Raw HTML in Markdown source is escaped, not passed through.** markdown-it
  runs with `html: false`, so `<img src=x onerror=...>` and `<script>` in the
  source arrive at the recipient as visible text. This is also covered by a
  test in `test/render.test.js`.
- **Scripting URLs in links and images are refused.** markdown-it's link
  validation rejects `javascript:`, `vbscript:`, `file:`, and `data:` other
  than a few image types, in any mix of case; the link renders as plain text
  instead. `data:image/svg+xml` is among the refused ones, which matters
  because SVG can carry script.
- **Attribute values are escaped.** An image title crafted to close its own
  attribute, such as `"400x\" onerror=alert(1)"`, is emitted as escaped text
  inside `title`.
- **Quoted messages are shown in a sandboxed frame.** The preview popup can
  reach the `browser.*` APIs, so markup that is passed through untouched goes
  into an iframe with `sandbox=""` and a policy of
  `default-src 'none'; img-src data:; style-src 'unsafe-inline'`. A tracking
  pixel in a message you are replying to cannot report that you opened the
  preview, and script in it has nowhere to run.

## Known limitations

Recorded rather than fixed, because each is a trade or waiting for a reason to
act.

- **Remote images in a rendered segment load when you preview.** The sandboxed
  frame above covers quoted markup, but a Markdown segment is rendered into the
  popup document itself, where the extension page's default policy allows
  images from anywhere. For images you wrote into your own message this is the
  point of a preview. It matters when the segment is not really yours, as with
  a forwarded message you are editing, where a remote image belongs to whoever
  sent it. Restricting `img-src` for the popup would close this, at the cost of
  showing your own remote images as broken until the message is sent.
- **Preserved elements are restored by a text marker.** Elements Markdown
  cannot express are set aside during conversion and put back afterwards, at a
  `{{markdown-compose-N}}` marker in the source. Typing that marker yourself
  moves one of your images to where you typed it. It is your own content on
  both sides, so the effect is a surprising message rather than a disclosure,
  but text you did not write can reach a Markdown segment when you edit a
  forwarded message.
- **An image's attributes are carried across as they stand.** `imageHtml()` in
  `src/source.js` clones the element, so an inline event handler on an image
  already in the compose body stays on it. Extension pages forbid inline
  handlers, so it cannot run in the preview, and mail clients strip them on
  display. Stripping event handler attributes during the clone would remove the
  reliance on those two defenses.
- **Dependency integrity rests on review at the time of vendoring.**
  `vendor/VERSION` records each library's version and the URL it came from, but
  no checksum, so an update is verified by reading the diff rather than by a
  tool. Recording a SHA-256 alongside the version would make that mechanical.

## Behavior on failure

Conversion is a filter in front of sending, and it declines rather than guesses.
A plain text composition and a body holding no Markdown segments are both
returned to Thunderbird untouched, so the message that goes out is the one you
wrote. The design keeps a conversion problem visible in what the recipient
receives rather than turning it into a silent change of content.
