# FreshTag 2.2 — The Edible SmartBio-Film

Website prototype for the student science project. This version combines image-based indicator color reading, reference comparison, simulated scenarios, and a separate use-suitability review panel.

## Files
- `index.html` — website structure
- `styles.css` — responsive interface
- `app.js` — image sampling, RGB/HEX, CIE76 Delta E, interpretation, and JSON report export
- `freshtag_access.html` — accessibility information page

## Run locally
Open `index.html` in a modern browser. Camera access requires HTTPS or localhost; image upload works directly in the browser.

## Deploy to the existing GitHub Pages repository
1. Extract this ZIP.
2. Open the existing repository on GitHub.
3. Choose **Add file → Upload files**.
4. Upload the contents of the `The-Edible-SmartBio-Film-main` folder (not the enclosing folder) to the repository root.
5. Allow GitHub to replace the existing `index.html`, `app.js`, `styles.css`, and `README.md`.
6. Commit changes to `main`. GitHub Pages will redeploy the same site URL; do not create a new repository.

## Scientific limitations
- RGB/HEX and CIE76 Delta E describe image color differences only.
- Default reference color and Delta E thresholds are interface/testing values, not scientifically validated limits.
- The validation selector must only be set to the validated option when the research team has independent test evidence for the same food category, tag formulation, storage conditions, and protocol.
- Even a validated color range is a screening signal, not a guarantee of food safety. This tool does not detect every pathogen or replace laboratory testing, expiry information, safe storage, or food-handling guidance.
- The demonstration scenarios are simulated and must not be presented as real food test results.

## Project status
Prototype for research and educational demonstration. Calibration and independent validation are still required before real-world use.
