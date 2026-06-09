# Underline Context

## Product language

- **Bridge paragraph**: a short inserted paragraph that teaches the missing background frame behind a highlight.
- **Bridge explanation**: the user-facing outcome; usually implemented as a bridge paragraph.
- **Reader mode**: the extension mode that allows highlight capture and bridge insertion.
- **Demo mode**: the mock explanation path used when no real model is configured or when the upstream model fails.
- **Real model mode**: the path where the API returns an explanation from the configured upstream model.
- **Prior gap signals**: compact traces of what knowledge gaps the reader showed before.
- **Context window**: the nearby paragraphs sent with the new highlights so the model sees local article context.

## Product boundary

- Underline is not a glossary popover.
- Underline is not a full article summarizer.
- Underline should infer the missing mental model behind the confusion and insert one compact bridge.

