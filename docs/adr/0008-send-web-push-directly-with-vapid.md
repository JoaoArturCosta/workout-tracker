# Send Web Push directly with VAPID

Vercel will send standards-based Web Push directly to each device subscription using stable VAPID keys after QStash calls the rest-alert endpoint. This avoids OneSignal or Firebase cost and lock-in for a transactional alert, while requiring the app to store subscriptions, remove expired endpoints, and track send and tap events itself.
