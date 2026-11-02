REVOKE ALL ON public.trips, public.trip_locations, public.partner_requests, public.ai_access_state FROM anon, authenticated;
REVOKE ALL ON public.incidents, public.safe_stops FROM anon, authenticated;
GRANT SELECT ON public.incidents, public.safe_stops TO anon, authenticated;
GRANT ALL ON public.trips, public.trip_locations, public.partner_requests, public.ai_access_state, public.incidents, public.safe_stops TO service_role;