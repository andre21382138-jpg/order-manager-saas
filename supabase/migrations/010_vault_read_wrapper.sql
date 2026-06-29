-- Plan 4 / Task 2 — vault.decrypted_secrets를 public schema에서 service_role로 조회

CREATE OR REPLACE FUNCTION public.read_vault_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.read_vault_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_vault_secret(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(uuid) TO service_role;
