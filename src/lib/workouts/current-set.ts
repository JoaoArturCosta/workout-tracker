export interface CurrentSetCandidate {
  id: string;
  /** Only "Pending" participates; any other value counts as not pending. */
  status: string;
  completedAt?: Date | string | null;
  /** Exercise occurrence id: sets of one exercise share an occurrence. */
  exerciseOccurrenceId: string;
}

/**
 * The most recently completed set; ties keep the later set in sequence order.
 */
export function findLatestCompletedSet<T extends CurrentSetCandidate>(
  sets: Array<T>
): T | undefined {
  let latest: T | undefined;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const set of sets) {
    if (set.status !== "Completed" || set.completedAt == null) continue;
    const time = new Date(set.completedAt).getTime();
    if (Number.isFinite(time) && time >= latestTime) {
      latestTime = time;
      latest = set;
    }
  }
  return latest;
}

/**
 * The Current set follows the exercise the athlete is completing: the first
 * pending set of the most recently completed set's exercise occurrence, or,
 * when that exercise has no pending set left, the first pending set in the
 * set sequence. With no completions yet it is the first pending set.
 */
export function findCurrentSet<T extends CurrentSetCandidate>(
  sets: Array<T>
): T | undefined {
  const pending = sets.filter((set) => set.status === "Pending");
  if (pending.length === 0) return undefined;

  const latest = findLatestCompletedSet(sets);
  if (!latest) return pending[0];

  return (
    pending.find(
      (set) => set.exerciseOccurrenceId === latest.exerciseOccurrenceId
    ) ?? pending[0]
  );
}
