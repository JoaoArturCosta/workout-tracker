# Rest alert operations

## Configure

1. Create one VAPID key pair. Store the public key in
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.
2. Set `VAPID_SUBJECT` to a monitored `mailto:` address or HTTPS URL.
3. Add the QStash token plus current and next signing keys.
4. Set `APP_URL` to the exact canonical HTTPS app origin.
5. Deploy to a non-production environment and complete the physical-device
   checks below before production.

Do not generate VAPID keys during build or deploy. Replacing the key pair makes
saved browser subscriptions unusable and requires Alert setup again.

## Rotate QStash signing keys

1. Put the new key in `QSTASH_NEXT_SIGNING_KEY`.
2. Deploy and verify signed test callbacks.
3. Promote the new key to `QSTASH_CURRENT_SIGNING_KEY`.
4. Put the next planned key in `QSTASH_NEXT_SIGNING_KEY`.
5. Deploy again and verify both current and next signatures.

The dispatch route reads the raw request body and checks the signature against
the canonical callback URL. Do not parse or rewrite the body before that check.

## Device checks

1. Install the PWA from Safari on an iPhone running iOS 16.4 or newer.
2. Tap **Set up alerts**. Do not grant permission from an automatic prompt.
3. Confirm the test alert reaches `showNotification` and readiness passes in
   15 seconds.
4. Complete a non-final set, close the PWA, and confirm one rest alert arrives.
5. Tap the alert and confirm the app opens the right workout and Current set.

Repeat the same flow on Android Chrome. Test Focus modes separately because the
device can suppress presentation even when provider delivery succeeds.

## Diagnose

Trace one rest ID through these delivery event types:

1. `CallbackReceived`
2. `PushAccepted` or `PushRejected`
3. `WorkerReceived`
4. `ShowResolved` or `ShowFailed`
5. `Tap`, when the athlete opens the alert

`ShowResolved` means the browser accepted presentation. It does not prove the
athlete saw the alert. The service target counts a presentation as on time only
when its ACK arrives within ten seconds of the stored due time.

For stale or duplicate callbacks, check the workout is still `Active`, the rest
is still `Scheduled`, the token and controller epoch match, the stored Current
set is still Pending, and the controlling device has one active ready
subscription.

## Prune subscriptions

Web Push responses `404` and `410` revoke that subscription and clear its ready
state. The athlete must run Alert setup again. Do not log endpoint, `p256dh`, or
`auth` values while tracing a failed send.

QStash cancellation is only a cost control. The database rest status and token
decide whether dispatch can send.
