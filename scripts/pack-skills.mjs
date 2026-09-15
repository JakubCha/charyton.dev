// Reads every plugin in plugins/, zips it for download, and writes the index the site
// renders. The plugin manifests are the single source of truth: nothing about a skill
// is typed twice.
//
// Outputs:
//   public/skills/<name>.zip
//   src/data/skills.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginsDir = path.join(root, 'plugins');
const outDir = path.join(root, 'public', 'skills');
const marketplace = JSON.parse(
  fs.readFileSync(path.join(root, '.claude-plugin', 'marketplace.json'), 'utf8')
);

/** Pull the YAML-ish frontmatter off a SKILL.md without adding a parser dependency. */
function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function zip(srcDir, destFile, prefix) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(srcDir, prefix);
    archive.finalize();
  });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });

const entries = [];

for (const listed of marketplace.plugins) {
  const dir = path.resolve(root, listed.source);
  const manifestPath = path.join(dir, '.claude-plugin', 'plugin.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`marketplace lists ${listed.name} but ${manifestPath} is missing`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const skillsDir = path.join(dir, 'skills');
  const skills = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter(n => fs.existsSync(path.join(skillsDir, n, 'SKILL.md')))
    : [];

  // The skill's own description is what Claude matches on, so it is the honest summary
  // to show; fall back to the manifest when a plugin ships no skill.
  const primary = skills.length ? frontmatter(path.join(skillsDir, skills[0], 'SKILL.md')) : {};

  const zipName = `${manifest.name}.zip`;
  const bytes = await zip(dir, path.join(outDir, zipName), manifest.name);
  const fileCount = walk(dir).length;

  entries.push({
    name: manifest.name,
    version: manifest.version ?? '0.0.0',
    license: manifest.license ?? null,
    description: manifest.description ?? listed.description ?? '',
    skillDescription: primary.description ?? null,
    keywords: manifest.keywords ?? [],
    skills,
    files: fileCount,
    zip: `/skills/${zipName}`,
    zipBytes: bytes,
    install: `/plugin install ${manifest.name}@${marketplace.name}`,
  });

  console.log(`skill: ${manifest.name} v${manifest.version} — ${fileCount} files, ${(bytes / 1024).toFixed(0)} KB`);
}

if (!entries.length) throw new Error('no plugins found — the skills section would be empty');

fs.writeFileSync(
  path.join(root, 'src', 'data', 'skills.json'),
  JSON.stringify({ marketplace: marketplace.name, entries }, null, 2) + '\n'
);
