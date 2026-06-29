# Video placeholder asset

The stub video provider (`src/packages/video-engine/providers/stub.ts`) returns
`/video-placeholder.mp4` as the rendered video URL when the simulated render
"completes." Drop a small MP4 here so the Hair Story Hero on the result page
can play something during development.

Suggested:
- ~5–10 second, 720p MP4, H.264, AAC audio.
- Any short clip is fine — it's the wireframe for the real doctor briefing.

When you wire in a real video provider (HeyGen / D-ID / Synthesia), the
provider returns its own CDN URL and this placeholder is no longer used.

Optional companion poster: `video-placeholder-poster.jpg`.
