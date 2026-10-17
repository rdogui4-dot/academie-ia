-- Restrict pre-authentication access to helpers that reveal account or tutor state.
-- The authenticated application retains the same RPCs; public certificate verification
-- remains intentionally available through academy_verify_certificate(uuid).
revoke execute on function public.academy_has_access(integer) from public, anon;
grant execute on function public.academy_has_access(integer) to authenticated;

revoke execute on function public.academy_is_admin() from public, anon;
grant execute on function public.academy_is_admin() to authenticated;

revoke execute on function public.academy_set_enrollment(uuid, text) from public, anon;
grant execute on function public.academy_set_enrollment(uuid, text) to authenticated;

revoke execute on function public.academy_tutor_quota(integer) from public, anon;
grant execute on function public.academy_tutor_quota(integer) to authenticated;
