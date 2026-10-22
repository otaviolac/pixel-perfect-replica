CREATE OR REPLACE FUNCTION public.agenda_visible(_event uuid,_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND EXISTS(SELECT 1 FROM public.agenda_events e WHERE e.id=_event AND (public.is_captain(_uid) OR e.team_wide OR e.created_by=_uid OR e.organizer_id=_uid OR e.sector_id=(SELECT m.sector_id FROM public.memberships m WHERE m.user_id=_uid) OR EXISTS(SELECT 1 FROM public.agenda_invitees i WHERE i.event_id=e.id AND i.user_id=_uid) OR EXISTS(SELECT 1 FROM public.memberships manager JOIN public.agenda_invitees i ON i.event_id=e.id JOIN public.memberships invited ON invited.user_id=i.user_id WHERE manager.user_id=_uid AND manager.role='gerente' AND manager.sector_id=invited.sector_id) OR EXISTS(SELECT 1 FROM public.test_sessions s JOIN public.test_sector_invitations i ON i.session_id=s.id JOIN public.memberships m ON m.user_id=_uid WHERE s.event_id=e.id AND m.role='gerente' AND m.sector_id=i.sector_id)))
$$;
CREATE OR REPLACE FUNCTION public.validate_test_session_state() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status='interrupted' AND length(trim(COALESCE(NEW.note,'')))=0 THEN RAISE EXCEPTION 'Informe o motivo da interrupção.'; END IF;
 IF NEW.status='completed' AND length(trim(COALESCE(NEW.results,'')))=0 THEN RAISE EXCEPTION 'Registre resultados do teste realizado antes de concluir.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_test_session_state BEFORE INSERT OR UPDATE ON public.test_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_test_session_state();
CREATE OR REPLACE FUNCTION public.protect_test_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.test_mode IS NOT NULL AND NEW.test_mode IS DISTINCT FROM OLD.test_mode THEN RAISE EXCEPTION 'A modalidade de um teste não pode ser alterada pela agenda.'; END IF;
 IF NEW.test_mode IS NOT NULL AND COALESCE(current_setting('app.test_command',true),'')<>'on' AND (TG_OP='INSERT' OR ROW(NEW.title,NEW.starts_at,NEW.ends_at,NEW.location,NEW.status,NEW.organizer_id,NEW.sector_id,NEW.archived_at) IS DISTINCT FROM ROW(OLD.title,OLD.starts_at,OLD.ends_at,OLD.location,OLD.status,OLD.organizer_id,OLD.sector_id,OLD.archived_at)) THEN RAISE EXCEPTION 'Gerencie este evento pela ficha do teste.'; END IF;
 IF NEW.test_mode='quick_test' AND NEW.attendance_enabled THEN RAISE EXCEPTION 'Testes rápidos não têm chamada de assiduidade.'; END IF;
 RETURN NEW;
END $$;