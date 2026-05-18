// Bundles the design-canvas + meal planner JSX sources into a single
// standalone HTML file, exactly as authored. Output lands at repo root.
//
// Run:  node scripts/build-meal-planner-html.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src  = join(root, '.design-ref', 'project');

const files = [
  'design-canvas.jsx',
  'mp-system.jsx',
  'mp-screens-plan.jsx',
  'mp-screens-cook.jsx',
  'mp-screens-family.jsx',
  'mp-canvas.jsx',
];

const inlined = files
  .map((f) => {
    const body = readFileSync(join(src, f), 'utf8');
    return `<script type="text/babel" data-source=${JSON.stringify(f)}>\n${body}\n</script>`;
  })
  .join('\n\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Weekly Mealplan · Mobile Mockups</title>
  <style>
    html, body { margin: 0; padding: 0; background: #f0eee9; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>

${inlined}
</body>
</html>
`;

writeFileSync(join(root, 'Meal Planner.html'), html, 'utf8');
console.log('wrote Meal Planner.html (' + html.length.toLocaleString() + ' bytes)');
