REVOKE ALL ON public.contacts FROM anon, authenticated;
COMMENT ON TABLE public.contacts IS 'DEPRECATED: trusted contacts are stored only on the user''s device.';