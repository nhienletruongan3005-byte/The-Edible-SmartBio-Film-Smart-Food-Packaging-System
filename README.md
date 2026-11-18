# FreshTag 2.0 — The Edible SmartBio-Film

Website prototype for the student science project **The Edible SmartBio-Film**. The interface is in Vietnamese and is designed to support image-based reading of an anthocyanin indicator label.

## Features

- Responsive landing page and color-analysis workspace.
- Upload an image or use a device camera (`capture="environment"`).
- Preview with a central sampling guide.
- Extract the median RGB value from the central image region and show a color name and HEX value.
- Optional reference-image comparison using CIE76 (Delta E) as a descriptive image-color difference.
- Text description and Vietnamese speech output for accessibility.
- Export a JSON measurement report.
- All image processing runs locally in the browser; images are not uploaded to a server.

## Run locally

No build step or package installation is required. Open `index.html` in a modern browser, or use a simple static web server.

## Deploy with GitHub Pages

1. Create a GitHub repository and upload the contents of this folder (not the ZIP file itself).
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch `main`, folder `/ (root)`, then save.
5. Wait for GitHub Pages to publish the site.

The same repository can be imported into Vercel as a static site. No framework preset or build command is needed; set the output directory to `.` if prompted.

## Important scientific and safety limitations

This prototype measures and describes colors in photographs. The optional CIE76 comparison describes the difference between two sampled image colors only. Neither feature determines freshness, spoilage, microbial load, or food safety. Camera processing, illumination, reflections, label composition, and sampling position affect the result. Do not use the output to decide whether food is safe to eat.

A freshness interpretation or warning threshold must not be added until the indicator has been calibrated for each relevant food category and validated against independent laboratory measurements. The illustrative color spectrum on the page is not a validated FreshTag calibration scale.

## Files

- `index.html` — page structure and content.
- `styles.css` — responsive visual design.
- `app.js` — local image analysis, comparison, speech, and report export.
- `freshtag_access.html` — retained original accessibility prototype from the supplied archive.
