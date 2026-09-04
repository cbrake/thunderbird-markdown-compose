# Changelog

All notable changes to Markdown Compose are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The release workflow reads the section matching a pushed tag and uses it as the
release notes, so each `## [x.y.z]` heading must match a `manifest.json` version.

## [0.3.0]

- **Link selected text by pasting a URL over it** — select a phrase, paste a
  URL, and the phrase becomes the link text. Ctrl+Z restores the phrase, and a
  paste made with nothing selected is unchanged.

## [0.2.0]

- Add a per-message switch to send an ordinary rich-text message: clear
  **Convert this message to HTML** in the preview popup to turn conversion off
  for that compose window. Pastes then keep their formatting and the message is
  sent as written, and the toolbar button shows an "off" badge. Each new compose
  window starts with conversion on.
- Colour the compose toolbar button icon blue.

## [0.1.0]

- Write email as Markdown in the ordinary compose window and send it as HTML.
- Convert pasted rich text to Markdown source on paste.
- Preview the rendered message in a popup without altering the compose body.
- Preserve quoted replies, cite lines, signatures, and forwards untouched.
- Inline per-element styling and size images through attributes so the mail
  renders consistently across clients, including Outlook.
