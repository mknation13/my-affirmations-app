# Groundwork

Believable, evidence-backed affirmations that adapt to you. A small, calm, mobile-first web app in plain HTML, CSS and JavaScript, with no build step, backend or account.

Live: https://mknation13.github.io/my-affirmations-app/

## What it does

- **Home**: one affirmation for the day (it stays the same all day and leans toward your focus areas), your streak, and the routine button.
- **Routine** (about a minute):
  1. How are you feeling? Good, Okay or Rough sets the tone. On a Rough day you only get gentle statements.
  2. Your evidence: up to three wins from your Evidence Bank, with ones that match your focus areas shown first.
  3. Your affirmation: pick the moment, then see a statement with a piece of your own evidence underneath. You can Save it, mark it Helpful, Hide it, or tap "This doesn't feel believable" to get a smaller, more grounded version.
  4. When you finish, you can get one optional small step related to your focus (you can turn this off), and you can save something from today as evidence.
- **Evidence Bank**: wins and moments of resilience, each with an optional category. You can filter by category, and entries are shown newest first.
- **Affirmations**: browse by moment or focus area, see what you've saved, bring back hidden statements, and write your own.
- **Settings** (gear icon on Home): focus areas (up to 3), turning the small step on or off, resetting your feedback, and exporting or importing a backup.

## How statements are chosen

There's no AI involved. A few plain rules in `engine.js` decide what you see:

- Your mood sets the tone (gentle, steady or bright).
- The moment and your focus areas narrow the list. Statements for a focus area only appear if you chose that area.
- Statements you save or mark helpful come up more often. Hidden ones never appear, and ones you marked "not believable" come up less.
- Anything you've seen recently is held back: the strongest hold is for today and yesterday, and it fades out after a week.

## Privacy and data

Everything is stored only in your browser's `localStorage`, and nothing is sent anywhere. Use **Settings › Export backup** to save a `.json` file, and **Import backup** to restore it. Importing adds to what's already there by default; replacing everything asks you first. Imported files are checked, and damaged items are skipped.

Data saved by the first version of the app (Evidence Bank, your own affirmations, streak history) carries over unchanged. A one-time copy of that original data is also kept in `ma.backup.v1`.

## Files

- `index.html`, `style.css`, `app.js`: the page and its interface code
- `content.js`: every affirmation, small step and evidence prompt, with tags
- `engine.js`: selection rules, streaks, data cleaning, migration and import/export, with no DOM code, so it can be unit tested
- `tests/`: unit tests (`node --test tests/unit/*.test.js`) and browser journeys (`node tests/e2e/journeys.js`, which needs Playwright and a local server: `python3 -m http.server 8765`)

## Rolling back

The version from before the personalization update is kept on the `v1-stable` branch. To go back, point GitHub Pages at that branch (Settings › Pages), or restore it onto `main`.

## Credits

Fonts: [Fraunces](https://github.com/undercasetype/Fraunces) and [Inter](https://github.com/rsms/inter), both under the SIL Open Font License (see `fonts/`). They're served from this repo, so nothing loads from a third party.

Wellness tool only, not therapy or medical advice.
