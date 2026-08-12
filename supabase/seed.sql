-- Local development seed (runs on `supabase start` / `supabase db reset`).
-- Only executed against the LOCAL Supabase stack — never against production,
-- which is driven by the linked remote project. Creates one confirmed test
-- user so the auth-gated UI can be exercised locally.
--
--   E-post:  [email protected]
--   Passord: VolvoLocal2026
--   Rolle:   super  (ser alle moduler)
--
-- The GoTrue local API rejects example/test email domains, so the user is
-- inserted directly with a bcrypt password (login verifies the hash).

do $$
declare
  v_email text := '[email protected]';
  v_password text := 'VolvoLocal2026';
  uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = v_email) then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change,
    email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
    v_email, crypt(v_password, gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"],"role":"super","brand":"volvo"}'::jsonb,
    '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at, id
  ) values (
    uid::text, uid,
    jsonb_build_object('sub', uid::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now(), gen_random_uuid()
  );
end $$;
