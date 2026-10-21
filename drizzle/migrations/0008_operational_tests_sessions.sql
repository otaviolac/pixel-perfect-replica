ALTER TABLE public.agenda_events ADD COLUMN test_mode text CHECK(test_mode IN ('normal_test','quick_test'));
CREATE TABLE public.test_checklists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version integer GENERATED ALWAYS AS IDENTITY,body text NOT NULL CHECK(length(trim(body))>0),created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.test_checklists TO authenticated; GRANT ALL ON public.test_checklists TO service_role;
ALTER TABLE public.test_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY checklists_read ON public.test_checklists FOR SELECT TO authenticated USING(public.is_active_member(auth.uid()));
CREATE TABLE public.tests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code integer GENERATED ALWAYS AS IDENTITY,title text NOT NULL,type text NOT NULL,objective text NOT NULL,mode text NOT NULL CHECK(mode IN ('normal_test','quick_test')),sector_id smallint NOT NULL REFERENCES public.sectors(id),created_by uuid NOT NULL REFERENCES public.profiles(id),configuration text NOT NULL DEFAULT '',materials text NOT NULL DEFAULT '',equipment text NOT NULL DEFAULT '',procedure text NOT NULL DEFAULT '',observations text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),archived_at timestamptz);
GRANT SELECT ON public.tests TO authenticated; GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.test_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),test_id uuid NOT NULL REFERENCES public.tests(id),event_id uuid UNIQUE NOT NULL REFERENCES public.agenda_events(id),status text NOT NULL CHECK(status IN ('planned','pending','scheduled','running','result_pending','completed','interrupted','cancelled','inconclusive','rejected')),results text NOT NULL DEFAULT '',conditions text NOT NULL DEFAULT '',note text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.test_sessions TO authenticated; GRANT ALL ON public.test_sessions TO service_role;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.test_safety_acknowledgments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES public.test_sessions(id),checklist_id uuid NOT NULL REFERENCES public.test_checklists(id),user_id uuid NOT NULL REFERENCES public.profiles(id),accepted boolean NOT NULL CHECK(accepted),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.test_safety_acknowledgments TO authenticated; GRANT ALL ON public.test_safety_acknowledgments TO service_role;
ALTER TABLE public.test_safety_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.test_sector_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid NOT NULL REFERENCES public.test_sessions(id),sector_id smallint NOT NULL REFERENCES public.sectors(id),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),requested_by uuid NOT NULL REFERENCES public.profiles(id),decided_by uuid REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),decided_at timestamptz,UNIQUE(session_id,sector_id));
GRANT SELECT ON public.test_sector_invitations TO authenticated; GRANT ALL ON public.test_sector_invitations TO service_role;
ALTER TABLE public.test_sector_invitations ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.test_visible(_test uuid,_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_active_member(_uid) AND (EXISTS(SELECT 1 FROM public.tests t WHERE t.id=_test AND (t.created_by=_uid OR public.is_captain(_uid) OR t.sector_id=(SELECT sector_id FROM public.memberships WHERE user_id=_uid))) OR EXISTS(SELECT 1 FROM public.test_sessions s WHERE s.test_id=_test AND public.agenda_visible(s.event_id,_uid)) OR EXISTS(SELECT 1 FROM public.test_sector_invitations i JOIN public.test_sessions s ON s.id=i.session_id JOIN public.memberships m ON m.user_id=_uid WHERE s.test_id=_test AND m.role='gerente' AND m.sector_id=i.sector_id)) $$;
REVOKE ALL ON FUNCTION public.test_visible(uuid,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.test_visible(uuid,uuid) TO authenticated;
CREATE POLICY tests_read ON public.tests FOR SELECT TO authenticated USING(public.test_visible(id,auth.uid()));
CREATE POLICY test_sessions_read ON public.test_sessions FOR SELECT TO authenticated USING(public.test_visible(test_id,auth.uid()));
CREATE POLICY test_ack_read ON public.test_safety_acknowledgments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.test_sessions s WHERE s.id=session_id AND public.test_visible(s.test_id,auth.uid())));
CREATE POLICY test_invites_read ON public.test_sector_invitations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.test_sessions s WHERE s.id=session_id AND public.test_visible(s.test_id,auth.uid())));
CREATE OR REPLACE FUNCTION public.test_command(_action text,_test uuid DEFAULT NULL,_session uuid DEFAULT NULL,_data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r public.operational_role; sector smallint; t public.tests%ROWTYPE; ss public.test_sessions%ROWTYPE; ev public.agenda_events%ROWTYPE; eid uuid; sess uuid; organizer uuid; members uuid[]; v uuid; st text; mode text; checklist uuid; start_time timestamptz; end_time timestamptz; manage boolean; inv public.test_sector_invitations%ROWTYPE;
BEGIN
 IF u IS NULL OR NOT public.is_active_member(u) THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
 SELECT role,sector_id INTO r,sector FROM public.memberships WHERE user_id=u;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags f WHERE f.key='testes' AND f.enabled) THEN RAISE EXCEPTION 'Testes desabilitados. Histórico preservado.'; END IF;
 IF _action='checklist' THEN
  IF r<>'capitao' THEN RAISE EXCEPTION 'Somente o capitão configura regras de segurança.'; END IF;
  INSERT INTO public.test_checklists(body,created_by) VALUES(trim(_data->>'body'),u) RETURNING id INTO checklist;
  INSERT INTO public.audit_log(actor_id,area,action,entity,entity_id) VALUES(u,'operacional','test_checklist','test_checklists',checklist::text); RETURN checklist;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags f WHERE f.key='agenda' AND f.enabled) THEN RAISE EXCEPTION 'Agenda desabilitada.'; END IF;
 PERFORM set_config('app.test_command','on',true);
 IF _action IN ('create','session') THEN
  IF r='trainee' THEN RAISE EXCEPTION 'Trainees não podem criar testes.'; END IF;
  IF _action='create' THEN
   mode:=_data->>'mode'; IF mode IS NULL OR mode NOT IN ('normal_test','quick_test') THEN RAISE EXCEPTION 'Tipo de teste inválido.'; END IF;
   IF length(trim(COALESCE(_data->>'type','')))=0 OR length(trim(COALESCE(_data->>'objective','')))=0 OR length(trim(COALESCE(_data->>'title','')))=0 THEN RAISE EXCEPTION 'Informe nome, tipo e objetivo.'; END IF;
   IF r='capitao' THEN sector:=COALESCE((_data->>'sector_id')::smallint,sector); END IF;
   INSERT INTO public.tests(title,type,objective,mode,sector_id,created_by,configuration,materials,equipment,procedure,observations) VALUES(trim(_data->>'title'),trim(_data->>'type'),trim(_data->>'objective'),mode,sector,u,COALESCE(_data->>'configuration',''),COALESCE(_data->>'materials',''),COALESCE(_data->>'equipment',''),COALESCE(_data->>'procedure',''),COALESCE(_data->>'observations','')) RETURNING * INTO t; _test:=t.id;
  ELSE
   SELECT * INTO t FROM public.tests WHERE id=_test FOR UPDATE;
   IF NOT FOUND OR t.archived_at IS NOT NULL OR NOT (r='capitao' OR (r='gerente' AND t.sector_id=sector) OR (r='membro' AND t.created_by=u AND t.sector_id=sector)) THEN RAISE EXCEPTION 'Sem permissão para adicionar sessão.'; END IF;
   sector:=t.sector_id; mode:=t.mode;
  END IF;
  SELECT id INTO checklist FROM public.test_checklists ORDER BY version DESC LIMIT 1;
  IF checklist IS NULL OR COALESCE((_data->>'safety_accepted')::boolean,false)=false OR (_data->>'checklist_id')::uuid IS DISTINCT FROM checklist THEN RAISE EXCEPTION 'Leia e aceite a versão atual do checklist de segurança.'; END IF;
  organizer:=COALESCE(NULLIF(_data->>'organizer_id','')::uuid,u);
  IF r='membro' AND mode='normal_test' AND organizer<>u THEN RAISE EXCEPTION 'Membro deve ser o responsável inicial de sua proposta.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.memberships m ON m.user_id=p.id WHERE p.id=organizer AND p.active AND (r='capitao' OR m.sector_id=sector)) THEN RAISE EXCEPTION 'Responsável fora da sua autoridade.'; END IF;
  SELECT COALESCE(array_agg(DISTINCT value::uuid),'{}') INTO members FROM jsonb_array_elements_text(COALESCE(_data->'participants','[]'));
  IF EXISTS(SELECT 1 FROM unnest(members) a(id) LEFT JOIN public.profiles p ON p.id=a.id LEFT JOIN public.memberships m ON m.user_id=a.id WHERE p.id IS NULL OR NOT p.active OR (r<>'capitao' AND m.sector_id<>sector)) THEN RAISE EXCEPTION 'Integrantes de outro setor dependem do gerente de origem.'; END IF;
  start_time:=CASE WHEN mode='quick_test' THEN now() ELSE (_data->>'starts_at')::timestamptz END;
  end_time:=CASE WHEN mode='quick_test' THEN start_time+interval '1 hour' ELSE (_data->>'ends_at')::timestamptz END;
  IF start_time IS NULL OR end_time IS NULL THEN RAISE EXCEPTION 'Informe data e horário da sessão.'; END IF;
  st:=CASE WHEN mode='quick_test' THEN 'running' WHEN r='membro' THEN 'pending' ELSE 'scheduled' END;
  INSERT INTO public.agenda_events(title,kind,test_mode,sector_id,organizer_id,created_by,starts_at,ends_at,location,status,agenda) VALUES(t.title,'general',mode,sector,organizer,u,start_time,end_time,trim(_data->>'location'),CASE WHEN st='pending' THEN 'pending' ELSE 'scheduled' END,t.objective) RETURNING id INTO eid;
  INSERT INTO public.test_sessions(test_id,event_id,status,conditions) VALUES(t.id,eid,st,COALESCE(_data->>'conditions','')) RETURNING id INTO sess;
  INSERT INTO public.test_safety_acknowledgments(session_id,checklist_id,user_id,accepted) VALUES(sess,checklist,u,true);
  INSERT INTO public.agenda_invitees(event_id,user_id,kind) SELECT eid,id,CASE WHEN st='pending' THEN 'notice' WHEN mode='normal_test' THEN 'convocation' ELSE 'invitation' END FROM unnest(members) a(id);
  INSERT INTO public.notifications(user_id,event_id,title,body) SELECT id,eid,CASE WHEN st='pending' THEN 'Aviso: teste pendente de aprovação' WHEN mode='quick_test' THEN 'Teste rápido iniciado' ELSE 'Teste agendado' END,t.title FROM unnest(members) a(id);
  INSERT INTO public.notifications(user_id,event_id,title,body) SELECT m.user_id,eid,CASE WHEN st='pending' THEN 'Teste para aprovação' ELSE 'Atividade de teste registrada' END,t.title FROM public.memberships m JOIN public.profiles p ON p.id=m.user_id WHERE p.active AND m.role='gerente' AND m.sector_id=sector AND m.user_id<>u;
  _session:=sess;
 ELSE
  SELECT * INTO t FROM public.tests WHERE id=_test FOR UPDATE;
  IF NOT FOUND OR NOT public.test_visible(t.id,u) THEN RAISE EXCEPTION 'Teste não encontrado.'; END IF;
  SELECT * INTO ss FROM public.test_sessions WHERE id=_session AND test_id=t.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada.'; END IF;
  SELECT * INTO ev FROM public.agenda_events WHERE id=ss.event_id FOR UPDATE;
  manage:=r='capitao' OR (r='gerente' AND (t.sector_id=sector OR ev.organizer_id=u));
  IF _action IN ('approve','reject') THEN
   IF NOT manage OR ss.status<>'pending' THEN RAISE EXCEPTION 'Sem permissão para decidir a proposta.'; END IF;
   st:=CASE WHEN _action='approve' THEN 'scheduled' ELSE 'rejected' END;
   UPDATE public.test_sessions SET status=st,updated_at=now() WHERE id=ss.id;
   UPDATE public.agenda_events SET status=CASE WHEN _action='approve' THEN 'scheduled' ELSE 'rejected' END,archived_at=CASE WHEN _action='reject' THEN now() ELSE NULL END WHERE id=ev.id;
   IF _action='approve' THEN UPDATE public.agenda_invitees SET kind='convocation' WHERE event_id=ev.id AND kind='notice'; END IF;
  ELSIF _action='results' THEN
   IF NOT (manage OR ev.organizer_id=u) OR ss.status IN ('pending','rejected','cancelled') THEN RAISE EXCEPTION 'Sem permissão para registrar resultados.'; END IF;
   UPDATE public.test_sessions SET results=COALESCE(_data->>'results',''),conditions=COALESCE(_data->>'conditions',conditions),note=COALESCE(_data->>'note',note),updated_at=now() WHERE id=ss.id;
  ELSIF _action='status' THEN
   st:=_data->>'status';
   IF NOT (manage OR (ev.organizer_id=u AND st IN ('running','result_pending','completed','inconclusive'))) THEN RAISE EXCEPTION 'Sem permissão para alterar esta sessão.'; END IF;
   IF st IS NULL OR st NOT IN ('running','result_pending','completed','interrupted','cancelled','inconclusive') OR ss.status IN ('pending','rejected','cancelled','completed','interrupted','inconclusive') THEN RAISE EXCEPTION 'Transição indisponível.'; END IF;
   IF st='completed' AND (ss.status NOT IN ('running','result_pending') OR length(trim(ss.results))=0) THEN RAISE EXCEPTION 'Registre resultados do teste realizado antes de concluir.'; END IF;
   IF st='result_pending' AND ss.status<>'running' THEN RAISE EXCEPTION 'Inicie o teste antes de registrar sua realização.'; END IF;
   UPDATE public.test_sessions SET status=st,note=COALESCE(_data->>'note',''),updated_at=now() WHERE id=ss.id;
   UPDATE public.agenda_events SET status=CASE WHEN st IN ('completed','inconclusive') THEN 'completed' WHEN st IN ('cancelled','interrupted') THEN 'cancelled' ELSE 'scheduled' END WHERE id=ev.id;
  ELSIF _action='invite' THEN
   IF NOT manage OR t.mode<>'normal_test' OR ss.status<>'scheduled' OR (_data->>'sector_id')::smallint=t.sector_id THEN RAISE EXCEPTION 'Convite indisponível.'; END IF;
   INSERT INTO public.test_sector_invitations(session_id,sector_id,requested_by) VALUES(ss.id,(_data->>'sector_id')::smallint,u) ON CONFLICT(session_id,sector_id) DO NOTHING;
   INSERT INTO public.notifications(user_id,event_id,title,body) SELECT m.user_id,ev.id,'Solicitação de participação em teste',t.title FROM public.memberships m JOIN public.profiles p ON p.id=m.user_id WHERE p.active AND m.role='gerente' AND m.sector_id=(_data->>'sector_id')::smallint;
  ELSIF _action='decide' THEN
   SELECT * INTO inv FROM public.test_sector_invitations WHERE id=(_data->>'invitation_id')::uuid AND session_id=ss.id FOR UPDATE;
   IF NOT FOUND OR inv.status<>'pending' OR ss.status<>'scheduled' OR NOT (r='capitao' OR (r='gerente' AND sector=inv.sector_id)) THEN RAISE EXCEPTION 'Sem autoridade sobre este convite.'; END IF;
   st:=_data->>'status'; IF st IS NULL OR st NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
   IF st='accepted' THEN
    SELECT COALESCE(array_agg(DISTINCT value::uuid),'{}') INTO members FROM jsonb_array_elements_text(COALESCE(_data->'participants','[]'));
    IF cardinality(members)=0 THEN RAISE EXCEPTION 'Escolha integrantes do setor convidado.'; END IF;
    FOREACH v IN ARRAY members LOOP
     IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.memberships m ON m.user_id=p.id WHERE p.id=v AND p.active AND m.sector_id=inv.sector_id) THEN RAISE EXCEPTION 'Escolha somente integrantes ativos do setor convidado.'; END IF;
     INSERT INTO public.agenda_invitees(event_id,user_id,kind) VALUES(ev.id,v,'convocation') ON CONFLICT(event_id,user_id) DO UPDATE SET kind='convocation';
     INSERT INTO public.notifications(user_id,event_id,title,body) VALUES(v,ev.id,'Convocação para teste',t.title);
    END LOOP;
   END IF;
   UPDATE public.test_sector_invitations SET status=st,decided_by=u,decided_at=now() WHERE id=inv.id;
   INSERT INTO public.notifications(user_id,event_id,title,body) VALUES(inv.requested_by,ev.id,'Convite de teste respondido',t.title);
  ELSIF _action='archive' THEN
   IF NOT manage OR EXISTS(SELECT 1 FROM public.test_sessions s WHERE s.test_id=t.id AND s.status IN ('pending','scheduled','running','result_pending')) THEN RAISE EXCEPTION 'Finalize as sessões antes de arquivar.'; END IF;
   UPDATE public.tests SET archived_at=now() WHERE id=t.id;
   UPDATE public.agenda_events SET archived_at=now() WHERE id IN(SELECT event_id FROM public.test_sessions WHERE test_id=t.id);
  ELSE RAISE EXCEPTION 'Ação inválida.'; END IF;
  eid:=ev.id;
  IF _action IN ('approve','reject','status') THEN INSERT INTO public.notifications(user_id,event_id,title,body) SELECT user_id,ev.id,'Situação do teste atualizada',t.title FROM public.agenda_invitees WHERE event_id=ev.id; END IF;
 END IF;
 INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(eid,u,'test_'||_action,_data-'results'-'body');
 INSERT INTO public.audit_log(actor_id,area,action,entity,entity_id,details) VALUES(u,'operacional','test_'||_action,'tests',_test::text,jsonb_build_object('session_id',_session,'status',st));
 RETURN _test;
END $$;
REVOKE ALL ON FUNCTION public.test_command(text,uuid,uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.test_command(text,uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.protect_test_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.test_mode IS NOT NULL AND COALESCE(current_setting('app.test_command',true),'')<>'on' AND (TG_OP='INSERT' OR ROW(NEW.title,NEW.starts_at,NEW.ends_at,NEW.location,NEW.status,NEW.organizer_id,NEW.sector_id,NEW.archived_at) IS DISTINCT FROM ROW(OLD.title,OLD.starts_at,OLD.ends_at,OLD.location,OLD.status,OLD.organizer_id,OLD.sector_id,OLD.archived_at)) THEN RAISE EXCEPTION 'Gerencie este evento pela ficha do teste.'; END IF;
 IF NEW.test_mode='quick_test' AND NEW.attendance_enabled THEN RAISE EXCEPTION 'Testes rápidos não têm chamada de assiduidade.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_test_event BEFORE INSERT OR UPDATE ON public.agenda_events FOR EACH ROW EXECUTE FUNCTION public.protect_test_event();