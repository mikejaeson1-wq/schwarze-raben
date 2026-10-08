-- Raise only the clan's buckets; authentication and existing RLS stay intact.
-- The frontend accepts images up to 50 MiB and MP3 files up to 20 MiB.
update storage.buckets set file_size_limit=52428800
where id in ('raben-media','raben-public');
