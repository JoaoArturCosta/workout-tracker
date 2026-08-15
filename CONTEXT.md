# Workout Tracking

This context covers planning and completing workouts, including the state shown while a workout is in progress.

## Language

**Exercise occurrence**:
One placement of an exercise within a Workout template or Workout plan. In v1, a template can contain an exercise once in Reps mode and once in Duration mode, but cannot contain two occurrences with the same exercise and mode.
_Avoid_: Exercise instance, exercise copy

**Workout template**:
A reusable definition for starting workouts, including its exercise occurrences, their order, set count, Reps or Duration mode, targets, RPE targets, and rest duration.
_Avoid_: Routine, program

**Archived workout template**:
A workout template hidden from new workout choices but retained for existing workouts and history. It can be restored.
_Avoid_: Deleted template, inactive template

**Workout plan**:
The fixed exercise and target details copied from a workout template for one workout. Later template changes do not alter this plan.
_Avoid_: Session template, live template

**Active workout**:
A workout that has started but has not been ended or discarded. Leaving or closing the app does not end it.
_Avoid_: Open session, current session

**Partial workout**:
A workout ended before every planned set was completed. Its completed sets remain part of history, analytics, and future prior set values.
_Avoid_: Incomplete workout, abandoned workout

**Completed workout**:
A workout ended after every planned set was completed.
_Avoid_: Full workout, finished workout

**Ended workout**:
A Completed, Partial, or Discarded workout that no longer accepts changes.
_Avoid_: Closed session, workout history

**Discarded workout**:
A workout ended through a confirmed Discard action. It cancels any Rest-finished alert, is hidden from normal history, and contributes no sets to analytics or Prior set values. The system retains only an immutable internal record for safe sync, retry, and audit behavior; Discard never hard-deletes the workout.
_Avoid_: Deleted workout, cancelled workout

**Set sequence**:
The fixed order of sets in an active workout, sorted first by Exercise occurrence order and then by set number.
_Avoid_: Queue, workout order

**Current set**:
The one set in the set sequence that the athlete is performing or preparing to perform. Before any completion it is the first pending set in the set sequence. After any completion it is the first pending set of the exercise occurrence completed most recently; when that exercise has no pending set left, it falls back to the first pending set in the set sequence.
_Avoid_: Active set, selected set

**Skipped set**:
A planned set the athlete chose not to perform. It does not start rest or contribute to volume, records, or prior set values; it stays skipped unless restored before the workout ends.
_Avoid_: Incomplete set, omitted set

**Rep set**:
A planned set measured by repetitions. Its target guides the athlete, but an actual result outside the target range can still complete the set.
_Avoid_: Normal set, repetition mode

**Duration set**:
A planned set measured by elapsed seconds rather than repetitions. Its target guides the athlete, but an actual result below or above that target can still complete the set. In v1, completed Duration sets contribute only to completed-set count and total actual seconds. They do not contribute to volume, estimated one-rep max, strength standards, or personal-record cards, and seconds are never converted to reps.
_Avoid_: Timed rest, timer set

Completed Rep and Duration sets store their actual result and show a target-miss indicator when that result falls outside the planned target. A target mismatch never blocks completion.

**Set result**:
The actual value saved when a set completes. A Rep set requires 1–100 whole reps; a Duration set requires 1–3,600 whole seconds. Both store 0–1,000 kg of External load, defaulting to zero when no Prior set values exist. RPE is optional and, when present, must be a whole number from 6 through 10. While the workout is Active, saving a blank RPE explicitly clears the prior value. Pending and Skipped sets do not require a result.
_Avoid_: Set log, performance data

**Prior set values**:
The external load and actual reps or duration from the most recent completed set with the same exercise, Reps or Duration mode, and set number. RPE is not a prior set value because it describes the effort of the current performance.
_Avoid_: Previous values, last workout values

**External load**:
Weight added to an exercise beyond the athlete's body weight. It must be zero or greater; zero is valid for an unweighted bodyweight set. V1 does not track assisted load, and negative values never represent assistance.
_Avoid_: Weight, body weight

**Rest period**:
The planned time between a newly completed set and the Current set that follows it. A workout has no rest period after its final set.
_Avoid_: Break, rest timer

**Rest-finished alert**:
The notification sent when a rest period ends. It identifies the Current set's exercise, set position, and target reps or duration, and opens that set without exposing load or RPE.
_Avoid_: Rest notification, timer alert

**Alert setup**:
The first-workout flow that guides the athlete to install the PWA when required, grant notification permission, save its push subscription, and send a uniquely identified test alert. The test passes only when the service worker shows the alert and its matching acknowledgement reaches the server within 15 seconds of dispatch. Errors, timeouts, and stale or late acknowledgements fail closed. Skipping or failing setup does not block the workout; it starts as Foreground-only and keeps the setup action available.
_Avoid_: Notification onboarding, push setup

**Background-alert ready**:
A device that has passed Alert setup and a delivery test, so it can receive timer-end alerts while the workout is not visible. Permission or a stored push subscription alone does not establish readiness. Readiness remains valid for that device until its permission, PWA installation, push subscription, or service worker changes. The product target is 95% of alerts within ten seconds when the device is online, notification permission is enabled, and Focus does not block the alert.
_Avoid_: Notifications enabled, push ready

**Foreground-only workout**:
An active workout on a device that is not Background-alert ready. The workout remains usable, but the app warns the athlete to keep it open for rest-finished alerts.
_Avoid_: Notifications-disabled workout, unsafe workout

**Offline-active workout**:
An active workout that started online and remains usable without a connection, including after the PWA is reopened. Its unsynced set changes and timer state stay on the device until a connection returns.
_Avoid_: Offline session, cached workout

**Sync-pending workout**:
A workout finished or discarded while offline and locked on the Controlling device while its ordered changes wait for server acceptance. It becomes an Ended workout only after sync succeeds.
_Avoid_: Completed offline workout, locally ended workout

**Sync-conflicted workout**:
An Active or Sync-pending workout whose ordered offline changes the server rejected because its workout revision or Controlling device epoch was stale. Sync stops, the local snapshot and queued changes remain intact, and the workout stays read-only until the athlete explicitly resolves it.
_Avoid_: Broken workout, failed workout

**Recovery archive**:
The read-only local snapshot and queued changes preserved before resolving a Sync-conflicted workout with the server version. V1 keeps one device-only archive per conflicted workout until the athlete exports or deletes it; refresh and logout do not remove it. The app never evicts it for storage space and warns that clearing PWA or site data will delete it. It cannot overwrite server state.
_Avoid_: Backup workout, failed queue

**Controlling device**:
The one device allowed to change an active workout and schedule its alerts. Control can move through an online handoff after all pending changes sync. If that device is lost, an online Replace lost device flow can keep only server-acknowledged state and assign a new controller after a clear data-loss warning.
_Avoid_: Owner device, primary device
