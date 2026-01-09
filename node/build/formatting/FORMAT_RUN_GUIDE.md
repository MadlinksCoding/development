## Purpose
The purpose of this formatter is to standardize Node.js code into a consistent format, ensuring that only actual code changes are detected when pushing to Git, rather than differences caused by inconsistent formatting.

## Formatting guide
This guide explains how to run the project's formatting tool (the local Gulp-based formatter) from Windows (PowerShell or CMD).

## Run on windows
To run on Windows, place the original file in the src folder and run format.bat. Once complete, check the build/formatted folder for the output.

## Where this lives

- Gulp configuration: `build/formatting/gulpfile.js`
- Convenience batch: `build/formatting/format.bat`
- Formatted output (default): `build/formatting/build/formatted/`

- Format a single file (path is relative to `build/formatting`):

```powershell
C:\Users\linde\Projects\Clients\Fansocial\Code\NodeApp\build\formatting\format.bat --file=src\SafeUtils.js
```

## Alternate ways to run

- Using npm (from the repo root) if you prefer not to call the batch directly:

```powershell
npm run --prefix build/formatting format
```

Note: the `format` script may not exist in `package.json`; if it doesn't, either use the batch above or add this script:

```json
"scripts": {
  "format": "gulp build"
}
```

- Directly using local gulp (useful for debugging):

```powershell
cd C:\Users\linde\Projects\Clients\Fansocial\Code\NodeApp\build\formatting
node .\node_modules\gulp\bin\gulp.js build --file=src\SafeUtils.js
```

## What the batch does

- `format.bat` changes into the `build/formatting` folder, then runs the local gulp binary (`node node_modules\gulp\bin\gulp.js build`) if available; otherwise it falls back to `npx gulp build`.
- If you call `format.bat` with no arguments, it sets an environment variable `FILE=src/**/*.js` so the gulpfile will pick up and process all `src` JS files.
- Any arguments you pass (for example `--file=...`) are forwarded to gulp unchanged.

## How the gulpfile finds files

- The gulpfile uses a small helper function that looks at CLI args (e.g. `--file=...`) and environment variables (for example `FILE`). That means you can either pass `--file=...` or let the batch set `FILE` for you.

## Verification: check formatted output

After running, the formatter writes output to `build/formatting/build/formatted/`.
```

If the directory is empty after running the formatter, the most common reasons are:

- The gulpfile's glob didn't match any source files (fix: run the batch with `--file=src\\YourFile.js` or ensure `src/` contains `.js` files).
- `npm install` was not run and a required dependency failed silently (run `npm install` and try again).

## Troubleshooting

- Problem: `Formatting completed` prints but no files appear in `build/formatted`.
  - Cause: no input files matched. Check `build/formatting/src/` contains `.js` files and try `format.bat --file=src\SafeUtils.js`.

- Problem: `Cannot find module '@babel/parser'` or similar.
  - Fix: run `npm install` in `build/formatting`.

- Problem: `Task never defined: <something>` when quoting the glob incorrectly.
  - Fix: don't quote a glob into separate argv tokens; prefer using the `FILE` env var (the batch sets it automatically) or pass a single `--file=...` token.