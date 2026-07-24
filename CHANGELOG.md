# Changelog

All notable changes to Markdown Compose are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The release workflow reads the section matching a pushed tag and uses it as the
release notes, so each `## [x.y.z]` heading must match a `manifest.json` version.

## [0.1.0]

- Write email as Markdown in the ordinary compose window and send it as HTML.
- Convert pasted rich text to Markdown source on paste.
- Preview the rendered message in a popup without altering the compose body.
- Preserve quoted replies, cite lines, signatures, and forwards untouched.
- Inline per-element styling and size images through attributes so the mail
  renders consistently across clients, including Outlook.
