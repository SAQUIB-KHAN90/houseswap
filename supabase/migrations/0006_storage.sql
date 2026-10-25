-- Photo storage.
--
-- Two buckets, because the two kinds of photo have opposite access rules:
--
--   listing-photos   public. They are the advertisement; anyone browsing an
--                    active listing has to see them.
--   stay-evidence    private. A photo of the inside of somebody's home, taken
--                    as proof of condition. Only the two people on the stay and
--                    staff may ever read it, and only through a signed URL.
--
-- The access rules are policies on storage.objects rather than checks in the
-- application, so they reuse in_stay() from 0003 and there is still exactly one
-- definition of who is on a stay. Nothing in TypeScript decides this.

-- ------------------------------------------------------------------ buckets

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true,  5242880, array['image/jpeg','image/webp','image/png']),
  ('stay-evidence',  'stay-evidence',  false, 5242880, array['image/jpeg','image/webp','image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 5 MB is deliberately generous: the browser resizes and compresses before
-- upload (weak networks, architecture.md 9), so a real upload is well under
-- 500 KB. The limit is a backstop against someone bypassing the client.

-- ----------------------------------------------------------- listing photos

-- Path: listing-photos/<listing_id>/<file>. The first folder is the listing, so
-- a host can only ever write under a listing they own.
create or replace function owns_listing_folder(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from listings
     where host_id = auth.uid()
       and id::text = (storage.foldername(p_name))[1]
  );
$$;

drop policy if exists "listing photos are public" on storage.objects;
create policy "listing photos are public" on storage.objects
  for select using (bucket_id = 'listing-photos');

drop policy if exists "hosts write their own listing photos" on storage.objects;
create policy "hosts write their own listing photos" on storage.objects
  for insert with check (
    bucket_id = 'listing-photos' and owns_listing_folder(name)
  );

drop policy if exists "hosts replace their own listing photos" on storage.objects;
create policy "hosts replace their own listing photos" on storage.objects
  for update using (bucket_id = 'listing-photos' and owns_listing_folder(name))
  with check (bucket_id = 'listing-photos' and owns_listing_folder(name));

drop policy if exists "hosts delete their own listing photos" on storage.objects;
create policy "hosts delete their own listing photos" on storage.objects
  for delete using (
    bucket_id = 'listing-photos' and owns_listing_folder(name)
  );

-- --------------------------------------------------------- stay evidence

-- Path: stay-evidence/<stay_id>/<phase>/<file>. The first folder is the stay,
-- so in_stay() answers the whole question.
-- The cast has to be guarded. A path whose first folder is not a uuid would
-- raise invalid_text_representation rather than returning false, and an error
-- out of a policy is a 500 where a plain "denied" belongs.
create or replace function on_evidence_stay(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_stay uuid;
begin
  v_stay := ((storage.foldername(p_name))[1])::uuid;
  return in_stay(v_stay);
exception when others then
  return false;
end;
$$;

drop policy if exists "stay parties read evidence" on storage.objects;
create policy "stay parties read evidence" on storage.objects
  for select using (
    bucket_id = 'stay-evidence' and (on_evidence_stay(name) or is_staff())
  );

drop policy if exists "stay parties add evidence" on storage.objects;
create policy "stay parties add evidence" on storage.objects
  for insert with check (
    bucket_id = 'stay-evidence' and on_evidence_stay(name)
  );

-- No update and no delete policy, on purpose. Evidence is written once. A photo
-- that could be replaced after a dispute opens is not evidence, and the sha256
-- recorded on checklist_items would no longer prove anything.

grant execute on function owns_listing_folder(text), on_evidence_stay(text)
  to authenticated;
