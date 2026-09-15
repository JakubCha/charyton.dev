// Turns a cached DEM grid into the contour sheet the site uses as its background.
//
// The elevation grid lives in data/dem-stockholm.json so builds are reproducible and
// work offline. Pass --refetch to pull it again from the OpenTopoData EU-DEM service.
//
//   node scripts/build-map.mjs [--refetch]
//
// Outputs:
//   public/map/contours.svg   drawn sheet, served as a static asset
//   public/map/dem.json       integer elevation grid, fetched lazily for the readout
//   src/data/map.json         metadata imported at build time

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEM_CACHE = path.join(root, 'data', 'dem-stockholm.json');

export const AREA = {
  name: 'Stockholms skärgård',
  source: 'EU-DEM 25 m',
  lat0: 59.10, lat1: 59.60,
  lon0: 17.70, lon1: 18.90,
};

const LEVELS = [1, 5, 10, 18, 26, 34, 44, 56];
const CONTOUR_INTERVAL = 8;
const SIMPLIFY_TOLERANCE = 0.7;   // viewBox units on a 1000-wide canvas
const MIN_PATH_LENGTH = 9;        // drop specks: they cost bytes and read as noise
const INK = { index: '#a8977a', normal: '#c6b99c' };

const W = 1000;
const H = Math.round(W * ((AREA.lat1 - AREA.lat0) * 111) / ((AREA.lon1 - AREA.lon0) * 57.3));

async function refetch(nx, ny) {
  const pts = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++)
      pts.push({
        lat: AREA.lat0 + (AREA.lat1 - AREA.lat0) * (j / (ny - 1)),
        lon: AREA.lon0 + (AREA.lon1 - AREA.lon0) * (i / (nx - 1)),
      });

  const out = [];
  for (let k = 0; k < pts.length; k += 100) {
    const chunk = pts.slice(k, k + 100);
    const url = 'https://api.opentopodata.org/v1/eudem25m?locations='
      + chunk.map(p => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|');
    let ok = false;
    for (let attempt = 0; attempt < 6 && !ok; attempt++) {
      try {
        const r = await fetch(url);
        if (r.status === 429) throw new Error('rate limited');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (!Array.isArray(j.results)) throw new Error('unexpected payload');
        out.push(...j.results.map(v => (v && v.elevation != null ? v.elevation : 0)));
        ok = true;
      } catch (e) {
        process.stderr.write(`  retry at ${k}: ${e.message}\n`);
        await new Promise(r => setTimeout(r, 8000));
      }
    }
    if (!ok) throw new Error('gave up fetching at point ' + k);
    process.stderr.write(`  ${out.length}/${pts.length}\r`);
    await new Promise(r => setTimeout(r, 1100));
  }
  const grid = [];
  for (let j = 0; j < ny; j++) grid.push(out.slice(j * nx, (j + 1) * nx));
  fs.writeFileSync(DEM_CACHE, JSON.stringify(grid));
  return grid;
}

/* ---------------- marching squares ---------------- */
function segmentsAt(grid, level, nx, ny) {
  const segs = [];
  const px = i => (i / (nx - 1)) * W;
  const py = j => H - (j / (ny - 1)) * H;            // grid runs south to north
  const lerp = (a, b, va, vb) => a + (b - a) * ((level - va) / (vb - va || 1e-9));

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v00 = grid[j][i], v10 = grid[j][i + 1], v11 = grid[j + 1][i + 1], v01 = grid[j + 1][i];
      let idx = 0;
      if (v00 > level) idx |= 1;
      if (v10 > level) idx |= 2;
      if (v11 > level) idx |= 4;
      if (v01 > level) idx |= 8;
      if (idx === 0 || idx === 15) continue;

      const x0 = px(i), x1 = px(i + 1), y0 = py(j), y1 = py(j + 1);
      const bottom = () => [lerp(x0, x1, v00, v10), y0];
      const right = () => [x1, lerp(y0, y1, v10, v11)];
      const top = () => [lerp(x0, x1, v01, v11), y1];
      const left = () => [x0, lerp(y0, y1, v00, v01)];
      const push = (a, b) => segs.push([a, b]);

      switch (idx) {
        case 1: case 14: push(left(), bottom()); break;
        case 2: case 13: push(bottom(), right()); break;
        case 3: case 12: push(left(), right()); break;
        case 4: case 11: push(right(), top()); break;
        case 5: push(left(), top()); push(bottom(), right()); break;
        case 6: case 9: push(bottom(), top()); break;
        case 7: case 8: push(left(), top()); break;
        case 10: push(left(), bottom()); push(right(), top()); break;
      }
    }
  }
  return segs;
}

function stitch(segs) {
  const key = p => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const e of [0, 1]) {
      const k = key(s[e]);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push({ i, e });
    }
  });
  const used = new Array(segs.length).fill(false);
  const lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    const pts = [];
    let cur = i, e = 0;
    while (!used[cur]) {
      used[cur] = true;
      const a = segs[cur][e], b = segs[cur][1 - e];
      if (!pts.length) pts.push(a);
      pts.push(b);
      const next = (ends.get(key(b)) || []).find(c => !used[c.i]);
      if (!next) break;
      cur = next.i; e = next.e;
    }
    if (pts.length > 2) lines.push(pts);
  }
  return lines;
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sqTol = tol * tol;
  const sqSegDist = (p0, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p0[0] - x) * dx + (p0[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; }
      else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = p0[0] - x; dy = p0[1] - y;
    return dx * dx + dy * dy;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0, index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(pts[i], pts[first], pts[last]);
      if (d > maxSq) { maxSq = d; index = i; }
    }
    if (maxSq > sqTol && index > 0) { keep[index] = 1; stack.push([first, index], [index, last]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* ---------------- run ---------------- */
const wantRefetch = process.argv.includes('--refetch');
let grid;
if (wantRefetch || !fs.existsSync(DEM_CACHE)) {
  process.stderr.write('fetching elevation grid from OpenTopoData…\n');
  grid = await refetch(96, 80);
} else {
  grid = JSON.parse(fs.readFileSync(DEM_CACHE, 'utf8'));
}

const ny = grid.length, nx = grid[0].length;
let min = Infinity, max = -Infinity;
for (const row of grid) for (const v of row) { if (v < min) min = v; if (v > max) max = v; }

let vertsBefore = 0, vertsAfter = 0, kept = 0, dropped = 0;
const groups = LEVELS.map(level => {
  const paths = stitch(segmentsAt(grid, level, nx, ny))
    .map(line => { vertsBefore += line.length; const s = simplify(line, SIMPLIFY_TOLERANCE); vertsAfter += s.length; return s; })
    .filter(line => {
      let len = 0;
      for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
      if (line.length < 4 || len < MIN_PATH_LENGTH) { dropped++; return false; }
      kept++; return true;
    })
    .map(line => 'M' + line.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L'));

  const isIndex = level === LEVELS[0];
  return `  <g stroke="${isIndex ? INK.index : INK.normal}" stroke-width="${isIndex ? 1.1 : 0.7}"`
    + ` opacity="${isIndex ? 1 : 0.72}">\n`
    + paths.map(d => `    <path d="${d}"/>`).join('\n') + '\n  </g>';
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none">\n`
  + `  <title>${AREA.name} — contours from ${AREA.source}, ${CONTOUR_INTERVAL} m interval</title>\n`
  + groups.join('\n') + '\n</svg>\n';

const intGrid = grid.map(row => row.map(v => Math.round(v)));

fs.mkdirSync(path.join(root, 'public', 'map'), { recursive: true });
fs.mkdirSync(path.join(root, 'src', 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'map', 'contours.svg'), svg);
fs.writeFileSync(path.join(root, 'public', 'map', 'dem.json'), JSON.stringify(intGrid));
fs.writeFileSync(path.join(root, 'src', 'data', 'map.json'), JSON.stringify({
  ...AREA,
  width: W, height: H, nx, ny,
  minElevation: Math.round(min), maxElevation: Math.round(max),
  contourInterval: CONTOUR_INTERVAL,
}, null, 2) + '\n');

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`map: ${nx}×${ny} samples, ${Math.round(min)}–${Math.round(max)} m`);
console.log(`map: ${kept} paths kept, ${dropped} specks dropped, ${vertsBefore}→${vertsAfter} vertices`);
console.log(`map: contours.svg ${kb(svg.length)}, dem.json ${kb(JSON.stringify(intGrid).length)}`);
