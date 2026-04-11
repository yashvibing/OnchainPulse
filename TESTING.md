# Testing — MonFolio

## Run

```bash
npm test          # one shot
npm run test:watch # watch mode
```

Vitest runs in jsdom with `@testing-library/react`. Fast: full suite ~1.5s.

## Stack

- **Test runner**: vitest 4
- **DOM**: jsdom (via vitest config)
- **React testing**: @testing-library/react 16 + @testing-library/jest-dom (vitest matchers)

Config lives in [vitest.config.ts](vitest.config.ts). Setup file at [test/setup.ts](test/setup.ts).

## Layout

```
test/
├── setup.ts                                # global test setup
├── lib/
│   └── format.test.ts                      # pure unit tests for src/lib/format.ts
└── hooks/
    └── usePortfolio.regression-001.test.tsx # ISSUE-001 LST double-count regression
```

## Conventions

- One test file per source file, mirroring the `src/` tree under `test/`.
- Regression tests for QA-found bugs use the filename pattern `*.regression-NNN.test.{ts,tsx}` and start with a comment block:
  ```
  // Regression: ISSUE-NNN — what broke
  // Found by /qa on YYYY-MM-DD
  // Report: .gstack/qa-reports/qa-report-{domain}-{date}.md
  ```
- Mock external dependencies (RPC, DefiLlama, viem multicall) with `vi.mock`. Never hit a real network in unit tests.
- Test what code DOES, not that it exists. Avoid `expect(x).toBeDefined()` style assertions.
- React Query hooks need a `QueryClientProvider` wrapper with `retry: false` so failures surface immediately.

## When to add a test

- **New function** → add a test in the matching `test/` path.
- **New conditional (if/else, switch)** → test BOTH branches.
- **Bug fix** → add a regression test that fails on the old code and passes on the fix. Verify by temporarily reverting the fix and re-running.
- **New error handling** → add a test that triggers the error path.

The goal is 100% behavior coverage on `src/services` and `src/hooks` (the parts that contain logic). UI components are best covered via [browse](.claude/skills/gstack/browse) end-to-end (see /qa skill).

## Verifying a regression test is real

A good test fails on the bug and passes on the fix. To prove it:

```bash
# Save current code
cp src/path/to/fixed-file.ts /tmp/fixed.ts
# Replace with pre-fix version
git show <pre-fix-sha>:src/path/to/fixed-file.ts > src/path/to/fixed-file.ts
npm test  # should FAIL on the regression test
# Restore
cp /tmp/fixed.ts src/path/to/fixed-file.ts
npm test  # should PASS again
```

This was done for ISSUE-001: 3 of 4 tests fail on the pre-fix code with the expected double-count values, all 4 pass on the fix.
