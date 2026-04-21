-- Cleanup orphaned Notification rows left behind by 0019_update-notification-fk
--
-- 0019 remapped "Notification"."postId" from legacy text IDs to new uuid IDs
-- by looking them up in posts.legacy_post_id. Rows whose legacy post was no
-- longer present (e.g. deleted before the cutover) ended up with postId=NULL.
-- Same applies to commentId. Because both columns are nullable, the FK add
-- accepted these rows, and they now appear in notification.getCount but
-- silently disappear from the notifications page (the joined post/notifier
-- relation is null, and the client guard drops them).
--
-- This migration permanently removes those unrenderable rows. Idempotent:
-- re-running is a no-op once the table is clean.

DELETE FROM "Notification"
WHERE "postId" IS NULL
   OR "notifierId" IS NULL;
