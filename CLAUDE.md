# tools

Small single-purpose HTML tools. Each tool is one folder, deployed as-is by
copying that folder to the web server. What is in the folder is what ships.

## Rules

- **Vanilla only.** HTML, CSS and JavaScript as the browser runs them. No
  frameworks, no build step, no bundling, no minification. The only
  dependency allowed in `package.json` is `@playwright/test`.
- **One folder per tool, self-contained.** A tool never imports from outside
  its own folder. No `shared/`; copy small things instead.
- **Logic and UI are separate.** Pure logic lives in ES modules that never
  touch `document`, `window` or storage. UI lives in web components
  (`class X extends HTMLElement`, light DOM, no shadow root) and plain
  classes. Logic is tested in Node; components are only tested in the
  browser, and only when the interaction is worth it.
- **Screaming architecture naming.** Name a module after the concept it
  owns (`mixing.js`, `vessels.js`, `remembered-settings.js`), a component
  file after its tag (`water-mixer.js` defines `<water-mixer>`), and a test
  after the module it tests (`mixing.test.js`). Never `utils.js`,
  `helpers.js`, `app.js` or `calc.js`. If a file is hard to name it is two
  concepts.
- **Red-green TDD for all logic.** Write the failing test first, see it
  fail for the expected reason, then write the code. See the workflow
  below.
- **Explicit imports.** `import { x } from "./mixing.js"` with the `.js`
  extension. Both Node and the browser require it.
- **Scripts load as modules.** `<script type="module" src="water-mixer.js">`.
  ES modules do not load over `file://`, so run `script/server` and open
  `http://localhost:8000/<tool>/`.

## Testing

| Layer | Files | Runner |
|---|---|---|
| Logic | `*.test.js` next to the module | `node --test` with `node:assert/strict` |
| Browser | `*.browser.spec.js` in the tool folder | Playwright, Chromium only |

`node --test` picks up every `*.test.js` in the repo, which is why browser
tests use the `.browser.spec.js` suffix and nothing else may.

Tests use `describe`/`it` and read as sentences:

```js
describe("mixing boiling water with room-temperature water", () => {
  it("needs no boiling water when the target equals room temperature", () => {
    assert.equal(boilingWaterFor({ totalMl: 500, targetC: 15, roomC: 15 }), 0);
  });
});
```

## Commands

Scripts follow GitHub's "scripts to rule them all" convention
(https://github.com/github/scripts-to-rule-them-all): every repo task is a
bash script under `script/` with a conventional name, so the commands are
the same across repos. Add a new script only for a task that does not fit
an existing name, and never add a Makefile or npm scripts in its place.

    script/bootstrap     # npm ci + Chromium; re-run if script/test complains
    script/test          # unit then browser, stops at the first red suite
    script/test unit     # node --test only
    script/test browser  # playwright test only
    script/server        # http://localhost:8000/

Run commands from the repo root. Test commands are allowlisted as whole
lines, so do not pipe or chain them.

Tool versions are pinned in `.tool-versions` (asdf). CI runs
`script/bootstrap` then `script/test` with the same pin via `actions/setup-node`.

## Change workflow

Changes are planned at the top level in conversation, then executed in
three separate subagent passes so the tests themselves get checked:

1. **Red.** One agent writes only the tests for the agreed behaviour, named
   as sentences, plus any empty module stubs needed for them to load. It
   does not write implementation.
2. **Verify red.** Run `script/test`. Every new test must fail, and fail for
   the expected reason (missing behaviour, not a typo or import error).
   Fix the tests, not the code, if they fail for the wrong reason.
3. **Green.** A second agent implements until `script/test` is green. It may
   not edit the tests; if a test is wrong it reports back instead.
4. **Verify green.** A third agent, given the original plan and not the
   implementation chat, checks that the tests cover the agreed criteria
   and that the implementation follows the rules above.

The agent briefs should contain the plan and the file paths, not the
conversation.

# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
