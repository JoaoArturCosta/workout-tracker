# Support offline active workouts with a durable device queue

Starting a workout will require a connection, but an active workout will remain usable offline and after the PWA is reopened. The device will retain the frozen workout plan, Current set, Rest period, and unsynced set changes until they sync after reconnection; offline background alerts remain unsupported, so the foreground-only warning applies.
