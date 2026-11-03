
CREATE OR REPLACE FUNCTION public.tech_role(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.role::text FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.user_id=_uid AND p.active $$;
CREATE OR REPLACE FUNCTION public.tech_manages(_uid uuid, _sector int) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.user_id=_uid AND p.active AND (m.role='capitao' OR (m.role='gerente' AND m.sector_id=_sector))) $$;
CREATE OR REPLACE FUNCTION public.tech_any_manager(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.tech_role(_uid) IN ('capitao','gerente') $$;

CREATE TABLE public.aircraft (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), project text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);
CREATE TABLE public.aircraft_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aircraft_id uuid NOT NULL REFERENCES public.aircraft(id),
  category text NOT NULL CHECK (category IN ('geometria','massas_cg','aerodinamica','propulsao','eletrica','desempenho','estabilidade','estruturas','cargas','outros')),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), unit text NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 30),
  value numeric, text_value text, origin text CHECK (origin IN ('estimado','calculado','medido')), note text,
  version int NOT NULL DEFAULT 1, updated_by uuid NOT NULL DEFAULT auth.uid(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);
CREATE UNIQUE INDEX aircraft_parameters_unique ON public.aircraft_parameters(aircraft_id, category, lower(name)) WHERE archived_at IS NULL;
CREATE TABLE public.aircraft_parameter_history (id bigserial PRIMARY KEY, parameter_id uuid NOT NULL REFERENCES public.aircraft_parameters(id), aircraft_id uuid NOT NULL, version int NOT NULL, name text NOT NULL, unit text NOT NULL, old_value text, new_value text, origin text, note text, changed_by uuid NOT NULL, changed_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aircraft_id uuid REFERENCES public.aircraft(id), sector_id int NOT NULL REFERENCES public.sectors(id),
  flown_at timestamptz NOT NULL, location text NOT NULL CHECK (length(trim(location))>0), pilot text NOT NULL CHECK (length(trim(pilot))>0),
  configuration text, duration_min numeric CHECK (duration_min IS NULL OR duration_min>0), objective text NOT NULL CHECK (length(trim(objective))>0),
  weather text, observations text, results text, incidents text, test_id uuid REFERENCES public.tests(id), problem_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);
CREATE TABLE public.flight_contributors (flight_id uuid NOT NULL REFERENCES public.flights(id), user_id uuid NOT NULL REFERENCES public.profiles(id), added_by uuid NOT NULL DEFAULT auth.uid(), PRIMARY KEY(flight_id,user_id));
CREATE TABLE public.flight_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), flight_id uuid NOT NULL REFERENCES public.flights(id), author_id uuid NOT NULL DEFAULT auth.uid(), body text NOT NULL CHECK (length(trim(body))>0), created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.fabrication_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aircraft_id uuid REFERENCES public.aircraft(id), parent_id uuid REFERENCES public.fabrication_items(id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), sector_id int NOT NULL REFERENCES public.sectors(id), responsible_id uuid NOT NULL REFERENCES public.profiles(id),
  description text, status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','awaiting_fix','done')),
  start_date date, due_date date, done_date date, task_id uuid REFERENCES public.tasks(id), observations text,
  created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);

CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code int GENERATED ALWAYS AS IDENTITY, title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  description text NOT NULL CHECK (length(trim(description))>0), occurred_on date NOT NULL DEFAULT current_date, sector_id int NOT NULL REFERENCES public.sectors(id),
  scope text NOT NULL CHECK (scope IN ('aeronave','equipamento','processo','evento')), criticality text NOT NULL CHECK (criticality IN ('baixa','media','alta','critica')),
  circumstances text, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','triage','in_progress','resolved','closed')),
  triage_by uuid REFERENCES public.profiles(id), actions text, solution text, closure_note text,
  task_id uuid REFERENCES public.tasks(id), test_id uuid REFERENCES public.tests(id), flight_id uuid REFERENCES public.flights(id), fabrication_id uuid REFERENCES public.fabrication_items(id),
  created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz);
ALTER TABLE public.flights ADD CONSTRAINT flights_problem_fk FOREIGN KEY (problem_id) REFERENCES public.problems(id);

CREATE TABLE public.knowledge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('decisao','solucao','experiencia','problema','relatorio','documento','material','aprendizado')),
  sector_id int NOT NULL REFERENCES public.sectors(id), subject text NOT NULL CHECK (length(trim(subject))>0), aircraft_id uuid REFERENCES public.aircraft(id),
  entry_date date NOT NULL DEFAULT current_date, body text NOT NULL CHECK (length(trim(body))>0), refs text,
  search tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(title,'')||' '||coalesce(subject,'')||' '||coalesce(body,'')||' '||coalesce(refs,''))) STORED,
  created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);
CREATE INDEX knowledge_search_idx ON public.knowledge_entries USING gin(search);

CREATE TABLE public.training_resources (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sector_id int NOT NULL REFERENCES public.sectors(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160), description text, link text, criterion text, qualification text, created_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz);
CREATE TABLE public.training_completions (resource_id uuid NOT NULL REFERENCES public.training_resources(id), user_id uuid NOT NULL REFERENCES public.profiles(id), completed_on date NOT NULL DEFAULT current_date, note text, recorded_by uuid NOT NULL DEFAULT auth.uid(), recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(resource_id,user_id));

CREATE TABLE public.technical_history (id bigserial PRIMARY KEY, kind text NOT NULL, record_id uuid NOT NULL, action text NOT NULL, changes jsonb NOT NULL DEFAULT '{}', actor uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX technical_history_record ON public.technical_history(kind, record_id);
CREATE TABLE public.technical_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK (kind IN ('flight','fabrication','problem','knowledge','training')), record_id uuid NOT NULL, path text NOT NULL UNIQUE, name text NOT NULL, uploaded_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());

-- write-authority helper per record
CREATE OR REPLACE FUNCTION public.tech_can_write(_kind text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE _kind
    WHEN 'flight' THEN EXISTS(SELECT 1 FROM flights f WHERE f.id=_id AND (tech_manages(auth.uid(), f.sector_id) OR EXISTS(SELECT 1 FROM flight_contributors c WHERE c.flight_id=f.id AND c.user_id=auth.uid() AND is_active_member(auth.uid()))))
    WHEN 'fabrication' THEN EXISTS(SELECT 1 FROM fabrication_items f WHERE f.id=_id AND (tech_manages(auth.uid(), f.sector_id) OR (f.responsible_id=auth.uid() AND is_active_member(auth.uid()))))
    WHEN 'problem' THEN EXISTS(SELECT 1 FROM problems p WHERE p.id=_id AND (tech_manages(auth.uid(), p.sector_id) OR (p.created_by=auth.uid() AND is_active_member(auth.uid()))))
    WHEN 'knowledge' THEN EXISTS(SELECT 1 FROM knowledge_entries k WHERE k.id=_id AND tech_manages(auth.uid(), k.sector_id))
    WHEN 'training' THEN EXISTS(SELECT 1 FROM training_resources t WHERE t.id=_id AND tech_manages(auth.uid(), t.sector_id))
    ELSE false END $$;

-- history / validation triggers
CREATE OR REPLACE FUNCTION public.tech_param_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.aircraft_id<>OLD.aircraft_id THEN RAISE EXCEPTION 'Não é possível mover o parâmetro para outra aeronave.'; END IF;
    NEW.version := OLD.version+1; NEW.updated_at := now(); NEW.updated_by := coalesce(auth.uid(), OLD.updated_by);
  END IF;
  IF NEW.value IS NOT NULL AND NEW.text_value IS NOT NULL THEN RAISE EXCEPTION 'Informe valor numérico ou textual, não ambos.'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER aircraft_parameters_before BEFORE INSERT OR UPDATE ON public.aircraft_parameters FOR EACH ROW EXECUTE FUNCTION public.tech_param_history();
CREATE OR REPLACE FUNCTION public.tech_param_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO aircraft_parameter_history(parameter_id, aircraft_id, version, name, unit, old_value, new_value, origin, note, changed_by)
  VALUES (NEW.id, NEW.aircraft_id, NEW.version, NEW.name, NEW.unit,
    CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.value::text, OLD.text_value) END,
    CASE WHEN NEW.archived_at IS NOT NULL THEN 'Arquivado' ELSE coalesce(NEW.value::text, NEW.text_value) END,
    NEW.origin, NEW.note, NEW.updated_by);
  INSERT INTO audit_log(actor_id, area, action, details) VALUES (NEW.updated_by, 'operacional', 'aircraft_parameter_'||lower(TG_OP), jsonb_build_object('parameter', NEW.id, 'name', NEW.name, 'version', NEW.version));
  RETURN NEW;
END $$;
CREATE TRIGGER aircraft_parameters_after AFTER INSERT OR UPDATE ON public.aircraft_parameters FOR EACH ROW EXECUTE FUNCTION public.tech_param_log();

CREATE OR REPLACE FUNCTION public.tech_record_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE manager boolean;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at THEN RAISE EXCEPTION 'Autoria não pode ser alterada.'; END IF;
    NEW.updated_at := now();
  END IF;
  IF TG_TABLE_NAME='problems' THEN
    manager := tech_manages(auth.uid(), CASE WHEN TG_OP='UPDATE' THEN OLD.sector_id ELSE NEW.sector_id END);
    IF TG_OP='INSERT' AND NOT manager THEN NEW.status:='open'; NEW.triage_by:=NULL; NEW.closure_note:=NULL; NEW.solution:=NULL; END IF;
    IF TG_OP='UPDATE' AND NOT manager AND (NEW.status<>OLD.status OR NEW.triage_by IS DISTINCT FROM OLD.triage_by OR NEW.closure_note IS DISTINCT FROM OLD.closure_note OR NEW.sector_id<>OLD.sector_id) THEN RAISE EXCEPTION 'Somente a gerência do setor ou o capitão fazem a triagem e o fechamento.'; END IF;
    IF TG_OP='UPDATE' AND NOT manager AND OLD.status<>'open' THEN RAISE EXCEPTION 'Problema já em triagem: somente a gerência edita.'; END IF;
    IF NEW.status='closed' AND length(trim(coalesce(NEW.closure_note,'')))=0 THEN RAISE EXCEPTION 'Documente o fechamento do problema.'; END IF;
    IF NEW.status='closed' AND (TG_OP='INSERT' OR OLD.status<>'closed') THEN NEW.closed_at:=now(); ELSIF NEW.status<>'closed' THEN NEW.closed_at:=NULL; END IF;
  ELSIF TG_TABLE_NAME='fabrication_items' THEN
    IF TG_OP='UPDATE' AND NOT tech_manages(auth.uid(), OLD.sector_id) AND (NEW.sector_id<>OLD.sector_id OR NEW.responsible_id<>OLD.responsible_id OR NEW.name<>OLD.name OR NEW.archived_at IS DISTINCT FROM OLD.archived_at OR NEW.parent_id IS DISTINCT FROM OLD.parent_id) THEN RAISE EXCEPTION 'O responsável só atualiza estado, datas e observações.'; END IF;
    IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Componente não pode ser subcomponente de si mesmo.'; END IF;
    IF NOT is_active_member(NEW.responsible_id) THEN RAISE EXCEPTION 'Responsável precisa estar ativo.'; END IF;
  ELSIF TG_TABLE_NAME='flights' THEN
    IF TG_OP='UPDATE' AND NOT tech_manages(auth.uid(), OLD.sector_id) THEN RAISE EXCEPTION 'Somente a gerência responsável e o capitão editam o voo; participantes registram observações.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER problems_guard BEFORE INSERT OR UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.tech_record_guard();
CREATE TRIGGER fabrication_guard BEFORE INSERT OR UPDATE ON public.fabrication_items FOR EACH ROW EXECUTE FUNCTION public.tech_record_guard();
CREATE TRIGGER flights_guard BEFORE INSERT OR UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.tech_record_guard();
CREATE TRIGGER knowledge_guard BEFORE INSERT OR UPDATE ON public.knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.tech_record_guard();

CREATE OR REPLACE FUNCTION public.tech_history_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE diff jsonb := '{}'; k text; o jsonb; n jsonb; kind text := CASE TG_TABLE_NAME WHEN 'flights' THEN 'flight' WHEN 'fabrication_items' THEN 'fabrication' WHEN 'problems' THEN 'problem' WHEN 'knowledge_entries' THEN 'knowledge' ELSE 'training' END;
BEGIN
  n := to_jsonb(NEW) - 'search' - 'updated_at';
  IF TG_OP='UPDATE' THEN
    o := to_jsonb(OLD) - 'search' - 'updated_at';
    FOR k IN SELECT jsonb_object_keys(n) LOOP
      IF n->k IS DISTINCT FROM o->k THEN diff := diff || jsonb_build_object(k, jsonb_build_object('de', o->k, 'para', n->k)); END IF;
    END LOOP;
    IF diff='{}' THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO technical_history(kind, record_id, action, changes, actor) VALUES (kind, NEW.id, lower(TG_OP), diff, auth.uid());
  INSERT INTO audit_log(actor_id, area, action, details) VALUES (auth.uid(), 'operacional', kind||'_'||lower(TG_OP), jsonb_build_object('id', NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER flights_history AFTER INSERT OR UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.tech_history_log();
CREATE TRIGGER fabrication_history AFTER INSERT OR UPDATE ON public.fabrication_items FOR EACH ROW EXECUTE FUNCTION public.tech_history_log();
CREATE TRIGGER problems_history AFTER INSERT OR UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.tech_history_log();
CREATE TRIGGER knowledge_history AFTER INSERT OR UPDATE ON public.knowledge_entries FOR EACH ROW EXECUTE FUNCTION public.tech_history_log();
CREATE TRIGGER training_history AFTER INSERT OR UPDATE ON public.training_resources FOR EACH ROW EXECUTE FUNCTION public.tech_history_log();

-- grants (no delete: records are archived, never removed)
GRANT SELECT, INSERT, UPDATE ON public.aircraft, public.aircraft_parameters, public.flights, public.fabrication_items, public.problems, public.knowledge_entries, public.training_resources TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.flight_contributors TO authenticated;
GRANT SELECT, INSERT ON public.flight_notes, public.technical_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_completions TO authenticated;
GRANT SELECT ON public.aircraft_parameter_history, public.technical_history TO authenticated;
GRANT ALL ON public.aircraft, public.aircraft_parameters, public.aircraft_parameter_history, public.flights, public.flight_contributors, public.flight_notes, public.fabrication_items, public.problems, public.knowledge_entries, public.training_resources, public.training_completions, public.technical_history, public.technical_files TO service_role;
GRANT USAGE ON SEQUENCE public.aircraft_parameter_history_id_seq, public.technical_history_id_seq TO service_role;

ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aircraft_parameter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technical_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read aircraft" ON public.aircraft FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add aircraft" ON public.aircraft FOR INSERT TO authenticated WITH CHECK (tech_any_manager(auth.uid()) AND created_by=auth.uid());
CREATE POLICY "managers edit aircraft" ON public.aircraft FOR UPDATE TO authenticated USING (tech_any_manager(auth.uid())) WITH CHECK (tech_any_manager(auth.uid()));
CREATE POLICY "members read parameters" ON public.aircraft_parameters FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add parameters" ON public.aircraft_parameters FOR INSERT TO authenticated WITH CHECK (tech_any_manager(auth.uid()) AND updated_by=auth.uid());
CREATE POLICY "managers edit parameters" ON public.aircraft_parameters FOR UPDATE TO authenticated USING (tech_any_manager(auth.uid())) WITH CHECK (tech_any_manager(auth.uid()));
CREATE POLICY "members read parameter history" ON public.aircraft_parameter_history FOR SELECT TO authenticated USING (is_active_member(auth.uid()));

CREATE POLICY "members read flights" ON public.flights FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add flights" ON public.flights FOR INSERT TO authenticated WITH CHECK (tech_manages(auth.uid(), sector_id) AND created_by=auth.uid());
CREATE POLICY "managers edit flights" ON public.flights FOR UPDATE TO authenticated USING (tech_manages(auth.uid(), sector_id)) WITH CHECK (tech_manages(auth.uid(), sector_id));
CREATE POLICY "members read contributors" ON public.flight_contributors FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add contributors" ON public.flight_contributors FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM flights f WHERE f.id=flight_id AND tech_manages(auth.uid(), f.sector_id)));
CREATE POLICY "managers remove contributors" ON public.flight_contributors FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM flights f WHERE f.id=flight_id AND tech_manages(auth.uid(), f.sector_id)));
CREATE POLICY "members read flight notes" ON public.flight_notes FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "authorized add flight notes" ON public.flight_notes FOR INSERT TO authenticated WITH CHECK (author_id=auth.uid() AND tech_can_write('flight', flight_id));

CREATE POLICY "members read fabrication" ON public.fabrication_items FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add fabrication" ON public.fabrication_items FOR INSERT TO authenticated WITH CHECK (tech_manages(auth.uid(), sector_id) AND created_by=auth.uid());
CREATE POLICY "authorized edit fabrication" ON public.fabrication_items FOR UPDATE TO authenticated USING (tech_can_write('fabrication', id)) WITH CHECK (is_active_member(auth.uid()));

CREATE POLICY "members read problems" ON public.problems FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "members report problems" ON public.problems FOR INSERT TO authenticated WITH CHECK (is_active_member(auth.uid()) AND created_by=auth.uid());
CREATE POLICY "authorized edit problems" ON public.problems FOR UPDATE TO authenticated USING (tech_can_write('problem', id)) WITH CHECK (is_active_member(auth.uid()));

CREATE POLICY "members read knowledge" ON public.knowledge_entries FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add knowledge" ON public.knowledge_entries FOR INSERT TO authenticated WITH CHECK (tech_manages(auth.uid(), sector_id) AND created_by=auth.uid());
CREATE POLICY "managers edit knowledge" ON public.knowledge_entries FOR UPDATE TO authenticated USING (tech_manages(auth.uid(), sector_id)) WITH CHECK (tech_manages(auth.uid(), sector_id));

CREATE POLICY "members read training" ON public.training_resources FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "managers add training" ON public.training_resources FOR INSERT TO authenticated WITH CHECK (tech_manages(auth.uid(), sector_id) AND created_by=auth.uid());
CREATE POLICY "managers edit training" ON public.training_resources FOR UPDATE TO authenticated USING (tech_manages(auth.uid(), sector_id)) WITH CHECK (tech_manages(auth.uid(), sector_id));
CREATE POLICY "own or managed completions" ON public.training_completions FOR SELECT TO authenticated USING (user_id=auth.uid() OR EXISTS(SELECT 1 FROM training_resources t WHERE t.id=resource_id AND tech_manages(auth.uid(), t.sector_id)));
CREATE POLICY "managers record completions" ON public.training_completions FOR INSERT TO authenticated WITH CHECK (recorded_by=auth.uid() AND EXISTS(SELECT 1 FROM training_resources t WHERE t.id=resource_id AND tech_manages(auth.uid(), t.sector_id)));
CREATE POLICY "managers update completions" ON public.training_completions FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM training_resources t WHERE t.id=resource_id AND tech_manages(auth.uid(), t.sector_id)));
CREATE POLICY "managers remove completions" ON public.training_completions FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM training_resources t WHERE t.id=resource_id AND tech_manages(auth.uid(), t.sector_id)));

CREATE POLICY "members read technical history" ON public.technical_history FOR SELECT TO authenticated USING (is_active_member(auth.uid()) AND kind<>'training' OR EXISTS(SELECT 1 FROM training_resources t WHERE t.id=record_id AND tech_manages(auth.uid(), t.sector_id)));
CREATE POLICY "members read technical files" ON public.technical_files FOR SELECT TO authenticated USING (is_active_member(auth.uid()));
CREATE POLICY "authorized add technical files" ON public.technical_files FOR INSERT TO authenticated WITH CHECK (uploaded_by=auth.uid() AND tech_can_write(kind, record_id) AND path LIKE kind||'/'||record_id::text||'/%');

CREATE POLICY "members read technical storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='technical-files' AND is_active_member(auth.uid()));
CREATE POLICY "authorized upload technical storage" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='technical-files' AND tech_can_write(split_part(name,'/',1), nullif(split_part(name,'/',2),'')::uuid));
