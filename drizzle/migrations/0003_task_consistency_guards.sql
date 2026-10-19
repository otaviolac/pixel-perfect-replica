CREATE OR REPLACE FUNCTION public.validate_task_state() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.kind='official' AND NEW.due_at IS NULL THEN RAISE EXCEPTION 'Informe o prazo da tarefa oficial.'; END IF;
 IF NEW.execution='individual' AND NEW.whole_sector THEN RAISE EXCEPTION 'Entregas individuais exigem responsáveis específicos.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=NEW.owner_id AND active) THEN RAISE EXCEPTION 'Responsável deve ser integrante ativo.'; END IF;
 IF TG_OP='UPDATE' AND NEW.status='completed' AND (EXISTS(SELECT 1 FROM task_items WHERE task_id=NEW.id AND status<>'completed') OR EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on WHERE d.task_id=NEW.id AND t.status<>'completed') OR (NEW.execution='individual' AND (NOT EXISTS(SELECT 1 FROM task_participants WHERE task_id=NEW.id) OR EXISTS(SELECT 1 FROM task_participants WHERE task_id=NEW.id AND status<>'completed')))) THEN RAISE EXCEPTION 'Conclua todas as entregas, subtarefas e dependências antes da tarefa.'; END IF;
 IF NEW.status NOT IN ('completed','cancelled') AND EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks t ON t.id=d.depends_on WHERE d.task_id=NEW.id AND t.status<>'completed') THEN NEW.status:='blocked'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER task_validate_state BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.validate_task_state();
CREATE OR REPLACE FUNCTION public.task_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' AND NEW.kind='official' AND NEW.whole_sector THEN INSERT INTO notifications(user_id,task_id,title) SELECT m.user_id,NEW.id,'Tarefa atribuída ao setor: '||NEW.title FROM memberships m JOIN profiles p ON p.id=m.user_id WHERE m.sector_id=NEW.sector_id AND p.active; END IF;
 IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
  INSERT INTO notifications(user_id,task_id,title) SELECT DISTINCT uid,NEW.id,'Estado atualizado: '||NEW.title FROM (SELECT user_id AS uid FROM task_participants WHERE task_id=NEW.id UNION SELECT NEW.owner_id UNION SELECT user_id FROM memberships WHERE NEW.whole_sector AND sector_id=NEW.sector_id) users WHERE uid IS DISTINCT FROM auth.uid();
  IF OLD.status='completed' AND NEW.status<>'completed' THEN UPDATE tasks SET status='blocked',updated_at=now() WHERE id IN(SELECT task_id FROM task_dependencies WHERE depends_on=NEW.id) AND status<>'cancelled'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER task_events AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.task_events();
REVOKE ALL ON FUNCTION public.validate_task_state(), public.task_events() FROM PUBLIC;
