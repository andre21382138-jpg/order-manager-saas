-- Plan 2 hotfix — vault.create_secret / vault.secrets DELETE를
-- public schema의 SECURITY DEFINER wrapper로 노출 (PostgREST가 vault schema를 직접 expose 안 하므로).

-- create wrapper: payload + name + description → secret_id 반환
CREATE OR REPLACE FUNCTION public.create_vault_secret(
  secret text,
  name text,
  description text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT vault.create_secret(secret, name, description) INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_vault_secret(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_vault_secret(text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_vault_secret(text, text, text) TO service_role;

-- delete wrapper: secret_id로 vault.secrets 한 행 삭제
CREATE OR REPLACE FUNCTION public.delete_vault_secret(secret_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE id = secret_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_vault_secret(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_vault_secret(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_vault_secret(uuid) TO service_role;
