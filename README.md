# West of Scotland Walks – map prototype

This is the first prototype built from the supplied uMap backup and Walk 1 GPX file.

## Included
- 193 walk markers from the yearly layers in the uMap backup (2020: 8, 2021: 30, 2022: 36, 2023: 27, 2024: 27, 2025: 31, 2026: 34).
- Existing walk-page and Outdooractive links, plus the descriptive fields in marker popups.
- One GPX track: `walk-001.gpx`.
- Year checkboxes and a Clear route button.

## How it works
Select a walk marker. The viewer looks for a matching file named `walk-NNN.gpx` and displays it if present. For example, Walk 1 uses `gpx/walk-001.gpx`. If a GPX file has not yet been added, the marker and its links remain available and the viewer reports that no track is present.

## Publish with GitHub Pages
1. Upload all six files from this package into the root of the `walks-map` repository. They are deliberately kept together to make uploading from an iPad easier.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**, then Save.
5. Wait for GitHub Pages to publish the site. The address will be `https://ahspence53.github.io/walks-map/`.

## Adding future GPX files
Name each file using its walk number with three digits, for example `walk-002.gpx`, and upload it into the repository root alongside the other files. The marker name in the map data must include the same walk number (for example, “Walk 2”).

## Notes
- The original uMap backup and live map are not modified.
- The local-authority boundary overlay from the uMap backup is not included in this first prototype; this version focuses on the walk markers and click-to-display GPX behaviour.
- The map uses standard OpenStreetMap tiles rather than the API-key tile layer in the uMap backup.
