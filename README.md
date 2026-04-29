# Cryptarithm Studio

Cryptarithm Studio is a small iPad-friendly React app for junior Maths Olympiad students. It generates unique addition cryptarithms, checks digit substitutions, gives scaffolded hints, and lets students request a puzzle that is a bit easier, about the same, or a bit harder.

The app has no login system and no persistent student profiles. The star and streak rewards are session-only and reset on refresh.

## Local development

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
```

The static site is written to `dist/`.

## GitHub Pages deployment

1. Create a new GitHub repository, for example `cryptarithm-studio`.
2. Copy these files into the repository and push to the `main` branch.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **GitHub Actions**.
5. The included workflow at `.github/workflows/deploy.yml` will build the app and publish it to Pages on every push to `main`.

The Vite config uses `base: './'`, so it should work both as a project page such as `https://YOURNAME.github.io/cryptarithm-studio/` and as an account page repository such as `https://YOURNAME.github.io/`.

## Teaching notes

Students should be encouraged to solve from right to left, writing down carry values as they go. A good prompt after a hint is: “Why must that carry or digit be true?” That keeps the hint as a reasoning scaffold rather than a reveal button.

### Author

Conceived and designed by Simon D Angus (Economics, SoDa Labs, Monash Business School) and built with SoDa Lab's Assistant (https://assistant.sodalabs.io/). For everyone who loves cryptarithms. First edition: 29 Apr 2026.
