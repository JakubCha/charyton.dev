---
title: The lockfile that only drifted on one platform
date: 2026-09-15
summary: A conda environment that solved cleanly on Windows and quietly differently on Linux, and what it cost to find out.
draft: true
---

> This is a template post. Replace it with something you actually ran into, keep the
> frontmatter fields, and delete this blockquote. `draft: true` keeps it off the site
> until you remove the flag.

Reproducibility in geospatial work is mostly a story about dependencies. The models are
portable, the Python is portable, and then GDAL arrives with its own opinions about which
PROJ it was built against.

## What happened

Write the specific thing. The date, the dataset, the command that failed. Specifics are
the reason anyone reads a post like this rather than the documentation.

```bash
pixi run python -c "import rasterio; print(rasterio.__gdal_version__)"
```

## Why it happened

The mechanism, not the symptom. If you had to read a solver log to work it out, say what
the log actually said.

## What I changed

The fix, and the part of the fix that was a compromise. A post that only reports success
is less useful than one that admits which corner got cut.

## What I would do differently

One or two sentences. This is usually the part people remember.
