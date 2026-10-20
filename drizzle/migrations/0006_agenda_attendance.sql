ALTER TABLE public.agenda_events ADD COLUMN attendance_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.agenda_attendance (
 event_id uuid NOT NULL REFERENCES public.agenda_events(id), user_id uuid NOT NULL REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'unrecorded' CHECK(status IN ('present','absent','justified','excused','unrecorded')), note text NOT NULL DEFAULT '', recorded_by uuid NOT NULL REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(event_id,user_id)
);
GRANT SELECT ON public.agenda_attendance TO authenticated;
GRANT ALL ON public.agenda_attendance TO service_role;
ALTER TABLE public.agenda_attendance ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.agenda_attendance_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.agenda_events(id), user_id uuid NOT NULL REFERENCES public.profiles(id), actor_id uuid NOT NULL REFERENCES public.profiles(id), old_status text, new_status text NOT NULL, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agenda_attendance_history TO authenticated;
GRANT ALL ON public.agenda_attendance_history TO service_role;
ALTER TABLE public.agenda_attendance_history ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.attendance_visible(_event uuid,_subject uuid,_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND (_uid=_subject OR public.is_captain(_uid) OR EXISTS(SELECT 1 FROM public.memberships viewer JOIN public.memberships subject ON subject.user_id=_subject WHERE viewer.user_id=_uid AND viewer.role='gerente' AND viewer.sector_id=subject.sector_id) OR EXISTS(SELECT 1 FROM public.agenda_events WHERE id=_event AND organizer_id=_uid))
$$;
REVOKE ALL ON FUNCTION public.attendance_visible(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_visible(uuid,uuid,uuid) TO authenticated;
CREATE POLICY attendance_read ON public.agenda_attendance FOR SELECT TO authenticated USING(public.attendance_visible(event_id,user_id,auth.uid()));
CREATE POLICY attendance_history_read ON public.agenda_attendance_history FOR SELECT TO authenticated USING(public.attendance_visible(event_id,user_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.attendance_command(_action text,_event uuid,_data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); e public.agenda_events%ROWTYPE; subject uuid; st text; old_st text; enabled boolean; manager boolean;
BEGIN
 IF u IS NULL OR NOT public.is_active_member(u) THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
 SELECT * INTO e FROM public.agenda_events WHERE id=_event FOR UPDATE;
 IF NOT FOUND OR NOT public.agenda_visible(_event,u) THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='agenda' AND enabled) OR (e.kind='meeting' AND NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='reunioes' AND enabled)) THEN RAISE EXCEPTION 'Módulo desabilitado. Histórico preservado.'; END IF;
 manager:=public.agenda_manage(_event,u);
 IF _action='toggle' THEN
  IF NOT manager THEN RAISE EXCEPTION 'Somente a gerência competente ou capitão pode alterar a chamada.'; END IF;
  enabled:=(_data->>'enabled')::boolean;
  IF enabled IS NULL THEN RAISE EXCEPTION 'Informe o estado da chamada.'; END IF;
  IF enabled AND e.status NOT IN ('scheduled','completed') THEN RAISE EXCEPTION 'Chamada disponível apenas para eventos aprovados ou concluídos.'; END IF;
  UPDATE public.agenda_events SET attendance_enabled=enabled WHERE id=_event;
  INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(_event,u,'attendance_toggle',jsonb_build_object('before',e.attendance_enabled,'enabled',enabled));
 ELSIF _action='summon' THEN
  subject:=(_data->>'user_id')::uuid;
  IF NOT manager OR e.status NOT IN ('scheduled','completed') THEN RAISE EXCEPTION 'Sem permissão para convocar neste evento.'; END IF;
  IF NOT public.is_captain(u) AND NOT EXISTS(SELECT 1 FROM public.memberships a JOIN public.memberships b ON b.sector_id=a.sector_id WHERE a.user_id=u AND b.user_id=subject) THEN RAISE EXCEPTION 'Você só pode convocar integrantes do próprio setor.'; END IF;
  UPDATE public.agenda_invitees SET kind='convocation' WHERE event_id=_event AND user_id=subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selecione um participante do evento.'; END IF;
  INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(_event,u,'attendance_summon',jsonb_build_object('user_id',subject));
  INSERT INTO public.notifications(user_id,event_id,title,body) VALUES(subject,_event,'Convocação registrada',e.title);
 ELSIF _action='record' THEN
  IF NOT (manager OR e.organizer_id=u) THEN RAISE EXCEPTION 'Somente o responsável ou a gerência competente registra a chamada.'; END IF;
  IF NOT e.attendance_enabled OR e.status NOT IN ('scheduled','completed') THEN RAISE EXCEPTION 'Habilite a chamada em um evento aprovado ou concluído.'; END IF;
  subject:=(_data->>'user_id')::uuid; st:=_data->>'status';
  IF st IS NULL OR st NOT IN ('present','absent','justified','excused','unrecorded') THEN RAISE EXCEPTION 'Situação de presença inválida.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.agenda_invitees WHERE event_id=_event AND user_id=subject AND kind='convocation') THEN RAISE EXCEPTION 'Chamada registra somente pessoas efetivamente convocadas.'; END IF;
  SELECT status INTO old_st FROM public.agenda_attendance WHERE event_id=_event AND user_id=subject;
  INSERT INTO public.agenda_attendance(event_id,user_id,status,note,recorded_by) VALUES(_event,subject,st,COALESCE(_data->>'note',''),u) ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status,note=excluded.note,recorded_by=u,updated_at=now();
  INSERT INTO public.agenda_attendance_history(event_id,user_id,actor_id,old_status,new_status,note) VALUES(_event,subject,u,old_st,st,COALESCE(_data->>'note',''));
 ELSE RAISE EXCEPTION 'Ação inválida.'; END IF;
 INSERT INTO public.audit_log(actor_id,area,action,entity,entity_id,details) VALUES(u,'operacional','attendance_'||_action,'agenda_events',_event::text,_data);
 RETURN _event;
END $$;
REVOKE ALL ON FUNCTION public.attendance_command(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_command(text,uuid,jsonb) TO authenticated;