DROP POLICY IF EXISTS "Read demo contact names" ON public.contacts;
DROP POLICY IF EXISTS "Read demo routes" ON public.demo_routes;
REVOKE ALL ON public.contacts FROM anon, authenticated;
REVOKE ALL ON public.demo_routes FROM anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
GRANT ALL ON public.demo_routes TO service_role;