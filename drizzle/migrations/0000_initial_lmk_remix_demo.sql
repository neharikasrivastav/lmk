CREATE TABLE IF NOT EXISTS public.incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL, description text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL, severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5), minutes_ago integer NOT NULL DEFAULT 6, created_at timestamptz NOT NULL DEFAULT now(), demo boolean NOT NULL DEFAULT true, street text);
GRANT SELECT ON public.incidents TO anon, authenticated; GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.safe_stops (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, lat double precision NOT NULL, lng double precision NOT NULL, address text NOT NULL, note text NOT NULL, verified boolean NOT NULL DEFAULT false, closes_at integer NOT NULL DEFAULT 23, specialty text NOT NULL, demo boolean NOT NULL DEFAULT true, walking_route jsonb NOT NULL DEFAULT '[]');
GRANT SELECT ON public.safe_stops TO anon, authenticated; GRANT ALL ON public.safe_stops TO service_role;
ALTER TABLE public.safe_stops ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.contacts (id integer PRIMARY KEY, name text NOT NULL);
GRANT SELECT ON public.contacts TO anon, authenticated; GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.demo_routes (id integer PRIMARY KEY, name text NOT NULL, duration_s integer NOT NULL, distance_m integer NOT NULL, coordinates jsonb NOT NULL);
GRANT SELECT ON public.demo_routes TO anon, authenticated; GRANT ALL ON public.demo_routes TO service_role;
ALTER TABLE public.demo_routes ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.trips (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token text NOT NULL UNIQUE, owner_hash text NOT NULL, viewer_hash text NOT NULL, destination text NOT NULL, destination_coords jsonb NOT NULL, route jsonb NOT NULL, position jsonb NOT NULL, duration_s integer NOT NULL, progress double precision NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'walking', checkins jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT (now() + interval '4 hours'), sharing boolean NOT NULL DEFAULT true, demo boolean NOT NULL DEFAULT true);
GRANT ALL ON public.trips TO service_role; REVOKE ALL ON public.trips FROM anon, authenticated;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.trip_locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE, position jsonb NOT NULL, progress double precision NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.trip_locations TO service_role;
ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS trip_locations_trip_time ON public.trip_locations(trip_id, created_at);
COMMENT ON TABLE public.trip_locations IS 'Private location history; current app reads the latest position from trips through capability-checked server functions.';
CREATE TABLE IF NOT EXISTS public.partner_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business text NOT NULL, name text NOT NULL, email text NOT NULL, address text NOT NULL, tier text NOT NULL, commitments boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.partner_requests TO service_role;
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.ai_access_state (id integer PRIMARY KEY DEFAULT 1, blocked boolean NOT NULL DEFAULT false, reason text, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.ai_access_state TO service_role;
ALTER TABLE public.ai_access_state ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='incidents' AND policyname='Public demo incidents') THEN CREATE POLICY "Public demo incidents" ON public.incidents FOR SELECT TO anon,authenticated USING(demo); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='safe_stops' AND policyname='Public demo stops') THEN CREATE POLICY "Public demo stops" ON public.safe_stops FOR SELECT TO anon,authenticated USING(demo); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='contacts' AND policyname='Read demo contact names') THEN CREATE POLICY "Read demo contact names" ON public.contacts FOR SELECT TO anon,authenticated USING(true); END IF;
IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='demo_routes' AND policyname='Read demo routes') THEN CREATE POLICY "Read demo routes" ON public.demo_routes FOR SELECT TO anon,authenticated USING(true); END IF;
END $$;
INSERT INTO public.contacts(id,name) VALUES (1,'Mom'),(2,'Priya'),(3,'Alex') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.demo_routes(id,name,duration_s,distance_m,coordinates) VALUES
(0,'Fastest',900,1050,'[[-122.40785,37.78443],[-122.4068,37.78525],[-122.4058,37.7861],[-122.4046,37.78705],[-122.4034,37.78799],[-122.402,37.7878],[-122.4007,37.78765],[-122.3993,37.78745],[-122.398,37.7873],[-122.39773,37.78565]]'),
(1,'Calmer',1080,1250,'[[-122.40785,37.78443],[-122.407,37.78375],[-122.4055,37.78395],[-122.404,37.78414],[-122.4025,37.78433],[-122.401,37.78452],[-122.3995,37.78471],[-122.3979,37.78491],[-122.39773,37.78565]]') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.incidents(id,type,description,lat,lng,severity,minutes_ago,street) SELECT ('20000000-0000-4000-8000-'||lpad(v.n::text,12,'0'))::uuid,v.type,'Demo: '||v.type||' reported near '||v.street||'. Illustrative, not a live report.',v.lat,v.lng,v.severity,v.age,v.street FROM (VALUES
(1,'aggressive behavior',37.7861,-122.4058,3,6,'Market St'),(2,'altercation',37.78705,-122.4046,3,12,'Market St'),(3,'blocked sidewalk',37.78799,-122.4034,2,18,'Market St'),(4,'aggressive behavior',37.78525,-122.4068,3,9,'Market St'),(5,'poor lighting',37.7878,-122.402,2,24,'Mission St'),(6,'blocked sidewalk',37.78765,-122.4007,1,30,'Mission St'),(7,'altercation',37.78745,-122.3993,3,15,'Mission St'),(8,'poor lighting',37.78433,-122.4025,1,45,'Howard St'),(9,'blocked sidewalk',37.785,-122.408,1,40,'Powell St'),(10,'poor lighting',37.783,-122.407,2,35,'5th St'),
(11,'aggressive behavior',37.782,-122.410,3,8,'Market St'),(12,'poor lighting',37.781,-122.412,2,18,'6th St'),(13,'blocked sidewalk',37.780,-122.409,1,25,'Howard St'),(14,'altercation',37.779,-122.406,3,14,'Folsom St'),(15,'poor lighting',37.778,-122.403,2,32,'Harrison St'),(16,'blocked sidewalk',37.777,-122.400,1,46,'4th St'),(17,'aggressive behavior',37.781,-122.398,3,11,'3rd St'),(18,'poor lighting',37.783,-122.396,2,29,'Folsom St'),(19,'blocked sidewalk',37.785,-122.394,1,41,'Fremont St'),(20,'altercation',37.787,-122.396,3,22,'Mission St'),
(21,'poor lighting',37.786,-122.414,2,12,'Turk St'),(22,'blocked sidewalk',37.785,-122.416,1,24,'Eddy St'),(23,'aggressive behavior',37.784,-122.418,3,9,'Ellis St'),(24,'altercation',37.783,-122.420,3,17,'Larkin St'),(25,'poor lighting',37.782,-122.417,2,31,'Hyde St'),(26,'blocked sidewalk',37.787,-122.419,1,42,'Leavenworth St'),(27,'aggressive behavior',37.788,-122.415,3,13,'O’Farrell St'),(28,'poor lighting',37.789,-122.412,2,28,'Geary St'),(29,'blocked sidewalk',37.790,-122.410,1,47,'Post St'),(30,'altercation',37.788,-122.408,3,19,'Powell St'),
(31,'poor lighting',37.789,-122.406,2,15,'Sutter St'),(32,'blocked sidewalk',37.790,-122.404,1,26,'Stockton St'),(33,'aggressive behavior',37.791,-122.402,3,10,'Kearny St'),(34,'poor lighting',37.792,-122.400,2,33,'California St'),(35,'blocked sidewalk',37.793,-122.398,1,48,'Montgomery St'),(36,'altercation',37.794,-122.405,3,20,'Bush St'),(37,'poor lighting',37.791,-122.409,2,38,'Grant Ave'),(38,'blocked sidewalk',37.792,-122.412,1,44,'Mason St'),(39,'aggressive behavior',37.793,-122.415,3,16,'Taylor St'),(40,'poor lighting',37.794,-122.418,2,30,'Jones St'),
(41,'blocked sidewalk',37.800,-122.438,1,14,'Chestnut St'),(42,'poor lighting',37.801,-122.440,2,25,'Lombard St'),(43,'altercation',37.802,-122.442,3,18,'Scott St'),(44,'blocked sidewalk',37.803,-122.436,1,36,'Steiner St'),(45,'poor lighting',37.799,-122.434,2,43,'Union St'),(46,'aggressive behavior',37.798,-122.432,3,11,'Fillmore St'),(47,'blocked sidewalk',37.800,-122.430,1,27,'Buchanan St'),(48,'poor lighting',37.802,-122.428,2,39,'Octavia St'),(49,'altercation',37.799,-122.442,3,21,'Divisadero St'),(50,'poor lighting',37.797,-122.440,2,49,'Greenwich St'),
(51,'blocked sidewalk',37.800,-122.410,1,12,'Columbus Ave'),(52,'poor lighting',37.801,-122.412,2,24,'Grant Ave'),(53,'aggressive behavior',37.802,-122.408,3,8,'Broadway'),(54,'altercation',37.799,-122.406,3,17,'Kearny St'),(55,'poor lighting',37.803,-122.414,2,32,'Stockton St'),(56,'blocked sidewalk',37.804,-122.416,1,45,'Powell St'),(57,'poor lighting',37.798,-122.411,2,36,'Vallejo St'),(58,'aggressive behavior',37.797,-122.409,3,13,'Green St'),(59,'blocked sidewalk',37.805,-122.410,1,29,'Union St'),(60,'poor lighting',37.806,-122.413,2,47,'Filbert St'),
(61,'altercation',37.760,-122.419,3,9,'Mission St'),(62,'poor lighting',37.758,-122.421,2,23,'Valencia St'),(63,'blocked sidewalk',37.756,-122.418,1,38,'24th St'),(64,'aggressive behavior',37.762,-122.420,3,15,'22nd St'),(65,'poor lighting',37.764,-122.422,2,31,'20th St'),(66,'blocked sidewalk',37.766,-122.424,1,46,'18th St'),(67,'altercation',37.768,-122.417,3,19,'16th St'),(68,'poor lighting',37.754,-122.422,2,40,'25th St'),(69,'blocked sidewalk',37.757,-122.425,1,28,'Guerrero St'),(70,'aggressive behavior',37.761,-122.416,3,11,'South Van Ness Ave'),
(71,'poor lighting',37.770,-122.446,2,17,'Haight St'),(72,'blocked sidewalk',37.769,-122.448,1,30,'Cole St'),(73,'aggressive behavior',37.770,-122.450,3,10,'Ashbury St'),(74,'altercation',37.771,-122.452,3,22,'Masonic Ave'),(75,'poor lighting',37.772,-122.444,2,42,'Page St'),(76,'blocked sidewalk',37.773,-122.442,1,48,'Oak St'),(77,'poor lighting',37.776,-122.438,2,26,'Divisadero St'),(78,'aggressive behavior',37.778,-122.440,3,12,'Fulton St'),(79,'blocked sidewalk',37.774,-122.436,1,35,'Hayes St'),(80,'poor lighting',37.771,-122.434,2,44,'Scott St'),
(81,'blocked sidewalk',37.782,-122.462,1,16,'Clement St'),(82,'poor lighting',37.781,-122.465,2,28,'Geary Blvd'),(83,'altercation',37.780,-122.468,3,20,'6th Ave'),(84,'blocked sidewalk',37.783,-122.472,1,39,'10th Ave'),(85,'poor lighting',37.784,-122.478,2,46,'California St'),(86,'aggressive behavior',37.780,-122.482,3,13,'Geary Blvd'),(87,'blocked sidewalk',37.782,-122.488,1,32,'Clement St'),(88,'poor lighting',37.776,-122.464,2,41,'Balboa St'),(89,'altercation',37.778,-122.475,3,18,'Anza St'),(90,'blocked sidewalk',37.780,-122.495,1,50,'25th Ave'),
(91,'poor lighting',37.763,-122.466,2,14,'Irving St'),(92,'blocked sidewalk',37.762,-122.470,1,27,'9th Ave'),(93,'aggressive behavior',37.760,-122.477,3,9,'Judah St'),(94,'poor lighting',37.758,-122.485,2,34,'Noriega St'),(95,'altercation',37.756,-122.490,3,21,'19th Ave'),(96,'blocked sidewalk',37.754,-122.495,1,45,'Taraval St'),(97,'poor lighting',37.779,-122.415,2,24,'Market St'),(98,'aggressive behavior',37.778,-122.417,3,12,'Polk St'),(99,'blocked sidewalk',37.777,-122.419,1,37,'Grove St'),(100,'poor lighting',37.776,-122.421,2,48,'Hayes St')
) AS v(n,type,lat,lng,severity,age,street) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.safe_stops(id,name,lat,lng,address,note,verified,closes_at,specialty,walking_route) SELECT ('30000000-0000-4000-8000-'||lpad(v.n::text,12,'0'))::uuid,v.name,v.lat,v.lng,v.address,'Demo listing: approximate pin; hours and partnership badge are illustrative. Confirm access with staff.',v.verified,v.closes,v.specialty,v.path::jsonb FROM (VALUES
(1,'Blue Bottle Coffee · Mint Plaza',37.78255,-122.4077,'66 Mint St',true,21,'Coffee','[[-122.40785,37.78443],[-122.407,37.78375],[-122.4073,37.7832],[-122.4077,37.78255]]'),
(2,'Sightglass Coffee · SoMa',37.77696,-122.40847,'270 7th St',true,23,'Coffee','[[-122.40785,37.78443],[-122.407,37.78375],[-122.410,37.7814],[-122.40847,37.77696]]'),
(3,'The Palace Hotel',37.7881,-122.402,'2 New Montgomery St',true,24,'Lobby','[[-122.40785,37.78443],[-122.407,37.78375],[-122.404,37.78414],[-122.4025,37.78433],[-122.402,37.7858],[-122.402,37.7881]]'),
(4,'Salesforce Transit Center Café',37.789,-122.3965,'425 Mission St',true,23,'Coffee','[[-122.40785,37.78443],[-122.407,37.78375],[-122.404,37.78414],[-122.4007,37.78455],[-122.399,37.786],[-122.397,37.7863],[-122.3965,37.789]]'),
(5,'The Clancy',37.7821,-122.3993,'299 2nd St',false,24,'Lobby','[[-122.40785,37.78443],[-122.407,37.78375],[-122.404,37.78414],[-122.401,37.78452],[-122.3993,37.7821]]'),
(6,'SOMA Restaurant & Bar',37.7814,-122.404,'85 5th St',false,23,'Food','[[-122.40785,37.78443],[-122.407,37.78375],[-122.404,37.7814]]'),
(7,'The Mill',37.7764,-122.4378,'736 Divisadero St',true,21,'Coffee','[]'),
(8,'Bean Bag Cafe',37.7759,-122.4379,'601 Divisadero St',false,23,'Food','[]'),
(9,'Nopa',37.7749,-122.4375,'560 Divisadero St',true,24,'Food','[]'),
(10,'Matching Half',37.7787,-122.4427,'1799 McAllister St',false,22,'Coffee','[]'),
(11,'The Social Study',37.7847,-122.432,'1795 Geary Blvd',false,24,'Food','[]'),
(12,'Jane on Fillmore',37.7891,-122.4336,'2123 Fillmore St',true,21,'Coffee','[]'),
(13,'Absinthe Brasserie',37.7769,-122.4234,'398 Hayes St',true,23,'Food','[]'),
(14,'Ritual Coffee · Hayes',37.7763,-122.4245,'432B Octavia St',false,21,'Coffee','[]'),
(15,'Souvla · Hayes',37.7766,-122.424,'517 Hayes St',false,23,'Food','[]'),
(16,'Tartine Bakery',37.7614,-122.4241,'600 Guerrero St',true,21,'Pastries','[]'),
(17,'Bi-Rite Market',37.7615,-122.4242,'3639 18th St',true,22,'Groceries','[]'),
(18,'La Taqueria',37.7509,-122.418,'2889 Mission St',false,23,'Food','[]'),
(19,'Ritual Coffee · Valencia',37.7565,-122.4215,'1026 Valencia St',false,21,'Coffee','[]'),
(20,'The Interval at Long Now',37.8077,-122.4329,'2 Marina Blvd',false,24,'Coffee','[]'),
(21,'Tacolicious · Marina',37.8001,-122.4404,'2250 Chestnut St',true,23,'Food','[]'),
(22,'Caffe Trieste',37.7987,-122.4073,'601 Vallejo St',true,22,'Coffee','[]'),
(23,'City Lights Booksellers',37.7976,-122.4066,'261 Columbus Ave',false,22,'Books','[]'),
(24,'Vesuvio Cafe',37.7976,-122.4065,'255 Columbus Ave',false,24,'Food','[]'),
(25,'The Booksmith',37.7701,-122.4508,'1727 Haight St',true,21,'Books','[]'),
(26,'Coffee to the People',37.7697,-122.4522,'1206 Masonic Ave',false,22,'Coffee','[]'),
(27,'Lookout',37.7646,-122.432,'3600 16th St',false,24,'Food','[]'),
(28,'Duboce Park Cafe',37.769,-122.4335,'2 Sanchez St',true,21,'Coffee','[]'),
(29,'High Treason',37.7829,-122.4641,'443 Clement St',false,24,'Food','[]'),
(30,'The Plough and the Stars',37.7825,-122.4673,'116 Clement St',false,24,'Food','[]'),
(31,'Arizmendi Bakery · Sunset',37.7637,-122.4661,'1331 9th Ave',true,21,'Pastries','[]'),
(32,'Java Beach Cafe',37.7604,-122.5088,'1396 La Playa St',false,23,'Coffee','[]')
) AS v(n,name,lat,lng,address,verified,closes,specialty,path) ON CONFLICT(id) DO NOTHING;
INSERT INTO public.ai_access_state(id,blocked) VALUES (1,false) ON CONFLICT(id) DO NOTHING;