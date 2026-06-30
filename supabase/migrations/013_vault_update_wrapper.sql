-- Plan 5 / Task 1 — vault.update_secret을 public schema에서 service_role로 호출

CREATE OR REPLACE FUNCTION public.update_vault_secret(
  secret_id uuid,
  new_secret text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  PERFORM vault.update_secret(secret_id, new_secret);
END;
$$;

REVOKE ALL ON FUNCTION public.update_vault_secret(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_vault_secret(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text) TO service_role;
