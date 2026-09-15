---
name: jira-task-log
description: Uses Jira as the task backend for work done with Claude — files issues, reads the open backlog, closes finished work. Use whenever the user says "log this in Jira", "file a ticket", "add to the backlog", "what's on my plate", "close that issue", "zapisz to w Jirze", "załóż zadanie", gives an issue key (e.g. ACME-42), or settles on something during a session that is plainly work for later — even if they never say the word Jira. Runs a guided setup on first use; no configuration needed beforehand.
---

# Jira as the task backend

Jira is the single source of truth for what is outstanding and what is finished.
This skill does three things: **file** issues, **read** the open backlog, **close**
finished work. It never deletes anything and never changes project configuration.

**Language:** write issue content in whatever language the user is speaking. Keep
technical terms in their original form — do not translate "pull request", library
names, commands, or type names into the user's language.

## Before anything else

Read the configuration once per session, at the first Jira operation — not on every call:

- `~/.claude/jira-task-log/site.md` — site, `cloudId`, issue type names and IDs
- `~/.claude/jira-task-log/projects.md` — which local repo maps to which Jira project

On Windows these live under `%USERPROFILE%\.claude\jira-task-log\`.

**If `site.md` is missing or has no `cloudId`, run the setup below first.** Do not guess
a cloudId and do not ask the user to find one by hand.

## First run: guided setup

Never ask the user for an API token, password, or any credential. Authentication is
handled by the Atlassian connector; if its tools are unavailable, say so and stop —
the user needs to connect Atlassian first.

1. **Find the sites.** Call `getAccessibleAtlassianResources`. It returns every site
   the user can reach, each with its `cloudId`. One result: use it. Several: list them
   by URL and ask which one.

2. **Find the projects.** Call `getVisibleJiraProjects`. Show key and name. Ask which
   project this setup should cover. More can be added later, so do not push for a
   complete list now.

3. **Discover the issue types — do not assume them.** Call
   `getJiraProjectIssueTypesMetadata` for the chosen project and record the exact names
   and IDs. Type names are localised and differ per site: a task is `Task` on an English
   site, `Zadanie` on a Polish one, `Aufgabe` on a German one. Passing the wrong name
   fails validation. The same is true of IDs in team-managed projects, where every
   project has its own.

4. **Ask two questions about how they work:**
   - which issue type is the default for ordinary work (usually the task-level one)
   - whether epics are used as containers, or issues sit flat in the project

5. **Write the files** in the formats below, then confirm in one line and carry on with
   whatever the user originally asked for. Setup is a detour, not the point.

Re-run any step later when something no longer matches — for example when a call fails
validation because a project was reconfigured.

### Format of `site.md`

```markdown
# Jira site

- URL: `https://<site>.atlassian.net`
- cloudId: `<uuid returned by getAccessibleAtlassianResources>`
- Interface language: <language>
- Epics used as containers: yes | no

## Issue types

| Purpose | Name on this site | ID |
|---|---|---|
| epic / container | | |
| default work item | | |
| subtask | | |

## Cached IDs per project

### <KEY> — <project name>
| Element | ID |
|---|---|
| project | |
| default work item type | |
```

### Format of `projects.md`

```markdown
## <KEY> — <project name>
- What it is: [one line, enough to recognise that work belongs here]
- Paths: /home/me/projects/thing, D:\projects\thing
- Remote: git@github.com:org/repo.git
- Epics: [areas, once they exist]
```

List as many paths as are actually used — the same repo often sits in different places
on different machines, and matching is on a path fragment, not full equality.

## Choosing the project

Resolve the project key in this order and stop at the first hit:

1. The user named it ("file that under ACME").
2. The working directory or repo path matches an entry in `projects.md`.
3. `git remote get-url origin` matches an entry in `projects.md`.
4. None of the above — **ask**. Do not guess. An issue in the wrong project is worse
   than one question, because it lands in a backlog nobody reads.

If the project has no entry yet, offer to add one after the first issue is filed
successfully.

## Hierarchy

Where epics are used as containers, ordinary work is a default-type issue attached to an
epic via the `parent` field. Where they are not, issues sit directly in the project and
the rest of this section does not apply.

- List the project's open epics before filing:
  `project = KEY AND issuetype = <epic type name> AND statusCategory != Done`
- If no epic fits, **ask** whether to create one. Do not create epics on your own.
  A project should have a handful, not dozens; creating them automatically turns them
  into duplicates of ordinary issues.
- Use a subtask only when the user is breaking down a specific issue that already exists.
- Do not use story-type issues unless the user asks for one.

## Operation 1: file an issue

### Step 1 — check it is actually a task

File issues for work that has an outcome and outlives the session: a function to write,
a bug to fix, a migration, a decision to make, a document to produce.

Do not file issues for things done within the same session — a typo fixed, a file read,
a one-off shell command. Jira should show the state of the work, not a session log.
Record everything and the backlog stops meaning anything within a fortnight.

When the user explicitly says to log it, file it without applying this judgement.
Their call beats the heuristic.

### Step 2 — check for duplicates

```
project = KEY AND statusCategory != Done AND summary ~ "keywords"
```

If something with the same meaning is already open, **do not file a new one**. Offer to
comment on the existing issue and show its key and summary.

### Step 3 — compose it

`summary` — imperative, up to 80 characters, no `[Claude]` prefix and no emoji. The
label already carries that information and a prefix ruins the board's readability.

**Example 1**
Input: "we need validation of the input files, it blows up on an empty raster"
Summary: `Validate input rasters before the solver runs`

**Example 2**
Input: "and that transfer script should be able to resume an interrupted copy"
Summary: `Support resuming an interrupted transfer in the rclone GUI`

`description` — always this shape, in the user's language:

```markdown
## Context
[why this came up — 1-3 sentences]

## Scope
[what specifically gets built or changed]

## Definition of done
- [ ] [condition 1]
- [ ] [condition 2]
```

Then a trailing line recording where it came from: the machine, the working directory,
and the ISO date.

The definition of done matters. Without it, in two weeks nobody knows what was supposed
to happen, and the issue gets closed on a hunch rather than on fact.

`labels` — always `claude`, plus exactly one source label:
- `src-code` — filed from a Claude Code session
- `src-chat` — filed from a conversation in the Claude app

One JQL (`labels = claude`) then shows everything created automatically, so after a
month it is possible to judge whether this setup earns its keep.

`parent` — the epic key, where epics are in use.

### Step 4 — confirm

Give the key and the link (`https://<site>.atlassian.net/browse/<KEY>`). Do not summarise
the issue back — the user just dictated it.

## Operation 2: read the backlog

Default query for "what's on my plate":

```
assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC
```

Narrow it only when asked:

- one project: add `project = KEY`
- in progress: `statusCategory = "In Progress"`
- only work from Claude sessions: `labels = claude`
- under one epic: `parent = KEY-12`

Filter on `statusCategory`, never on status names. Names are localised and get renamed;
the three categories (`new`, `indeterminate`, `done`) are stable everywhere.

Return a terse list: key, summary, status. Do not paste descriptions.

## Operation 3: close an issue

1. Fetch the available transitions (`getTransitionsForJiraIssue`).
2. Pick the transition whose target status is in the `done` category.
3. Execute it by **ID**, never by name — names are localised and differ per project.
4. Add a comment with the outcome: what was done, where (commit, file, PR), and what was
   deliberately left out.

Close only on an explicit instruction. Do not close an issue because it looks finished to
you — that is the user's judgement, not yours.

If the work is partial, add a progress comment instead of closing.

## Failure modes worth knowing

- **Localised type names.** Sending `Task` to a site whose type is called `Zadanie`
  fails validation. Always use the names recorded during setup.
- **Team-managed projects have their own IDs.** The same type name has a different ID in
  a different project. Never carry an ID across projects; resolve it per project and
  cache it in `site.md`.
- **Stale metadata.** If a call fails with an unknown field or type, refresh the
  project's metadata and update `site.md` rather than working around the error.

## What this skill does not do

- Does not create or configure Jira projects — the user does that in the UI.
- Does not delete issues.
- Does not assign work to other people.
- Does not create epics without asking.
- Does not ask for or store credentials.
