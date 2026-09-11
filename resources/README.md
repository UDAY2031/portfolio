# Archive content

Edit `journey.json`, then run `npm run prepare:film`. `journey.schema.json` describes the manifest. Each room’s physical `pages` carry the displayed text, metric, optional link and media. Each `layout` places a room; each `travelToNext` authors a distinct path to the next.

Media lives in `media/<room-id>/`. Project demos are silent local H.264 baseline MP4s with fast-start metadata and local poster frames. Keep source text and numbers out of render modules. The current author-approved content uses six rooms, AURIZE at 23K+ users and two publications.
