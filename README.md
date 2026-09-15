# charyton.dev

Personal site and public Claude Code plugin marketplace, in one repository.

The site is static Astro, deployed on Cloudflare Pages. The plugins are served from the
same repo, so `/plugin marketplace add` and the download links on the site always point
at the same code.

## Install the plugins

```
/plugin marketplace add jcharyton/charyton.dev
/plugin install jira-task-log@charyton
```

Single skills can also be downloaded as `.zip` from the site and unpacked into
`~/.claude/skills/`.

## Layout

```
.claude-plugin/marketplace.json   marketplace manifest — must stay at the repo root
plugins/<name>/                   one directory per plugin
data/dem-stockholm.json           cached elevation grid, so builds are reproducible
scripts/build-map.mjs             DEM  → public/map/contours.svg + dem.json
scripts/pack-skills.mjs           plugins/ → public/skills/*.zip + src/data/skills.json
src/                              Astro site
```

Nothing about a skill is written twice. The site's skill index is generated from each
plugin's own `plugin.json` and `SKILL.md`, so publishing a change is one commit.

## Develop

```bash
npm install
npm run dev
```

`npm run generate` runs on its own before `dev` and `build`. It rebuilds the contour
sheet and repacks the skill archives, both of which are gitignored — they are outputs,
not sources.

## The background map

The terrain behind the page is real: an EU-DEM 25 m elevation grid of the Stockholm
archipelago, turned into contours with marching squares at build time. The grid is cached
in `data/` so a build needs no network. To pull it again, or to move the map somewhere
else, edit `AREA` in `scripts/build-map.mjs` and run:

```bash
node scripts/build-map.mjs --refetch
```

Source: [OpenTopoData](https://www.opentopodata.org/) serving Copernicus EU-DEM v1.1.

## Writing

Posts are Markdown in `src/content/blog/`. Frontmatter is `title`, `date`, `summary` and
optional `draft`. A post with `draft: true` is excluded from the site, the index and the
feed.

## Deploy

Cloudflare Pages, with the repo connected directly:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 22 |

DNS already sits in Cloudflare, so the custom domain is one setting away.

## Licence

Plugin code is [MIT](LICENSE). Writing in `src/content/` is © Jakub Charyton, all rights
reserved.
