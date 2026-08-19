// გადააქცევს graphify-ის graph.json-ს Obsidian vault-ად (graphify-out/wiki/).
// ერთი .md ფაილი თითოეულ საწყის ფაილზე + community-ინდექსები, ერთმანეთთან [[wikilinks]]-ით დაკავშირებული.
// გაშვება: node scripts/graphify-to-obsidian.js

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'graphify-out', 'graph.json');
const WIKI_DIR = path.join(ROOT, 'graphify-out', 'wiki');
const FILES_DIR = path.join(WIKI_DIR, 'files');
const COMMUNITIES_DIR = path.join(WIKI_DIR, 'communities');

function slug(s) {
  return s.replace(/[\\/]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function fileNoteName(sourceFile) {
  return slug(sourceFile);
}

function main() {
  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const nodes = graph.nodes;
  const links = graph.links;

  fs.rmSync(WIKI_DIR, { recursive: true, force: true });
  fs.mkdirSync(FILES_DIR, { recursive: true });
  fs.mkdirSync(COMMUNITIES_DIR, { recursive: true });

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // ფაილების ჯგუფები: source_file -> { nodes, community }
  const byFile = new Map();
  for (const n of nodes) {
    const key = n.source_file || '(unknown)';
    if (!byFile.has(key)) byFile.set(key, { nodes: [], community: n.community });
    byFile.get(key).nodes.push(n);
  }

  // ფაილებს შორის კავშირები (edge-ის source/target სხვადასხვა source_file-შია)
  const fileLinks = new Map(); // sourceFile -> Set(targetFile:relation)
  for (const l of links) {
    const s = nodeById.get(l.source);
    const t = nodeById.get(l.target);
    if (!s || !t) continue;
    const sf = s.source_file;
    const tf = t.source_file;
    if (!sf || !tf || sf === tf) continue;
    if (!fileLinks.has(sf)) fileLinks.set(sf, new Set());
    fileLinks.get(sf).add(`${tf}::${l.relation}`);
  }

  // community -> files
  const byCommunity = new Map();
  for (const [file, info] of byFile) {
    if (!byCommunity.has(info.community)) byCommunity.set(info.community, []);
    byCommunity.get(info.community).push(file);
  }

  // --- ფაილის გვერდები ---
  for (const [file, info] of byFile) {
    const note = fileNoteName(file);
    const lines = [];
    lines.push('---');
    lines.push(`community: ${info.community}`);
    lines.push(`source_file: "${file}"`);
    lines.push('---');
    lines.push('');
    lines.push(`# ${file}`);
    lines.push('');
    lines.push(`Community: [[community-${info.community}]]`);
    lines.push('');
    lines.push('## სიმბოლოები (nodes)');
    for (const n of info.nodes.sort((a, b) => a.label.localeCompare(b.label))) {
      lines.push(`- **${n.label}** (${n.file_type}${n.source_location ? `, ${n.source_location}` : ''})`);
    }
    const related = fileLinks.get(file);
    if (related && related.size) {
      lines.push('');
      lines.push('## დაკავშირებული ფაილები');
      const byTarget = new Map();
      for (const entry of related) {
        const [tf, rel] = entry.split('::');
        if (!byTarget.has(tf)) byTarget.set(tf, new Set());
        byTarget.get(tf).add(rel);
      }
      for (const [tf, rels] of [...byTarget].sort()) {
        lines.push(`- [[${fileNoteName(tf)}]] (${[...rels].join(', ')})`);
      }
    }
    fs.writeFileSync(path.join(FILES_DIR, `${note}.md`), lines.join('\n') + '\n');
  }

  // --- community გვერდები ---
  for (const [community, files] of byCommunity) {
    const lines = [];
    lines.push(`# Community ${community}`);
    lines.push('');
    lines.push(`${files.length} ფაილი:`);
    lines.push('');
    for (const f of files.sort()) {
      lines.push(`- [[${fileNoteName(f)}|${f}]]`);
    }
    fs.writeFileSync(path.join(COMMUNITIES_DIR, `community-${community}.md`), lines.join('\n') + '\n');
  }

  // --- ინდექსი ---
  const indexLines = [];
  indexLines.push('# Graphify Wiki');
  indexLines.push('');
  indexLines.push(`\`online-shop-nest\`-ის knowledge graph-ის Obsidian vault. გენერირებულია ${nodes.length} node-იდან და ${links.length} edge-იდან.`);
  indexLines.push('');
  indexLines.push('## Communities');
  for (const community of [...byCommunity.keys()].sort((a, b) => a - b)) {
    indexLines.push(`- [[community-${community}]] (${byCommunity.get(community).length} ფაილი)`);
  }
  indexLines.push('');
  indexLines.push('## ყველა ფაილი');
  for (const file of [...byFile.keys()].sort()) {
    indexLines.push(`- [[${fileNoteName(file)}|${file}]]`);
  }
  fs.writeFileSync(path.join(WIKI_DIR, 'index.md'), indexLines.join('\n') + '\n');

  console.log(`Vault დაწერილია: ${WIKI_DIR}`);
  console.log(`ფაილის გვერდები: ${byFile.size}, communities: ${byCommunity.size}`);
}

main();
