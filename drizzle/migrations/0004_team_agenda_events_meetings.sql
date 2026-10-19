CREATE TABLE public.agenda_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, kind text NOT NULL CHECK (kind IN ('meeting','general')), sector_id smallint NOT NULL REFERENCES public.sectors(id), organizer_id uuid NOT NULL REFERENCES public.profiles(id), created_by uuid NOT NULL REFERENCES public.profiles(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, location text NOT NULL, agenda text NOT NULL DEFAULT '', minutes text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('pending','scheduled','completed','cancelled','rejected')), team_wide boolean NOT NULL DEFAULT false, series_id uuid, recurrence text NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','weekly','monthly')), archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agenda_events TO authenticated;
GRANT ALL ON public.agenda_events TO service_role;
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.agenda_invitees (
 event_id uuid NOT NULL REFERENCES public.agenda_events(id), user_id uuid NOT NULL REFERENCES public.profiles(id), kind text NOT NULL DEFAULT 'invitation' CHECK(kind IN ('invitation','notice','convocation')), response text NOT NULL DEFAULT 'pending' CHECK(response IN ('pending','yes','no')), responded_at timestamptz, PRIMARY KEY(event_id,user_id)
);
GRANT SELECT ON public.agenda_invitees TO authenticated;
GRANT ALL ON public.agenda_invitees TO service_role;
ALTER TABLE public.agenda_invitees ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.agenda_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.agenda_events(id), actor_id uuid NOT NULL REFERENCES public.profiles(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agenda_history TO authenticated;
GRANT ALL ON public.agenda_history TO service_role;
ALTER TABLE public.agenda_history ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.agenda_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.agenda_events(id), path text NOT NULL UNIQUE, name text NOT NULL, uploaded_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agenda_files TO authenticated;
GRANT ALL ON public.agenda_files TO service_role;
ALTER TABLE public.agenda_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ADD COLUMN event_id uuid REFERENCES public.agenda_events(id);
CREATE INDEX agenda_events_date_idx ON public.agenda_events(starts_at);
CREATE INDEX agenda_invitees_user_idx ON public.agenda_invitees(user_id,event_id);
CREATE OR REPLACE FUNCTION public.agenda_manage(_event uuid,_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND (public.is_captain(_uid) OR EXISTS(SELECT 1 FROM public.agenda_events e JOIN public.memberships m ON m.user_id=_uid WHERE e.id=_event AND m.role='gerente' AND (e.sector_id=m.sector_id OR e.organizer_id=_uid OR e.created_by=_uid)))
$$;
CREATE OR REPLACE FUNCTION public.agenda_visible(_event uuid,_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND EXISTS(SELECT 1 FROM public.agenda_events e WHERE e.id=_event AND (public.is_captain(_uid) OR e.team_wide OR e.created_by=_uid OR e.organizer_id=_uid OR e.sector_id=(SELECT m.sector_id FROM public.memberships m WHERE m.user_id=_uid) OR EXISTS(SELECT 1 FROM public.agenda_invitees i WHERE i.event_id=e.id AND i.user_id=_uid)))
$$;
CREATE POLICY agenda_events_read ON public.agenda_events FOR SELECT TO authenticated USING(public.agenda_visible(id,auth.uid()));
CREATE POLICY agenda_invitees_read ON public.agenda_invitees FOR SELECT TO authenticated USING(public.agenda_visible(event_id,auth.uid()));
CREATE POLICY agenda_history_read ON public.agenda_history FOR SELECT TO authenticated USING(public.agenda_visible(event_id,auth.uid()));
CREATE POLICY agenda_files_read ON public.agenda_files FOR SELECT TO authenticated USING(public.agenda_visible(event_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.validate_agenda_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF length(trim(NEW.title))=0 OR length(NEW.title)>160 OR length(trim(NEW.location))=0 THEN RAISE EXCEPTION 'Informe título e local.'; END IF;
 IF NEW.ends_at<=NEW.starts_at THEN RAISE EXCEPTION 'O término deve ser posterior ao início.'; END IF;
 IF NOT public.is_active_member(NEW.organizer_id) THEN RAISE EXCEPTION 'Responsável deve ser um integrante ativo.'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_agenda_event BEFORE INSERT OR UPDATE ON public.agenda_events FOR EACH ROW EXECUTE FUNCTION public.validate_agenda_event();
CREATE OR REPLACE FUNCTION public.agenda_command(_action text,_event uuid DEFAULT NULL,_data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 u uuid:=auth.uid(); r public.operational_role; s smallint; e public.agenda_events%ROWTYPE; eid uuid; sid uuid; organizer uuid; sector smallint; people uuid[]; invitation text; st text; n int; step int; start_time timestamptz; end_time timestamptz; rec text; team boolean; manage boolean;
BEGIN
 IF u IS NULL OR NOT public.is_active_member(u) THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='agenda' AND enabled) THEN RAISE EXCEPTION 'Agenda desabilitada.'; END IF;
 SELECT role,sector_id INTO r,s FROM public.memberships WHERE user_id=u;
 IF _action='create' THEN
  IF r='trainee' THEN RAISE EXCEPTION 'Trainees não podem agendar eventos ou reuniões.'; END IF;
  IF _data->>'kind' NOT IN ('meeting','general') OR _data->>'kind' IS NULL THEN RAISE EXCEPTION 'Tipo inválido.'; END IF;
  IF _data->>'kind'='meeting' AND NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='reunioes' AND enabled) THEN RAISE EXCEPTION 'Reuniões desabilitadas.'; END IF;
  IF r='membro' AND _data->>'kind'<>'meeting' THEN RAISE EXCEPTION 'Membros podem propor apenas reuniões do próprio setor.'; END IF;
  sector:=COALESCE((_data->>'sector_id')::smallint,s); organizer:=COALESCE((_data->>'organizer_id')::uuid,u); team:=COALESCE((_data->>'team_wide')::boolean,false);
  IF r<>'capitao' AND sector<>s THEN RAISE EXCEPTION 'Setor fora da sua autoridade.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.profiles p ON p.id=m.user_id WHERE p.active AND m.user_id=organizer AND (r='capitao' OR m.sector_id=s)) THEN RAISE EXCEPTION 'Responsável fora da sua autoridade.'; END IF;
  IF r='membro' AND (organizer<>u OR team) THEN RAISE EXCEPTION 'Proponha reunião apenas no próprio setor, com você como responsável.'; END IF;
  SELECT COALESCE(array_agg(DISTINCT value::uuid),'{}') INTO people FROM jsonb_array_elements_text(COALESCE(_data->'invitees','[]'));
  IF team THEN SELECT array_agg(id) INTO people FROM public.profiles WHERE active; END IF;
  IF cardinality(people)=0 THEN RAISE EXCEPTION 'Selecione pelo menos um convidado.'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(people) p(id) LEFT JOIN public.profiles pr ON pr.id=p.id LEFT JOIN public.memberships m ON m.user_id=p.id WHERE pr.id IS NULL OR NOT pr.active OR (r='membro' AND m.sector_id<>s)) THEN RAISE EXCEPTION 'Convidados devem ser ativos e membros só podem convidar seu próprio setor.'; END IF;
  invitation:=COALESCE(_data->>'invite_kind','invitation');
  IF invitation NOT IN ('notice','invitation','convocation') OR (r='membro' AND invitation='convocation') THEN RAISE EXCEPTION 'Tipo de convite não permitido.'; END IF;
  rec:=COALESCE(_data->>'recurrence','none'); n:=COALESCE((_data->>'occurrences')::int,1);
  IF rec NOT IN ('none','weekly','monthly') OR n<1 OR n>52 THEN RAISE EXCEPTION 'Recorrência inválida.'; END IF;
  IF rec='none' THEN n:=1; END IF;
  IF n>1 THEN sid:=gen_random_uuid(); END IF;
  start_time:=(_data->>'starts_at')::timestamptz; end_time:=(_data->>'ends_at')::timestamptz;
  IF start_time IS NULL OR end_time IS NULL THEN RAISE EXCEPTION 'Informe data e horário.'; END IF;
  st:=CASE WHEN r='membro' THEN 'pending' ELSE 'scheduled' END;
  FOR step IN 0..n-1 LOOP
   INSERT INTO public.agenda_events(title,kind,sector_id,organizer_id,created_by,starts_at,ends_at,location,agenda,status,team_wide,series_id,recurrence)
   VALUES(trim(_data->>'title'),_data->>'kind',sector,organizer,u,start_time+CASE rec WHEN 'weekly' THEN step*interval '7 days' WHEN 'monthly' THEN step*interval '1 month' ELSE interval '0' END,end_time+CASE rec WHEN 'weekly' THEN step*interval '7 days' WHEN 'monthly' THEN step*interval '1 month' ELSE interval '0' END,trim(_data->>'location'),COALESCE(_data->>'agenda',''),st,team,sid,rec) RETURNING id INTO eid;
   IF step=0 THEN _event:=eid; END IF;
   INSERT INTO public.agenda_invitees(event_id,user_id,kind) SELECT eid,id,invitation FROM unnest(people) p(id);
   INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(eid,u,'create',jsonb_build_object('status',st,'recurrence',rec));
   INSERT INTO public.notifications(user_id,event_id,title,body) SELECT id,eid,CASE WHEN st='pending' THEN 'Aviso: reunião pendente de aprovação' ELSE 'Novo evento: '||trim(_data->>'title') END,CASE WHEN st='pending' THEN 'Aviso informativo, sem convocação ou confirmação até aprovação.' ELSE 'Consulte data, local e participação na agenda.' END FROM unnest(people) p(id);
   INSERT INTO public.notifications(user_id,event_id,title,body) SELECT DISTINCT m.user_id,eid,CASE WHEN st='pending' THEN 'Proposta de reunião para aprovação' ELSE 'Aviso de reunião entre setores' END,trim(_data->>'title') FROM public.memberships m JOIN public.profiles p ON p.id=m.user_id WHERE p.active AND m.role='gerente' AND ((st='pending' AND m.sector_id=sector) OR (st='scheduled' AND m.sector_id<>sector AND m.sector_id IN (SELECT sector_id FROM public.memberships WHERE user_id=ANY(people))));
  END LOOP;
 ELSE
  SELECT * INTO e FROM public.agenda_events WHERE id=_event FOR UPDATE;
  IF NOT FOUND OR NOT public.agenda_visible(_event,u) THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  IF e.kind='meeting' AND NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='reunioes' AND enabled) THEN RAISE EXCEPTION 'Reuniões desabilitadas.'; END IF;
  manage:=public.agenda_manage(_event,u);
  IF _action='respond' THEN
   IF e.status<>'scheduled' THEN RAISE EXCEPTION 'Confirmação disponível somente após aprovação e antes da conclusão.'; END IF;
   IF _data->>'response' NOT IN ('yes','no') OR _data->>'response' IS NULL THEN RAISE EXCEPTION 'Resposta inválida.'; END IF;
   UPDATE public.agenda_invitees SET response=_data->>'response',responded_at=now() WHERE event_id=_event AND user_id=u AND kind<>'notice';
   IF NOT FOUND THEN RAISE EXCEPTION 'Você não recebeu convite ou convocação.'; END IF;
   INSERT INTO public.notifications(user_id,event_id,title,body) VALUES(e.organizer_id,_event,'Resposta de participação',e.title);
  ELSIF _action='edit' THEN
   IF NOT (manage OR (r='membro' AND e.created_by=u AND e.status='pending')) OR e.status IN ('cancelled','rejected','completed') THEN RAISE EXCEPTION 'Sem permissão para editar este evento.'; END IF;
   UPDATE public.agenda_events SET title=trim(_data->>'title'),starts_at=(_data->>'starts_at')::timestamptz,ends_at=(_data->>'ends_at')::timestamptz,location=trim(_data->>'location'),agenda=COALESCE(_data->>'agenda','') WHERE id=_event;
   UPDATE public.agenda_invitees SET response='pending',responded_at=NULL WHERE event_id=_event;
  ELSIF _action='minutes' OR _action='file' THEN
   IF NOT (manage OR e.organizer_id=u) OR e.status NOT IN ('scheduled','completed') THEN RAISE EXCEPTION 'Sem permissão para registrar ata.'; END IF;
   IF _action='minutes' THEN UPDATE public.agenda_events SET minutes=COALESCE(_data->>'minutes','') WHERE id=_event;
   ELSE
    IF split_part(_data->>'path','/',1)<>_event::text OR length(COALESCE(_data->>'name',''))=0 THEN RAISE EXCEPTION 'Anexo inválido.'; END IF;
    INSERT INTO public.agenda_files(event_id,path,name,uploaded_by) VALUES(_event,_data->>'path',_data->>'name',u);
   END IF;
  ELSIF _action='approve' OR _action='reject' THEN
   IF NOT manage OR e.status<>'pending' THEN RAISE EXCEPTION 'Sem permissão para decidir esta proposta.'; END IF;
   UPDATE public.agenda_events SET status=CASE WHEN _action='approve' THEN 'scheduled' ELSE 'rejected' END,archived_at=CASE WHEN _action='reject' THEN now() ELSE NULL END WHERE id=_event;
  ELSIF _action='cancel' OR _action='complete' OR _action='archive' THEN
   IF NOT manage THEN RAISE EXCEPTION 'Sem permissão para administrar este evento.'; END IF;
   IF _action='complete' AND e.status<>'scheduled' THEN RAISE EXCEPTION 'Somente eventos agendados podem ser concluídos.'; END IF;
   IF _action='cancel' AND e.status NOT IN ('scheduled','pending') THEN RAISE EXCEPTION 'Este evento não pode ser cancelado.'; END IF;
   IF _action='archive' AND e.status NOT IN ('cancelled','completed','rejected') THEN RAISE EXCEPTION 'Finalize ou cancele antes de arquivar.'; END IF;
   UPDATE public.agenda_events SET status=CASE _action WHEN 'cancel' THEN 'cancelled' WHEN 'complete' THEN 'completed' ELSE status END,archived_at=CASE WHEN _action='archive' THEN now() ELSE archived_at END WHERE id=_event;
  ELSE RAISE EXCEPTION 'Ação inválida.';
  END IF;
  INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(_event,u,_action,_data);
  IF _action IN ('edit','approve','reject','cancel','complete') THEN
   INSERT INTO public.notifications(user_id,event_id,title,body) SELECT user_id,_event,CASE _action WHEN 'approve' THEN 'Reunião aprovada' WHEN 'reject' THEN 'Reunião não aprovada' WHEN 'cancel' THEN 'Evento cancelado' WHEN 'complete' THEN 'Evento concluído' ELSE 'Evento alterado — confirme novamente' END,e.title FROM public.agenda_invitees WHERE event_id=_event;
   IF e.created_by<>u THEN INSERT INTO public.notifications(user_id,event_id,title,body) VALUES(e.created_by,_event,'Situação da reunião atualizada',e.title); END IF;
  END IF;
 END IF;
 INSERT INTO public.audit_log(actor_id,area,action,entity,entity_id,details) VALUES(u,'operacional','agenda_'||_action,'agenda_events',_event::text,_data);
 RETURN _event;
END $$;
REVOKE ALL ON FUNCTION public.agenda_command(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agenda_command(text,uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.agenda_manage(uuid,uuid),public.agenda_visible(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agenda_manage(uuid,uuid),public.agenda_visible(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.agenda_file_access(_name text,_uid uuid,_write boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE eid uuid; e public.agenda_events%ROWTYPE;
BEGIN
 BEGIN eid:=split_part(_name,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 SELECT * INTO e FROM public.agenda_events WHERE id=eid;
 IF NOT FOUND THEN RETURN false; END IF;
 IF NOT _write THEN RETURN public.agenda_visible(eid,_uid); END IF;
 RETURN public.is_active_member(_uid) AND e.status IN ('scheduled','completed') AND (public.agenda_manage(eid,_uid) OR e.organizer_id=_uid) AND EXISTS(SELECT 1 FROM public.feature_flags WHERE key='agenda' AND enabled) AND (e.kind<>'meeting' OR EXISTS(SELECT 1 FROM public.feature_flags WHERE key='reunioes' AND enabled));
END $$;
REVOKE ALL ON FUNCTION public.agenda_file_access(text,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agenda_file_access(text,uuid,boolean) TO authenticated;
CREATE POLICY agenda_storage_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='agenda-files' AND public.agenda_file_access(name,auth.uid(),false));
CREATE POLICY agenda_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='agenda-files' AND public.agenda_file_access(name,auth.uid(),true));
CREATE POLICY agenda_storage_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='agenda-files' AND owner_id=auth.uid()::text AND public.agenda_file_access(name,auth.uid(),true));