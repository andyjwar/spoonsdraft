# Team logos

**I can’t upload files for you** — copy your images into this folder on your machine.

## Option A — name by FPL entry id (simplest)

1. List each team’s **`id`** (not `entry_id`):

   ```bash
   cd /path/to/TCLOT
   python3 -c "import json;d=json.load(open('data/details.json'));[print(e['id'], e['entry_name']) for e in d['league_entries']]"
   ```

2. Save each image as **`{id}.png`** in this folder (e.g. `26587.png`).  
   Also supported: `.jpg`, `.jpeg`, `.webp` (tried in that order if `.png` is missing).

## Option B — your own filenames

1. Copy all images here (any names, e.g. `hanson.png`).
2. Create **`manifest.json`** in this folder:

   ```json
   {
     "26587": "hanson.png",
     "26675": "meat-loaf.webp"
   }
   ```

   Keys are the same **`id`** values from step A; values are filenames in this folder.

3. Restart / refresh the dev server.

Logos are circular on the site (`object-fit: cover`).

**Sharp display:** `npm run dev` / `npm run build` auto-generates **`web/public/team-logos-web/{id}.png`** (192×192) from your uploads so the site isn’t shrinking huge phone photos in the browser (that looks blurry). Re-run dev after adding or changing a logo.

## GitHub Pages (live site)

Logos stay **only on your machine** until you **commit and push** them:

```bash
cd /path/to/TCLOT
git add web/public/team-logos/
git commit -m "Team logos"
git push
```

GitHub Actions rebuilds **`team-logos-web`** from those files on deploy. Include **`manifest.json`** here if you use custom filenames (Option B).
