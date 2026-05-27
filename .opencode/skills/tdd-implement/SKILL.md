---
name: tdd-implement
description: >
  Implements features from issue/*.md plans following Test-Driven Development.
  Use when asked to implement, build, or code a feature described in an issue
  file under issue/, or when the user references an issue number or filename
  in the issue/ directory.
---

# tdd-implement — TDD Implementation from Issue Plans

Follow this workflow when implementing a feature described in an `issue/*.md`
plan file. The goal is to produce working, tested code using Test-Driven
Development.

## Workflow

### 1. Understand the Plan

Read the issue markdown file thoroughly. Identify:
- Files to create and modify
- Type definitions, store shapes, hook signatures
- Component props and behavior
- Edge cases documented in the plan

### 2. Read Existing Code

Before writing any new code, read the existing files that will be modified or
that the new code interacts with:
- Existing stores (for pattern consistency)
- Existing hooks and services
- Existing components (for style consistency)
- The CLAUDE.md for project conventions

### 3. Write Tests First (Red Phase)

For each unit of work (store, hook, service, component):

1. Create a corresponding `.test.ts` or `.test.tsx` file
2. Write tests that describe the expected behavior
3. Run the test suite to confirm they fail (red)

**Test coverage expectations:**
- Store: test all CRUD operations + edge cases (empty state, missing keys, etc.)
- Service (pdf-annotations): test char offset ↔ range conversion with mock data
- Hooks: test returns expected interface, calls store methods
- Components: test renders without crash, calls callbacks on interaction

### 4. Implement (Green Phase)

Write the minimal code needed to pass the tests:
- Implement types/interfaces first
- Implement the module
- Run tests to confirm they pass (green)

### 5. Verify Integrations

After each module passes in isolation:
- Run `pnpm --filter apps-foliate build` to check for type/build errors
- Run `pnpm --filter apps-foliate lint` for lint errors
- Verify the modules compose correctly (e.g., store ↔ hook ↔ component)

### 6. Iterate Per-Module

Do NOT implement everything at once. Work through the files in this order:

**Phase A — Foundation:**
1. `src/types/annotations.ts` — types, no runtime code
2. `src/store/annotation-store.ts` — store + tests

**Phase B — PDF Service:**
3. `src/services/pdf-annotations.ts` — service + tests

**Phase C — Hooks:**
4. `src/hooks/use-annotations.ts` — hook + tests
5. `src/hooks/use-annotation-creator.ts` — hook + tests

**Phase D — UI Components:**
6. `src/components/AnnotationToolbar.tsx` — component + tests
7. `src/components/AnnotationList.tsx` — component + tests
8. `src/components/AnnotationNoteDialog.tsx` — component + tests

**Phase E — Integration:**
9. Modify `src/components/ReaderView.tsx`
10. Modify `src/components/ReaderSidebar.tsx`
11. Modify `src/app/read/page.tsx`

Each phase must compile and pass lint before moving to the next.

## Conventions

- Tests live next to the source file: `src/store/annotation-store.test.ts`
- Use the project's existing test framework (check `package.json` for test script)
- Mimic existing test patterns from the codebase
- Mock `zustand` stores when testing hooks/components
- For PDF service tests, use a mock `TextContent` response with known structure
- Do NOT add comments to production code unless the plan explicitly requires it
