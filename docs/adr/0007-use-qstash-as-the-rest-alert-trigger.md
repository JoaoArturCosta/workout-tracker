# Use QStash as the rest-alert trigger

Upstash QStash will hold each delayed Rest period job and call a signed Vercel endpoint when it is due, carrying only the rest-record ID and its token. The app remains on Vercel with Supabase as its database; QStash adds signed callbacks, second-based delay, retries, deduplication, cancellation attempts, and delivery logs without requiring an always-on worker. Job cancellation is best effort and never establishes validity; database revalidation defined in ADR 0006 makes cancel races and stale triggers safe.
