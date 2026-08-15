# Plan: PWA Live Workout and Rest Alerts

**Generated**: 2026-07-27  
**Estimated Complexity**: High  
**Estimated Effort**: 25–35 engineer-days, plus a 7-day staging delivery-observation window

## Overview

Core work:

1. Add tests and prove the current PWA can load custom service-worker code.
2. Expand the database into the frozen-plan, explicit-state model.
3. Put all workout changes through one guarded command service.
4. Replace the desktop-style session page with the mobile checklist and foreground timers.
5. Add durable IndexedDB state, ordered offline sync, and controller recovery.

Delivery work:

1. Add Web Push readiness, QStash rest jobs, direct VAPID delivery, and delivery telemetry.
2. Update history and analytics.
3. Run physical-device checks and contract the legacy schema.

Keep Vercel and Supabase. QStash only triggers delayed callbacks. Supabase remains the source of truth. Do not edit generated `public/sw.js`; add push handlers through `next-pwa`'s custom worker input.

## Source Documents

Internal:

- Product language and settled behavior: `CONTEXT.md`
- Architecture decisions: `docs/adr/0001-*.md` through `docs/adr/0010-*.md`

Push and PWA:

- iPhone PWA push requirements: [WebKit Web Push for iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- Browser subscription contract: [MDN PushManager.subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)
- Server Web Push transport: [web-push](https://github.com/web-push-libs/web-push)
- Current service-worker extension point: [next-pwa custom worker](https://github.com/shadowwalker/next-pwa#available-options)

QStash:

- QStash delayed publish: [Upstash TypeScript publish](https://upstash.com/docs/qstash/sdks/ts/examples/publish)
- QStash callback verification: [Upstash signature verification](https://upstash.com/docs/qstash/howto/signature)
- QStash retry deduplication: [Upstash deduplication](https://upstash.com/docs/qstash/features/deduplication)

## Prerequisites

- A Supabase staging database and a separate `TEST_DATABASE_URL`.
- A Vercel preview deployment with HTTPS.
- An Upstash QStash account and signing keys.
- One stable VAPID key pair and a `mailto:` or HTTPS VAPID subject.
- A physical iPhone on iOS 16.4 or newer and an Android Chrome device for final push checks.

## Planned Dependencies

Production:

- `@upstash/qstash` for delayed jobs and signed callback checks.
- `web-push` plus its TypeScript types for standards-based VAPID delivery.
- `idb` for the small, typed IndexedDB snapshot, outbox, device ID, and recovery-archive store.

Development:

- `vitest`, `happy-dom`, `@testing-library/react`, `@testing-library/user-event`, and `@testing-library/jest-dom`.
- `fake-indexeddb` for offline-store tests.
- `@playwright/test` for desktop/mobile browser flows. Physical iOS Web Push remains a manual staging check.

## Sprint 0: Safety Net and PWA Feasibility

**Goal**: Establish repeatable checks and prove that Next.js 15 plus the current `next-pwa` version can compile and run custom push handlers.

**Demo/Validation**:

- `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- A preview build registers the generated worker and logs a test message from custom worker code.
- Authenticated `/api` data is not served from a stale service-worker cache.

### Task 0.1: Add the test toolchain

- **Location**: `package.json`, `package-lock.json`, `vitest.config.ts`, `src/test/setup.ts`
- **Description**: Add unit/component test scripts, TypeScript checking, and a real ESLint script. Keep integration and browser tests as separate commands.
- **Dependencies**: None
- **Acceptance Criteria**:
  - Scripts exist for `test`, `test:watch`, `test:integration`, `test:e2e`, `typecheck`, and `lint`.
  - A one-line unit test, a DOM test, and a build all run in CI mode.
- **Validation**: `npm run test && npm run typecheck && npm run lint && npm run build`

### Task 0.2: Make server code injectable in tests

- **Location**: `src/server/api/trpc.ts`, `src/test/server-context.ts`, `src/test/db.ts`
- **Description**: Export a context factory that accepts a database instance and authenticated user. Add helpers that target `TEST_DATABASE_URL`; never point tests at the main database.
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - Router tests can call procedures without mocking the global database module.
  - Test setup refuses to start if `TEST_DATABASE_URL` equals `DATABASE_URL`.
- **Validation**: Add and run one protected-procedure integration test.

### Task 0.3: Repair install assets and add a custom service-worker entry

- **Location**: `worker/index.ts`, `next.config.ts`, `public/manifest.json`, `public/icons/*.png`
- **Description**: Replace the current `.png` files, which contain HTML rather than image data. Use `next-pwa`'s custom worker directory, add a stable manifest `id`, and prove a typed event handler is bundled into generated `public/sw.js`.
- **Dependencies**: Task 0.1
- **Acceptance Criteria**:
  - `worker/index.ts` compiles into the generated worker.
  - `public/sw.js` stays generated and unedited.
  - The manifest remains `display: "standalone"`.
  - Every declared icon passes file-type and exact-size checks.
- **Validation**: `file public/icons/*.png`; automated image-dimension test; `npm run build`; inspect the built worker; install the preview PWA and confirm standalone launch.

### Task 0.4: Stop caching authenticated API responses

- **Location**: `next.config.ts`
- **Description**: Change `/api/**` and tRPC traffic to `NetworkOnly`. Offline workout state will come from IndexedDB, not cached authenticated HTTP responses.
- **Dependencies**: Task 0.3
- **Acceptance Criteria**:
  - Offline navigation can use cached app assets.
  - API mutations and user-specific query responses never fall back to stale cache entries.
- **Validation**: Workbox rule test plus Chrome DevTools offline check.

### Task 0.5: Record the service-worker go/no-go result

- **Location**: `pwa-live-workout-rest-alerts-plan.md` implementation notes or a new ADR only if the dependency changes
- **Description**: If `next-pwa` custom-worker compilation fails under the production Next.js 15 build, replace only the worker build layer with a maintained Workbox-compatible option. Do not change the product or server design.
- **Dependencies**: Tasks 0.3–0.4
- **Acceptance Criteria**:
  - One worker owns caching, push display, tap handling, and acknowledgement.
  - The chosen worker path passes production build and preview install checks.
- **Validation**: Preview smoke test on iPhone and Android.

## Sprint 1: Expand the Data Model

**Goal**: Add the new model without deleting legacy fields, then backfill existing data safely.

**Demo/Validation**:

- Existing templates and sessions still load after migration.
- A Reps template and a Duration template can be saved.
- A started workout owns frozen exercise rows and explicit Pending sets.

### Task 1.1: Add shared domain contracts

- **Location**: `src/lib/workouts/contracts.ts`, `src/lib/schemas.ts`, `src/lib/types.ts`
- **Description**: Define Zod enums and discriminated types for workout status, set status, Reps/Duration mode, set result, command envelope, rest status, controller state, and sync errors.
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - Rep results require 1–100 whole reps.
  - Duration results require 1–3,600 whole seconds.
  - External load accepts 0–1,000 kg; optional RPE accepts whole 6–10 or explicit `null`.
  - Pending and Skipped sets cannot carry a required completed result.
- **Validation**: Table-driven unit tests for every valid and invalid boundary.

### Task 1.2: Add expand-only schema fields and tables

- **Location**: `src/lib/db/schema.ts`, new `drizzle/*.sql`
- **Description**: Add new columns alongside old booleans and values. Do not drop legacy columns in this sprint.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `workout_templates`: `archivedAt`.
  - `template_exercises`: mode, nullable rep targets, nullable `targetSeconds`, mode-aware check, unique `(templateId, exerciseId, mode)`.
  - `workout_sessions`: explicit status, revision, controller epoch/device, frozen template label fields.
  - `session_exercises`: optional template provenance plus frozen exercise ID/name, order, set count, mode, targets, RPE target, and rest seconds.
  - `session_sets`: explicit status, external load with enough precision for 1,000 kg, nullable actual reps/seconds, RPE, completion timestamp.
  - New tables: workout devices, operation receipts, rest periods, push subscriptions, readiness attempts, and delivery events.
- **Validation**: `npm run db:generate`; migration applies to an empty test database.

### Task 1.3: Add migration preflight checks

- **Location**: `scripts/check-workout-migration.ts`, `package.json`
- **Description**: Report duplicate template `(exercise, mode)` entries, multiple active sessions for one account, completed sets with invalid values, and session rows that cannot be frozen from current data.
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - The script is read-only.
  - It exits non-zero with IDs and a clear manual fix for unsafe rows.
  - It never deletes or merges user data.
- **Validation**: Fixtures cover each failure and a clean database.

### Task 1.4: Backfill legacy templates and sessions

- **Location**: new `drizzle/*.sql`, `scripts/verify-workout-backfill.ts`
- **Description**: Mark templates unarchived; treat legacy template rows as Reps; copy immutable session labels/targets; map completed booleans to explicit states; initialize revisions and controller epochs. Map an ended legacy session to Completed only when every planned set is completed; otherwise map it to Partial and map its unfinished sets to Skipped.
- **Dependencies**: Tasks 1.2–1.3
- **Acceptance Criteria**:
  - Row counts remain stable.
  - Every session set has one valid explicit status.
  - Ended workouts contain no Pending sets.
  - Every historical session occurrence has enough frozen data to render without a template join.
  - Backfill is idempotent.
- **Validation**: Apply twice to a production-shaped test dump; compare counts and checksums.

### Task 1.5: Add database invariants and indexes

- **Location**: new `drizzle/*.sql`, `src/lib/db/schema.ts`
- **Description**: Add a partial unique index for one Active workout per account, uniqueness for set numbers within an occurrence, operation IDs, device subscriptions, and current rest records. Add mode-aware and state-aware check constraints after backfill.
- **Dependencies**: Task 1.4
- **Acceptance Criteria**:
  - The database rejects two Active workouts for one account.
  - It rejects invalid Rep/Duration field combinations.
  - It rejects duplicate operation IDs and duplicate set positions.
- **Validation**: Database integration tests assert each constraint.

Before this task closes, reconcile the current security docs with the real database state: tracked migrations have no RLS policies, while `README.md` claims they do. Since runtime access uses authenticated server-side Drizzle and `src/lib/supabase.ts` is unused, remove the unused browser/admin Supabase clients and unused service-role dependency/env surface, or add and test real RLS before any direct browser database access is introduced. Do not leave the current claim unverified.

## Sprint 2: Canonical Workout Command Service

**Goal**: Make server transactions, not UI conditionals, own workout rules.

**Demo/Validation**:

- Start, complete, skip, restore, undo, finish, end, and discard work through one command endpoint.
- Replayed commands return the prior result without applying twice.
- Ended and Discarded workouts reject all edits.

### Task 2.1: Extract the state machine

- **Location**: `src/server/workouts/state-machine.ts`, `src/server/workouts/state-machine.test.ts`
- **Description**: Implement pure transition rules for Pending/Completed/Skipped sets and Active/Completed/Partial/Discarded workouts.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Only Current can complete or skip.
  - Only the latest completion can undo before another completion.
  - Final-set confirmation returns Completed only if all planned sets completed; any Skipped set returns Partial.
  - End early returns Partial; Discard excludes all set results.
- **Validation**: Exhaustive transition table and illegal-transition tests.

### Task 2.2: Add the transactional command service

- **Location**: `src/server/workouts/command-service.ts`, `src/server/workouts/queries.ts`, `src/server/workouts/command-service.integration.test.ts`
- **Description**: Apply one command with `operationId`, `controllerEpoch`, and expected revision. Lock the workout row, check ownership/controller/revision, write state and operation receipt atomically, then return the next snapshot.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Duplicate operation IDs are idempotent.
  - Stale revision and stale controller errors have stable machine-readable codes.
  - Telemetry writes do not increment workout revision.
  - A completed-set edit never changes Current or rest state.
- **Validation**: Concurrent integration tests for duplicate, stale, and out-of-order commands.

### Task 2.3: Freeze the plan at Start

- **Location**: `src/server/workouts/start-workout.ts`, `src/server/api/routers/session.ts`
- **Description**: In one transaction, check the template owner and archive state, enforce one Active workout, create controller state, copy every template occurrence, and create ordered Pending sets.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Starting requires network.
  - Later template edits or archive do not change the workout.
  - Active and historical reads use frozen rows only.
- **Validation**: Integration test edits and archives the template after Start and compares the workout snapshot.

### Task 2.4: Replace broad set/session mutations

- **Location**: `src/server/api/routers/session.ts`, `src/lib/workouts/contracts.ts`
- **Description**: Replace partial `updateSet`, `complete`, and hard-delete `cancel` writes with one typed command mutation and read-only snapshot/history queries.
- **Dependencies**: Tasks 2.2–2.3
- **Acceptance Criteria**:
  - No API can set `completed: true` without a valid mode-specific result.
  - Blank RPE maps to explicit `null`.
  - Ended and Discarded snapshots cannot mutate.
  - Discard leaves an internal tombstone.
- **Validation**: Router integration tests for auth, validation, and every terminal state.

### Task 2.5: Add template archive and mode-aware editing

- **Location**: `src/server/api/routers/template.ts`, `src/components/templates/create-template-form.tsx`, `src/components/templates/edit-template-form.tsx`, `src/app/templates/page.tsx`
- **Description**: Replace template delete with archive/restore. Add Reps/Duration mode and fixed duration target. Enforce one occurrence per `(exercise, mode)`.
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - Archived templates cannot start new workouts and remain in history.
  - Duration rows hide rep-range fields and require target seconds.
  - Same exercise can appear once in each mode, but not twice in one mode.
- **Validation**: Router and component tests; manual create/edit/archive/restore demo.

## Sprint 3: Mobile Checklist and Foreground Timers

**Goal**: Deliver the full foreground workout flow before adding offline and push work.

**Demo/Validation**:

- On a narrow viewport, the full set sequence is visible as a compact checklist.
- Checking Current completes it and starts rest only when another Pending set exists.
- Duration countdown, Finish, End, Discard, Skip, Restore, and Undo follow the agreed rules.

### Task 3.1: Split the active-workout page into focused components

- **Location**: `src/app/sessions/[sessionId]/page.tsx`, new `src/components/sessions/workout-checklist.tsx`, `set-checklist-row.tsx`, `workout-header.tsx`
- **Description**: Replace exercise Previous/Next navigation with one ordered checklist. Derive Current from the first Pending set.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Only Current has an enabled checkbox.
  - Future rows stay disabled; Completed and Skipped rows remain inspectable.
  - Ended history uses the same rows in read-only mode.
- **Validation**: Component tests at 390 px and desktop widths.

### Task 3.2: Build the mode-aware set editor

- **Location**: replace or reduce `src/components/sessions/live-set-logger.tsx`; add `src/components/sessions/set-result-editor.tsx`
- **Description**: Render external load plus reps or actual seconds, optional whole RPE, prior values, target-miss state, and explicit clearing.
- **Dependencies**: Task 3.1
- **Acceptance Criteria**:
  - No prior value defaults external load to 0.
  - Actual value is required before Current can complete.
  - Out-of-target actuals show a warning but can save.
  - Completed-set edits do not restart rest.
- **Validation**: Boundary and interaction tests for both modes.

### Task 3.3: Add absolute-time foreground timers

- **Location**: `src/components/sessions/rest-timer.tsx`, `duration-set-timer.tsx`, `src/lib/workouts/time.ts`
- **Description**: Derive display from stored `startedAt`/`dueAt` timestamps, not decrement-only React state. Add Skip Rest. Duration countdown starts explicitly, cues at zero, and never auto-completes.
- **Dependencies**: Tasks 3.1–3.2
- **Acceptance Criteria**:
  - Refresh or background/foreground recomputes the correct time.
  - Rest does not block editing or checklist use.
  - No rest starts for edits, Skip Set, or the final set.
- **Validation**: Fake-timer tests and browser visibility-change test.

### Task 3.4: Add guarded workout actions

- **Location**: `src/components/sessions/workout-actions.tsx`, existing session page
- **Description**: Add Skip Set, Restore, Undo last completion, Skip Rest, Finish confirmation, End early confirmation, and Discard confirmation.
- **Dependencies**: Tasks 3.1–3.3
- **Acceptance Criteria**:
  - Final checkbox validates, then opens Finish; Cancel leaves it Pending.
  - Confirm atomically completes the final set and ends.
  - Offline-ready UI language distinguishes Finish, End, and Discard.
- **Validation**: Component tests plus state-machine-backed integration cases.

### Task 3.5: Add prior values and mode-aware history labels

- **Location**: `src/server/workouts/queries.ts`, `src/components/sessions/previous-session-values.tsx`, checklist rows
- **Description**: Query the latest Completed set matching `exerciseId + mode + setNumber`, including Completed sets from Partial workouts, excluding Skipped/Discarded and RPE.
- **Dependencies**: Sprint 2 and Task 3.2
- **Acceptance Criteria**:
  - Reps and Duration history never mix.
  - Missing exact matches remain blank.
  - External load and actual reps/seconds populate; RPE does not.
- **Validation**: Integration fixtures covering Completed, Partial, Skipped, and Discarded workouts.

## Sprint 4: Offline Snapshot and Ordered Sync

**Goal**: Keep an already-started workout usable after network loss, refresh, or PWA restart.

**Demo/Validation**:

- Start online, go offline, complete/skip/edit sets, refresh the PWA, and continue.
- Reconnect and sync each action once in order.
- Offline Finish and Discard lock locally as Sync-pending until acknowledged.

### Task 4.1: Add the typed IndexedDB store

- **Location**: `src/lib/offline-workouts/db.ts`, `models.ts`, tests
- **Description**: Store the stable device ID, frozen active snapshot, FIFO outbox, sync metadata, timer timestamps, and recovery archives in separate object stores with schema versions.
- **Dependencies**: Sprint 3
- **Acceptance Criteria**:
  - Data survives reload and PWA restart.
  - Upgrades are transactional.
  - Push endpoint secrets are never written to logs.
- **Validation**: `fake-indexeddb` CRUD, upgrade, and failure tests.

### Task 4.2: Route every active-workout action through the outbox

- **Location**: `src/lib/offline-workouts/outbox.ts`, `src/hooks/use-active-workout.ts`
- **Description**: Persist an operation before optimistic UI change. Chain expected revisions locally and remove only after an acknowledged server receipt.
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - Online and offline actions use the same path.
  - A reload between local save and HTTP acknowledgement does not lose the operation.
  - Repeated sends keep the same operation ID.
- **Validation**: Crash-point tests before send, during send, and after server commit.

### Task 4.3: Add the FIFO sync engine

- **Location**: `src/lib/offline-workouts/sync.ts`, `src/components/sessions/sync-status.tsx`
- **Description**: Drain one command at a time, apply returned revisions/snapshots, pause on network errors, and halt on stale revision/controller responses.
- **Dependencies**: Task 4.2
- **Acceptance Criteria**:
  - Later actions never pass a failed action.
  - Network retries use bounded backoff.
  - Sync-conflicted state becomes read-only and preserves the full outbox.
- **Validation**: Deterministic unit tests with scripted server responses.

### Task 4.4: Restore active state on app load

- **Location**: `src/app/sessions/[sessionId]/page.tsx`, `src/components/providers.tsx`, `src/hooks/use-active-workout.ts`
- **Description**: Hydrate from IndexedDB first when offline, reconcile with the server when online, and show a clear Offline/Syncing/Sync-pending status.
- **Dependencies**: Tasks 4.1–4.3
- **Acceptance Criteria**:
  - Refresh works without a network after one online Start.
  - Starting a new workout still requires network.
  - Reconnection does not send expired catch-up rest alerts.
- **Validation**: Playwright offline/reload/reconnect flow.

### Task 4.5: Implement offline terminal actions

- **Location**: outbox, active-workout hook, workout actions
- **Description**: Queue atomic final-result + Finish and confirmed Discard. Lock the local workout immediately and wait for server acknowledgement.
- **Dependencies**: Tasks 4.2–4.4
- **Acceptance Criteria**:
  - Sync-pending is immutable.
  - Server state remains Active until it accepts the queued action.
  - Rejection enters Sync-conflicted with no local loss.
- **Validation**: Offline Finish/Discard browser tests and server rejection tests.

## Sprint 5: Controller, Handoff, and Conflict Recovery

**Goal**: Enforce one writer and give every blocked state an explicit recovery route.

**Demo/Validation**:

- A second device opens the workout read-only.
- Clean handoff transfers control only after an empty acknowledged outbox.
- Lost-device replacement keeps server state and rejects the old controller.
- Sync conflict can be reviewed, exported, archived, or resolved to server state.

### Task 5.1: Register and recognize workout devices

- **Location**: `src/server/api/routers/device.ts`, `src/server/api/root.ts`, `src/lib/offline-workouts/device.ts`
- **Description**: Register the stable local device ID for the authenticated account and return controller/read-only status without exposing push secrets.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Site-data clearing creates a new device identity.
  - Only the matching controller epoch can submit commands.
- **Validation**: Two-device router integration tests.

### Task 5.2: Add normal online handoff

- **Location**: `src/server/workouts/controller-service.ts`, device router, `src/components/sessions/controller-banner.tsx`
- **Description**: Require the current controller's empty acknowledged outbox, then change the controller and increment its epoch in one transaction.
- **Dependencies**: Task 5.1
- **Acceptance Criteria**:
  - Pending local actions block handoff.
  - Old controller becomes read-only immediately after refresh/sync.
  - Current rest record follows the new controller rules and stale jobs no-op.
- **Validation**: Concurrent handoff/command integration tests.

### Task 5.3: Add Replace lost device

- **Location**: controller service, device router, controller banner/dialog
- **Description**: Online only, show a strong unsynced-data-loss warning, keep server-acknowledged state, invalidate rest, increment the epoch, and assign the new controller.
- **Dependencies**: Tasks 5.1–5.2
- **Acceptance Criteria**:
  - No claim or check requires the lost outbox to be empty.
  - Old-device writes fail with stale controller.
  - No automatic merge or replay occurs.
- **Validation**: Lost device returns after replacement; its queued actions remain local and cannot alter the server.

### Task 5.4: Add Sync-conflicted resolution and export

- **Location**: `src/components/sessions/sync-conflict-dialog.tsx`, `src/lib/offline-workouts/recovery.ts`
- **Description**: Allow review/export, Cancel, or confirmed Use server version. Write the complete immutable recovery archive before clearing the snapshot/outbox.
- **Dependencies**: Sprint 4
- **Acceptance Criteria**:
  - Failed archive creation leaves the workout conflicted.
  - V1 offers no force-local, auto-merge, rebase, or stale retry.
  - Export contains human-readable workout/set actions and IDs for support.
- **Validation**: Failure-injection tests for archive write and export.

### Task 5.5: Enforce recovery archive retention

- **Location**: recovery store and a small archive-management UI
- **Description**: Keep one archive per conflicted workout across refresh/logout until explicit export or deletion. Detect low storage and block new offline work instead of eviction.
- **Dependencies**: Task 5.4
- **Acceptance Criteria**:
  - Archive deletion requires confirmation.
  - UI warns that clearing site/PWA data deletes device-only archives.
  - Storage-pressure handling never silently removes data.
- **Validation**: IndexedDB persistence and mocked quota tests.

## Sprint 6: Web Push Setup and Readiness

**Goal**: Make device push state explicit and prove a notification can reach `showNotification()` before labeling the device ready.

**Demo/Validation**:

- First workout shows install, permission, and test steps.
- A passing test marks only that device Background-alert ready.
- Failure or Skip starts Foreground-only with a fixed keep-open warning.

### Task 6.1: Add environment and push transport configuration

- **Location**: `src/env.mjs`, `.env.example`, `README.md`, `src/server/alerts/web-push.ts`
- **Description**: Add `QSTASH_TOKEN`, current/next signing keys, public/private VAPID keys, VAPID subject, and canonical app URL. Configure `web-push` once in a server-only module.
- **Dependencies**: Sprint 0
- **Acceptance Criteria**:
  - Server build fails clearly when production secrets are missing.
  - Only the VAPID public key reaches client code.
  - Stable keys are documented as deploy secrets, not regenerated per deploy.
- **Validation**: Env-schema tests and production build.

### Task 6.2: Store and prune per-device subscriptions

- **Location**: `src/server/api/routers/device.ts`, `src/server/alerts/subscriptions.ts`
- **Description**: Add authenticated subscribe/replace/unsubscribe operations for endpoint, `p256dh`, and `auth`. Bind each subscription to one account device.
- **Dependencies**: Task 6.1 and Sprint 5
- **Acceptance Criteria**:
  - Subscription replacement invalidates prior readiness.
  - Push responses 404/410 deactivate the subscription.
  - Endpoint and key data never appear in normal query responses or logs.
- **Validation**: Router integration tests and sender error mapping tests.

### Task 6.3: Implement worker push display, tap, and ACK

- **Location**: `worker/index.ts`, `src/app/api/push/ack/route.ts`
- **Description**: Parse a small typed payload, call `showNotification`, send the matching one-time acknowledgement after resolution, and deep-link/focus the current workout on notification tap.
- **Dependencies**: Tasks 0.3 and 6.2
- **Acceptance Criteria**:
  - No notification action buttons or background workout mutations.
  - Title/body contain exercise, set position, and target reps/seconds; never load/RPE.
  - ACK failure does not redisplay the notification.
- **Validation**: Worker unit tests plus preview push smoke test.

### Task 6.4: Add the 15-second readiness attempt

- **Location**: `src/server/alerts/readiness-service.ts`, device router, push ACK route
- **Description**: Create a unique attempt nonce, send a test push, and mark ready only when its matching `showNotification` ACK reaches the server within 15 seconds.
- **Dependencies**: Task 6.3
- **Acceptance Criteria**:
  - Permission, subscription, or provider acceptance alone never marks ready.
  - Late, stale, or mismatched ACKs no-op.
  - Permission, install state, subscription, or worker change invalidates readiness.
- **Validation**: Fake-clock integration tests for success, timeout, and late ACK.

### Task 6.5: Build the first-workout setup card

- **Location**: `src/components/push/alert-setup-card.tsx`, `src/components/push/foreground-only-warning.tsx`, sessions start and active pages
- **Description**: Guide iPhone Home Screen install when required, request permission only from a button tap, save the subscription, and run the test.
- **Dependencies**: Task 6.4
- **Acceptance Criteria**:
  - Setup is skippable and never blocks workout start.
  - Failed/skipped setup shows the persistent keep-open warning.
  - Passed readiness persists until device state changes.
- **Validation**: Component tests plus real iPhone/Android setup checklist.

## Sprint 7: Database-Authoritative Rest Alerts

**Goal**: Deliver one valid rest-finished Web Push and suppress every stale or duplicate trigger.

**Demo/Validation**:

- Complete a non-final set, close the PWA, and receive the correct notification.
- Skip Rest, Undo, a replacement completion, Finish, End, and Discard suppress the old alert.
- Notification tap opens and revalidates Current.

### Task 7.1: Make rest records part of workout transactions

- **Location**: `src/server/workouts/rest-periods.ts`, command service, schema integration tests
- **Description**: On a new valid completion, create/version one rest record with due time, state, token, controller epoch, and next-set display data. Invalidate it in the same transaction for every rest-changing command.
- **Dependencies**: Sprints 2 and 5
- **Acceptance Criteria**:
  - Edits, Skip Set, and final-set completion do not create rest.
  - Undo, Skip Rest, replacement completion, Finish, End, Discard, handoff, and lost-device replacement invalidate old records.
  - The database record is the only validity source.
- **Validation**: Transition-by-transition database tests.

### Task 7.2: Publish QStash jobs idempotently

- **Location**: `src/server/alerts/qstash.ts`, command-service operation receipt
- **Description**: After commit, publish `{restId, token}` with delay, label, retries, and a stable deduplication ID. Persist the returned message ID on the operation/rest record.
- **Dependencies**: Task 7.1 and Task 6.1
- **Acceptance Criteria**:
  - A crash or lost response before publish is repaired by replaying the same durable operation.
  - Replay does not create duplicate QStash jobs.
  - Cancellation is attempted but never used as proof of invalidity.
- **Validation**: Mock QStash crash-point tests and staging log check.

### Task 7.3: Add the signed QStash callback

- **Location**: `src/app/api/rest-alerts/dispatch/route.ts`
- **Description**: Read the raw body, verify `Upstash-Signature` with current/next keys and canonical URL, then re-read the database record.
- **Dependencies**: Task 7.2
- **Acceptance Criteria**:
  - Invalid signature returns 401.
  - Late/duplicate/stale callbacks return success without sending.
  - Active workout, rest token/state/due time, controller epoch, and current subscription must all match.
- **Validation**: Route tests with valid, invalid, rotated, duplicate, and stale signatures.

### Task 7.4: Send the privacy-safe Web Push

- **Location**: `src/server/alerts/web-push.ts`, dispatch route
- **Description**: Build payload after revalidation and send with VAPID, high urgency, a short TTL, and a coalescing topic so expired rest alerts are not retained for long periods.
- **Dependencies**: Task 7.3
- **Acceptance Criteria**:
  - Payload includes opaque alert/session/current-set IDs, due time, deep link, exercise label, set position, and target reps/seconds.
  - It excludes external load and RPE.
  - 404/410 prunes subscription and removes Background-alert ready state.
- **Validation**: Payload snapshots, transport tests, and real-device background delivery.

### Task 7.5: Add delivery telemetry and the 95% SLI

- **Location**: `src/server/alerts/telemetry.ts`, push ACK route, dispatch route, worker, an internal diagnostics query/page
- **Description**: Record due, callback received, push accepted/rejected, worker received, `showNotification` resolved/failed, ACK received, and tap. Compute due-to-show success within 10 seconds.
- **Dependencies**: Tasks 7.3–7.4
- **Acceptance Criteria**:
  - Missing ACK after the grace window counts as failure.
  - “Presentation accepted” is not labeled “user saw it.”
  - Alert telemetry never increments workout revision.
- **Validation**: Synthetic event fixtures and staging dashboard/log review.

## Sprint 8: History, Analytics, Hardening, and Release

**Goal**: Make all downstream views obey the new states, prove production behavior, and remove legacy paths.

**Demo/Validation**:

- Completed and Partial workouts render read-only.
- Discarded workouts stay hidden.
- Reps and Duration analytics follow their separate contracts.
- A staging workout passes online, offline, handoff, push, and recovery checks.

### Task 8.1: Update history and read-only detail

- **Location**: `src/app/sessions/page.tsx`, session detail page, `src/server/workouts/queries.ts`
- **Description**: List Completed and Partial workouts, show clear status labels, render frozen labels, and hide Discarded tombstones from normal history.
- **Dependencies**: Sprints 2–3
- **Acceptance Criteria**:
  - Ended workout UI exposes no mutating controls or running session timer.
  - Archived template state does not break history.
- **Validation**: Component and router tests for all terminal states.

### Task 8.2: Make analytics mode-aware

- **Location**: `src/server/api/routers/progress.ts`, `src/app/progress/page.tsx`
- **Description**: Include Completed sets from Completed and Partial workouts. Exclude Skipped and Discarded. Limit load×reps volume, estimated 1RM, strength standards, and PR cards to Reps. Add completed Duration set count and total actual seconds.
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - Seconds are never converted to reps or load×time.
  - Charts/history label Reps and Duration.
- **Validation**: Analytics integration fixtures for mixed modes and statuses.

### Task 8.3: Add full browser journeys

- **Location**: `playwright.config.ts`, `e2e/workout/*.spec.ts`
- **Description**: Cover template mode setup, checklist flow, target misses, skip/restore/undo, Finish/Partial/Discard, offline reload/sync, conflict archive, and two-device controller behavior.
- **Dependencies**: Sprints 3–7
- **Acceptance Criteria**:
  - Tests use mobile and desktop projects.
  - Network and server failures are deterministic.
  - Push transport is mocked in CI; staging covers real push.
- **Validation**: `npm run test:e2e`

### Task 8.4: Run physical-device and deployment checks

- **Location**: `docs/runbooks/pwa-rest-alert-release.md`, `.env.example`, `README.md`, `DRIZZLE_SETUP.md`, `src/lib/supabase.ts`
- **Description**: Document Vercel/Upstash/VAPID setup, signing-key rotation, subscription pruning, alert diagnostics, and support steps. Remove stale Supabase/RLS claims and unused client code unless real policies were added in Sprint 1. Run the agreed first-workout and background alert cases on real devices.
- **Dependencies**: Sprints 6–7
- **Acceptance Criteria**:
  - iPhone: Home Screen install, button-triggered permission, test readiness, closed-PWA rest alert, tap deep link.
  - Android: same payload and deep link behavior.
  - QStash callback signatures work on preview and production URLs.
  - Observed alerts can be compared with the 95%-within-10-seconds SLI.
- **Validation**: Signed release checklist with timestamps and device/OS versions.

### Task 8.5: Contract legacy fields and code paths

- **Location**: `src/lib/db/schema.ts`, final `drizzle/*.sql`, session/template routers and old components
- **Description**: After one stable release on the expanded model, remove legacy booleans, old weight/reps fields, mutable-template joins, hard delete routes, and obsolete Previous/Next/rest-timer code.
- **Dependencies**: Tasks 8.1–8.4 and production backfill verification
- **Acceptance Criteria**:
  - Pre-contract verification finds no legacy-only reads/writes.
  - Generated migration does not delete frozen plans, tombstones, operations, or archives.
  - Changed source files remain under 1,000 lines and no duplicate state-machine logic remains in UI/router code.
- **Validation**: Full test suite, migration rehearsal, `rg` audit for legacy fields, and production build.

## Testing Strategy

### Unit tests

- Domain contracts and numeric boundaries.
- State-machine transitions and rest invalidation.
- Absolute-time timer math.
- IndexedDB schema, outbox, sync, and recovery archives.
- Worker payload parsing, notification display options, ACK, and tap deep links.

### Database integration tests

- Frozen plan creation and template archive behavior.
- One Active workout and one Controlling device.
- Revision/epoch/idempotency rules under concurrent calls.
- Atomic Finish/End/Discard/rest transitions.
- Prior-value and analytics filters.

### Browser tests

- Mobile checklist and confirmations.
- Offline reload, ordered replay, and Sync-pending.
- Conflict resolution and archive retention.
- Two-device read-only/handoff/lost-controller flows.

### Physical-device tests

- iPhone Home Screen install and user-gesture permission.
- Test-push readiness ACK within 15 seconds.
- PWA closed/background rest alert and deep link.
- Android parity for payload and tap.

### Required commands before each sprint handoff

```bash
npm run test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Run `npm run test:e2e` once the sprint has a browser flow.

## Potential Risks and Mitigations

1. **PWA build, install, and cache correctness**  
   Prove `next-pwa` custom-worker output under Next.js 15, replace and validate the current HTML-disguised-as-PNG icons, and keep authenticated API traffic NetworkOnly. Change only the worker build layer if compatibility fails.

2. **Unsafe legacy data during migration**  
   Use expand/backfill/verify/contract. Stop on duplicates or multiple Active workouts; never merge or delete automatically.

3. **Set committed but QStash publish response lost**  
   Persist the operation/rest first, keep the client action until acknowledgement, and republish with the same deduplication ID on replay.

4. **iOS delivery cannot be proven by desktop automation**  
   Keep worker and server logic automated, then require physical iPhone staging checks and measure `showNotification` ACK rather than provider acceptance.

5. **PWA/site data can be cleared by the OS or user**  
   Explain the device-only limit, support Replace lost device, preserve server-acknowledged state, and never promise recovery of an unsynced lost outbox.

## Rollback Plan

1. Keep Sprint 1 schema changes expand-only and retain legacy columns until Sprint 8.
2. Gate the new active-workout UI and command route during staged rollout if needed; do not gate core state rules in multiple modules.
3. Roll back the application while leaving added tables/columns intact; old code must tolerate them.
4. Disable new alert scheduling without deleting rest records or subscriptions if QStash/Web Push has an incident; foreground timers remain available.
5. Run the contract migration only after a stable release, backfill verification, and a database backup.

## Definition of Done

- The mobile PWA can start online, continue offline, survive reload, and sync in order.
- The checklist, timers, terminal states, frozen plan, prior values, and analytics match `CONTEXT.md`.
- One Controlling device owns writes and alerts; handoff, loss, and conflicts have explicit safe paths.
- A Background-alert ready iPhone or Android device receives a privacy-safe rest alert from a valid current database rest record.
- The alert pipeline records enough evidence to measure 95% presentation acceptance within 10 seconds under the agreed conditions.
