// გაეშვება ავტომატურად yarn start / start:dev / start:debug-ის წინ (იხ. package.json-ის "pre*" script-ები).
// 1) ატრიალებს graphify-ის extraction-ს (graph.json-ს განაახლებს ბოლო კოდის ცვლილებებზე)
// 2) ხელახლა აგენერირებს Obsidian wiki-ს (graphify-out/wiki/) graphify-to-obsidian.js-ით
//
// წარუმატებლობა აქ არასდროს უნდა ჩერდებოდეს `yarn start`-ს — მხოლოდ warning-ს წერს და აგრძელებს.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'graphify-out', 'graph.json');

function run(cmd, args, useShell) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: !!useShell });
  return result.status === 0;
}

// PATH-ზე ხელმისაწვდომი "graphify" ჯერ ვცადოთ, თუ ვერ ვიპოვეთ — uv tool-ის ცნობილ ლოკაციაზე დავეცადოთ.
const FALLBACK_GRAPHIFY = path.join(
  process.env.USERPROFILE || '',
  'AppData',
  'Roaming',
  'uv',
  'tools',
  'graphifyy',
  'Scripts',
  'graphify.exe',
);

let graphifyOk = run('graphify', ['update', '.'], process.platform === 'win32');
if (!graphifyOk && fs.existsSync(FALLBACK_GRAPHIFY)) {
  graphifyOk = run(FALLBACK_GRAPHIFY, ['update', '.']);
}
if (!graphifyOk) {
  console.warn('[graphify] "graphify update ." ვერ გაეშვა (PATH-ზე არაა, ან შეცდომა დაფიქსირდა) — vault ძველი graph.json-იდან აიგება.');
}

if (fs.existsSync(GRAPH_PATH)) {
  run(process.execPath, [path.join(__dirname, 'graphify-to-obsidian.js')]);
} else {
  console.warn('[graphify] graphify-out/graph.json ვერ მოიძებნა — Obsidian wiki არ განახლდა.');
}
