---
name: verify-done
description: Runs lint and tests to verify a completed task or plan has no errors. Use when a task, feature, bugfix, or full planning session is finished and the user wants to confirm everything still passes. Triggers on "done", "finished", "task complete", "verify", "check tests", or end-of-plan confirmation.
---

# Verify Done

Run at end of any task or planning session to confirm code quality and tests pass.

## Steps

1. Run lint
2. Run tests
3. Report result — block merge/complete if either fails

## Commands

```bash
npm run lint
npm run test
```

## Rules

- Run **both** commands every time, even if lint passes — never skip test.
- If lint fails: show exact errors, do NOT mark task done.
- If test fails: show failing test names and error output, do NOT mark task done.
- Only mark task done when **both** exit with code 0.
- Fix errors before declaring completion — do not just report them.

## Output format

```
Lint:  PASS / FAIL
Tests: PASS / FAIL

[If any FAIL → paste relevant error lines and fix]
```

## When to trigger

- User says "done", "finished", "complete", "ready to merge", "verify"
- End of a TodoWrite plan execution
- After implementing a feature or fixing a bug
- Before creating a commit or PR
