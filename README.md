# Personal site — Parker Sorensen

Single-page static site. One `index.html`, no framework, no build step.
Self-hosted IBM Plex (OFL) in `fonts/`, so the page has no third-party
requests and works offline.

## Running it locally

Live-reloading preview on <http://localhost:8000>:

```bash
npx --yes browser-sync start --server . --files "*.html,*.css,*.js" --port 8000 --no-open --no-notify
```

Save endpoint for the in-browser editor (separate terminal):

```bash
python3 save-server.py
```

## Editing

With both running, open <http://localhost:8000> and use the toolbar at the
bottom right.

- `⌘E` — toggle edit mode. Text on the page becomes directly editable.
- `⌘S` — save. Writes `index.html` and backs the old version up to
  `.edit-backups/` (last 40 kept, gitignored).
- Each `TK` placeholder has an `×` that clears the marker but keeps the text.

The editor does not serialise the live DOM. It re-reads `index.html` off
disk, copies the edited text into the matching elements, and writes that
back — so comments, formatting and structure survive. It only loads on
localhost, so it is inert once deployed.

Structural changes (adding entries, moving photos, layout) still happen in
the file.

## Layout

| Path | What it is |
|---|---|
| `index.html` | The whole site — markup and CSS in one file |
| `img/` | The two images the page uses (portrait, golf). Other crops and the
  originals in `photos/` are kept on disk but deliberately untracked. |
| `fonts/` | Self-hosted IBM Plex woff2 |
| `Resume/` | Résumé PDF, linked from the page |
| `edit.js`, `save-server.py` | Local authoring tools — not part of the site |

## Deploying

Published with GitHub Pages from `main`. Push to `main` and the live site
updates a minute or so later.

Only `index.html`, `img/`, `fonts/` and `Resume/` are served. `edit.js` and
`save-server.py` ship but never run in production — the editor checks the
hostname and loads only on localhost.
