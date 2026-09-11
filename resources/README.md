# Film content

`journey.json` is the authoritative ordered array for the automatic film. Room
content is never embedded in the renderer. `journey.schema.json` documents the
format; the loader and preparation script validate it. Entries sort by unique
numeric `order` and must have a unique `id`.

```json
{
  "id": "11-next-chapter",
  "order": 11,
  "title": "A new chapter",
  "year": "2027",
  "place": "",
  "description": "Replace this example with a sourced milestone.",
  "metrics": [{ "label": "Published work", "value": 1, "suffix": "" }],
  "images": [],
  "video": null,
  "techStack": [],
  "links": [],
  "accent": "#ffc670",
  "empty": false,
  "sources": []
}
```

Add the entry, then run `npm run prepare:film` and reload. No render or camera code
changes. Each added room extends the runtime by 19 seconds. `npm run dev` and
`npm run build` prepare resources automatically. Deploy `public/` directly for a
buildless site, or use the existing Next static export in `out/`.

Store media in `resources/media/<id>/`; use root-relative references such as
`/resources/media/06-innovation/hexapod-patent-filing.png`. The Innovation entry is a
populated example with an image, metrics, technology and link. Remote HTTPS media
requires CORS permission for WebGL/canvas use; local media is preferred. Videos
should be silent MP4 loops. The film seeks each video from the master timestamp.
Image/video failure leaves the text readable. Only the current and adjacent rooms
retain decoded media. Keep images modest in size; GPU-compressed media is not yet
implemented.

Numeric metrics animate with their suffix. Textual metrics are supported for
rankings such as “Top 6”. `empty: true` keeps the shelves and strands but omits books
and memory content, regardless of where that room appears in the sequence. Accent
colours should stay warm and muted. All narrative captions and the only on-screen
identity line live in `film.json`.

The legacy `milestones/` JSON files and `manifest.json` pipeline are retained for
the previous interactive React components. They are not the automatic film's source
of truth. Do not edit those expecting the new film to change. Maintain provenance
in `sources`; do not invent personal milestones or inflate metrics.

## v3 scroll maze

`journey.json` now includes a `theme` field. Supported themes are `study`, `workshop`,
`arena`, `gallery`, `library`, `patent-library`, `tech-lab`, `infrastructure`, `office`,
and `empty`. Use `empty:true` for Future to suppress furnishings and all content.
Adding a room automatically adds a seeded world anchor, path leg and scroll distance.
Run `npm run prepare:film` after changing the source manifest or local media.

Content renders as selectable HTML outside the cinematic post chain. Links are
clickable. The manifest remains the only source of personal information; theme
modules contain geometry and material choices only. The root README supersedes the
automatic-film instructions above where behavior differs.
