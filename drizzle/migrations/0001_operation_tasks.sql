CREATE TABLE public.tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL CHECK (kind IN ('official','voluntary')), sector_id smallint NOT NULL REFERENCES public.sectors(id), owner_id uuid NOT NULL REFERENCES public.profiles(id), created_by uuid NOT NULL REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','progress','approval','blocked','completed','cancelled')), priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')), due_at timestamptz, execution text NOT NULL DEFAULT 'collective' CHECK(execution IN ('collective','individual')), whole_sector boolean NOT NULL DEFAULT false, invited_sectors smallint[] NOT NULL DEFAULT '{}', capacity integer CHECK(capacity > 0), recurring boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz
);
GRANT SELECT ON public.tasks TO authenticated; GRANT ALL ON public.tasks TO service_role; ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_participants (task_id uuid NOT NULL REFERENCES public.tasks(id), user_id uuid NOT NULL REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','progress','completed','consent')), joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(task_id,user_id));
GRANT SELECT ON public.task_participants TO authenticated; GRANT ALL ON public.task_participants TO service_role; ALTER TABLE public.task_participants ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_collaborations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id), sector_id smallint NOT NULL REFERENCES public.sectors(id), requested_by uuid NOT NULL REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','adjustments')), note text NOT NULL DEFAULT '', decided_by uuid REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, UNIQUE(task_id,sector_id));
GRANT SELECT ON public.task_collaborations TO authenticated; GRANT ALL ON public.task_collaborations TO service_role; ALTER TABLE public.task_collaborations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id), title text NOT NULL, assignee_id uuid REFERENCES public.profiles(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','progress','completed')), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.task_items TO authenticated; GRANT ALL ON public.task_items TO service_role; ALTER TABLE public.task_items ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_dependencies (task_id uuid NOT NULL REFERENCES public.tasks(id), depends_on uuid NOT NULL REFERENCES public.tasks(id), PRIMARY KEY(task_id,depends_on), CHECK(task_id <> depends_on));
GRANT SELECT ON public.task_dependencies TO authenticated; GRANT ALL ON public.task_dependencies TO service_role; ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id), author_id uuid NOT NULL REFERENCES public.profiles(id), body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.task_comments TO authenticated; GRANT ALL ON public.task_comments TO service_role; ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.task_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.tasks(id), actor_id uuid NOT NULL REFERENCES public.profiles(id), action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.task_history TO authenticated; GRANT ALL ON public.task_history TO service_role; ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), task_id uuid REFERENCES public.tasks(id), title text NOT NULL, body text NOT NULL DEFAULT '', read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,UPDATE ON public.notifications TO authenticated; GRANT ALL ON public.notifications TO service_role; ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_read ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_active_member(auth.uid()));
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.is_active_member(auth.uid())) WITH CHECK(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.task_manage(_task uuid, _uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND EXISTS(SELECT 1 FROM tasks t JOIN memberships m ON m.user_id=_uid WHERE t.id=_task AND (m.role='capitao' OR (t.kind='voluntary' AND t.owner_id=_uid) OR (m.role='gerente' AND (m.sector_id=t.sector_id OR EXISTS(SELECT 1 FROM task_collaborations c WHERE c.task_id=t.id AND c.sector_id=m.sector_id AND c.status='accepted')))))
$$;
CREATE OR REPLACE FUNCTION public.task_visible(_task uuid, _uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND EXISTS(SELECT 1 FROM tasks t JOIN memberships m ON m.user_id=_uid WHERE t.id=_task AND (m.role='capitao' OR t.sector_id=m.sector_id OR t.owner_id=_uid OR (t.kind='voluntary' AND (cardinality(t.invited_sectors)=0 OR m.sector_id=ANY(t.invited_sectors))) OR EXISTS(SELECT 1 FROM task_participants p WHERE p.task_id=t.id AND p.user_id=_uid) OR EXISTS(SELECT 1 FROM task_collaborations c WHERE c.task_id=t.id AND c.sector_id=m.sector_id)))
$$;
CREATE OR REPLACE FUNCTION public.task_execute(_task uuid, _uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_active_member(_uid) AND EXISTS(SELECT 1 FROM tasks t JOIN memberships m ON m.user_id=_uid WHERE t.id=_task AND ((t.whole_sector AND t.sector_id=m.sector_id AND t.kind='official') OR EXISTS(SELECT 1 FROM task_participants p WHERE p.task_id=t.id AND p.user_id=_uid AND p.status <> 'consent')))
$$;
REVOKE ALL ON FUNCTION public.task_manage(uuid,uuid), public.task_visible(uuid,uuid), public.task_execute(uuid,uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.task_manage(uuid,uuid),public.task_visible(uuid,uuid),public.task_execute(uuid,uuid) TO authenticated,service_role;
CREATE POLICY tasks_read ON public.tasks FOR SELECT TO authenticated USING(public.task_visible(id,auth.uid()));
CREATE POLICY participants_read ON public.task_participants FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE POLICY collaborations_read ON public.task_collaborations FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE POLICY items_read ON public.task_items FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE POLICY dependencies_read ON public.task_dependencies FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE POLICY comments_read ON public.task_comments FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE POLICY history_read ON public.task_history FOR SELECT TO authenticated USING(public.task_visible(task_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.task_command(_action text, _task uuid DEFAULT NULL, _data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); m memberships%ROWTYPE; t tasks%ROWTYPE; target uuid; sid smallint; c task_collaborations%ROWTYPE; item task_items%ROWTYPE; s text; ids uuid[]; v uuid; managed boolean; executing boolean;
BEGIN
 IF uid IS NULL OR NOT public.is_active_member(uid) THEN RAISE EXCEPTION 'Conta sem acesso operacional.'; END IF;
 SELECT * INTO m FROM memberships WHERE user_id=uid;
 IF _action='create' THEN
  s:=_data->>'kind'; sid:=(_data->>'sector_id')::smallint;
  IF s NOT IN ('official','voluntary') OR m.role='trainee' OR (s='official' AND NOT (m.role='capitao' OR (m.role='gerente' AND sid=m.sector_id))) OR (s='voluntary' AND m.role<>'capitao' AND sid<>m.sector_id) THEN RAISE EXCEPTION 'Você não pode criar essa tarefa.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM feature_flags WHERE key=CASE WHEN s='official' THEN 'tarefas' ELSE 'voluntarias' END AND enabled) THEN RAISE EXCEPTION 'Módulo desativado.'; END IF;
  IF length(trim(coalesce(_data->>'title','')))=0 OR length(_data->>'title')>160 THEN RAISE EXCEPTION 'Informe o título, até 160 caracteres.'; END IF;
  IF s='official' AND nullif(_data->>'due_at','') IS NULL THEN RAISE EXCEPTION 'Informe o prazo da tarefa oficial.'; END IF;
  target:=coalesce(nullif(_data->>'owner_id','')::uuid,uid);
  IF s='official' AND NOT EXISTS(SELECT 1 FROM memberships mm JOIN profiles pp ON pp.id=mm.user_id WHERE mm.user_id=target AND pp.active AND (mm.role='capitao' OR (mm.role='gerente' AND mm.sector_id=sid))) THEN RAISE EXCEPTION 'Escolha o responsável gerencial do setor.'; END IF;
  INSERT INTO tasks(title,description,kind,sector_id,owner_id,created_by,priority,due_at,execution,whole_sector,invited_sectors,capacity,recurring) VALUES(trim(_data->>'title'),coalesce(_data->>'description',''),s,sid,target,uid,coalesce(_data->>'priority','normal'),nullif(_data->>'due_at','')::timestamptz,coalesce(_data->>'execution','collective'),s='official' AND coalesce((_data->>'whole_sector')::boolean,false),ARRAY(SELECT jsonb_array_elements_text(coalesce(_data->'invited_sectors','[]'))::smallint),nullif(_data->>'capacity','')::integer,coalesce((_data->>'recurring')::boolean,false)) RETURNING id INTO _task;
  FOR v IN SELECT jsonb_array_elements_text(coalesce(_data->'participants','[]'))::uuid LOOP
   IF s='voluntary' THEN RAISE EXCEPTION 'Voluntárias convidam setores, não pessoas.'; END IF;
   IF NOT EXISTS(SELECT 1 FROM memberships mm JOIN profiles pp ON pp.id=mm.user_id WHERE mm.user_id=v AND pp.active AND (m.role='capitao' OR mm.sector_id=sid)) THEN RAISE EXCEPTION 'Não atribua integrante de outro setor sem aceite.'; END IF;
   INSERT INTO task_participants(task_id,user_id) VALUES(_task,v);
   INSERT INTO notifications(user_id,task_id,title) VALUES(v,_task,'Você recebeu uma tarefa: '||trim(_data->>'title'));
  END LOOP;
 ELSE
  SELECT * INTO t FROM tasks WHERE id=_task FOR UPDATE;
  IF NOT FOUND OR NOT public.task_visible(_task,uid) THEN RAISE EXCEPTION 'Tarefa não encontrada ou sem acesso.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM feature_flags WHERE key=CASE WHEN t.kind='official' THEN 'tarefas' ELSE 'voluntarias' END AND enabled) THEN RAISE EXCEPTION 'Módulo desativado.'; END IF;
  managed:=public.task_manage(_task,uid); executing:=public.task_execute(_task,uid);
  IF _action='edit' THEN
   IF NOT managed THEN RAISE EXCEPTION 'Sem autoridade para editar.'; END IF;
   IF length(trim(coalesce(_data->>'title','')))=0 OR length(_data->>'title')>160 OR (t.kind='official' AND nullif(_data->>'due_at','') IS NULL) THEN RAISE EXCEPTION 'Informe título e prazo.'; END IF;
   UPDATE tasks SET title=trim(_data->>'title'),description=coalesce(_data->>'description',''),priority=coalesce(_data->>'priority','normal'),due_at=nullif(_data->>'due_at','')::timestamptz WHERE id=_task;
   IF t.due_at IS DISTINCT FROM nullif(_data->>'due_at','')::timestamptz THEN INSERT INTO notifications(user_id,task_id,title) SELECT user_id,_task,'Prazo alterado: '||t.title FROM task_participants WHERE task_id=_task; END IF;
  ELSIF _action='status' THEN
   s:=_data->>'status';
   IF NOT managed AND NOT executing THEN RAISE EXCEPTION 'Tarefa não atribuída a você.'; END IF;
   IF s IN ('cancelled','pending') AND NOT managed THEN RAISE EXCEPTION 'Somente a gerência reabre ou cancela.'; END IF;
   IF NOT managed AND t.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'A tarefa precisa ser reaberta pela gerência.'; END IF;
   IF s='completed' AND (EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks dep ON dep.id=d.depends_on WHERE d.task_id=_task AND dep.status<>'completed') OR EXISTS(SELECT 1 FROM task_items WHERE task_id=_task AND status<>'completed')) THEN RAISE EXCEPTION 'Conclua as dependências e subtarefas primeiro.'; END IF;
   IF t.execution='individual' AND s IN ('completed','progress','approval') THEN
    UPDATE task_participants SET status=CASE WHEN s='completed' THEN 'completed' ELSE 'progress' END WHERE task_id=_task AND user_id=uid AND status<>'consent';
    IF s='completed' AND EXISTS(SELECT 1 FROM task_participants WHERE task_id=_task AND status<>'completed') THEN s:='progress'; END IF;
   END IF;
   UPDATE tasks SET status=s WHERE id=_task;
   IF s='pending' THEN UPDATE task_participants SET status='pending' WHERE task_id=_task AND status='completed'; END IF;
  ELSIF _action='join' THEN
   IF t.kind<>'voluntary' OR t.status IN ('completed','cancelled') OR (cardinality(t.invited_sectors)>0 AND NOT m.sector_id=ANY(t.invited_sectors)) THEN RAISE EXCEPTION 'Inscrição indisponível.'; END IF;
   IF NOT EXISTS(SELECT 1 FROM task_participants WHERE task_id=_task AND user_id=uid) THEN
    IF t.capacity IS NOT NULL AND (SELECT count(*) FROM task_participants WHERE task_id=_task)>=t.capacity THEN RAISE EXCEPTION 'Todas as vagas estão ocupadas.'; END IF;
    INSERT INTO task_participants(task_id,user_id) VALUES(_task,uid);
    INSERT INTO notifications(user_id,task_id,title) VALUES(t.owner_id,_task,'Nova participação: '||t.title);
   END IF;
  ELSIF _action='leave' THEN
   IF t.kind<>'voluntary' THEN RAISE EXCEPTION 'Saída disponível apenas em voluntárias.'; END IF;
   DELETE FROM task_participants WHERE task_id=_task AND user_id=uid;
   INSERT INTO notifications(user_id,task_id,title) VALUES(t.owner_id,_task,'Desistência registrada: '||t.title);
  ELSIF _action='consent' THEN
   UPDATE task_participants SET status='pending' WHERE task_id=_task AND user_id=uid AND status='consent';
   IF NOT FOUND THEN RAISE EXCEPTION 'Não há confirmação pendente.'; END IF;
  ELSIF _action='decline' THEN
   DELETE FROM task_participants WHERE task_id=_task AND user_id=uid AND status='consent';
   IF NOT FOUND THEN RAISE EXCEPTION 'Não há confirmação pendente.'; END IF;
  ELSIF _action='convert' THEN
   IF t.kind<>'voluntary' OR NOT (m.role='capitao' OR (m.role='gerente' AND m.sector_id=t.sector_id)) THEN RAISE EXCEPTION 'Somente a gerência competente converte.'; END IF;
   IF nullif(_data->>'due_at','') IS NULL THEN RAISE EXCEPTION 'Informe o prazo da tarefa oficial.'; END IF;
   UPDATE tasks SET kind='official',owner_id=uid,due_at=(_data->>'due_at')::timestamptz,execution='individual',whole_sector=false WHERE id=_task;
   UPDATE task_participants SET status='consent' WHERE task_id=_task;
   INSERT INTO notifications(user_id,task_id,title,body) SELECT user_id,_task,'Confirme a participação: '||t.title,'A voluntária foi convertida em oficial. Aceite ou recuse sua atribuição.' FROM task_participants WHERE task_id=_task;
  ELSIF _action='invite' THEN
   IF NOT managed OR t.kind<>'official' THEN RAISE EXCEPTION 'Sem autoridade para convidar.'; END IF;
   sid:=(_data->>'sector_id')::smallint;
   IF sid=t.sector_id THEN RAISE EXCEPTION 'Selecione outro setor.'; END IF;
   INSERT INTO task_collaborations(task_id,sector_id,requested_by) VALUES(_task,sid,uid) ON CONFLICT(task_id,sector_id) DO UPDATE SET status='pending',requested_by=uid,decided_at=NULL,decided_by=NULL;
   INSERT INTO notifications(user_id,task_id,title) SELECT mm.user_id,_task,'Convite de colaboração: '||t.title FROM memberships mm JOIN profiles pp ON pp.id=mm.user_id WHERE pp.active AND ((mm.role='gerente' AND mm.sector_id=sid) OR mm.role='capitao');
  ELSIF _action='decide' THEN
   SELECT * INTO c FROM task_collaborations WHERE id=(_data->>'request_id')::uuid AND task_id=_task FOR UPDATE;
   IF NOT FOUND OR c.status NOT IN ('pending','adjustments') OR NOT (m.role='capitao' OR (m.role='gerente' AND m.sector_id=c.sector_id)) THEN RAISE EXCEPTION 'Sem autoridade sobre esta solicitação.'; END IF;
   s:=_data->>'status'; IF s NOT IN ('accepted','rejected','adjustments') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
   IF s='accepted' THEN
    FOR v IN SELECT jsonb_array_elements_text(coalesce(_data->'participants','[]'))::uuid LOOP
     IF NOT EXISTS(SELECT 1 FROM memberships mm JOIN profiles pp ON pp.id=mm.user_id WHERE mm.user_id=v AND mm.sector_id=c.sector_id AND pp.active) THEN RAISE EXCEPTION 'Escolha somente integrantes do setor convidado.'; END IF;
     INSERT INTO task_participants(task_id,user_id) VALUES(_task,v) ON CONFLICT DO NOTHING;
     INSERT INTO notifications(user_id,task_id,title) VALUES(v,_task,'Colaboração atribuída: '||t.title);
    END LOOP;
   END IF;
   UPDATE task_collaborations SET status=s,note=coalesce(_data->>'note',''),decided_by=uid,decided_at=now() WHERE id=c.id;
   INSERT INTO notifications(user_id,task_id,title) VALUES(c.requested_by,_task,'Resposta ao convite: '||t.title);
  ELSIF _action='assign' THEN
   IF NOT managed OR t.kind<>'official' THEN RAISE EXCEPTION 'Sem autoridade para atribuir.'; END IF;
   v:=(_data->>'user_id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM memberships mm JOIN profiles pp ON pp.id=mm.user_id WHERE mm.user_id=v AND pp.active AND (m.role='capitao' OR mm.sector_id=m.sector_id)) THEN RAISE EXCEPTION 'O gerente de origem escolhe os colaboradores.'; END IF;
   INSERT INTO task_participants(task_id,user_id) VALUES(_task,v) ON CONFLICT DO NOTHING;
   INSERT INTO notifications(user_id,task_id,title) VALUES(v,_task,'Tarefa atribuída: '||t.title);
  ELSIF _action='item' THEN
   IF NOT managed THEN RAISE EXCEPTION 'Sem autoridade para criar subtarefa.'; END IF;
   IF length(trim(coalesce(_data->>'title','')))=0 THEN RAISE EXCEPTION 'Informe a subtarefa.'; END IF;
   v:=nullif(_data->>'assignee_id','')::uuid;
   IF v IS NOT NULL AND NOT EXISTS(SELECT 1 FROM task_participants WHERE task_id=_task AND user_id=v AND status<>'consent') AND NOT (t.whole_sector AND EXISTS(SELECT 1 FROM memberships WHERE user_id=v AND sector_id=t.sector_id)) THEN RAISE EXCEPTION 'Responsável deve participar da tarefa.'; END IF;
   INSERT INTO task_items(task_id,title,assignee_id) VALUES(_task,trim(_data->>'title'),v);
   IF t.status='completed' THEN UPDATE tasks SET status='pending' WHERE id=_task; END IF;
  ELSIF _action='item_status' THEN
   SELECT * INTO item FROM task_items WHERE id=(_data->>'item_id')::uuid AND task_id=_task;
   IF NOT FOUND OR NOT (managed OR (executing AND (item.assignee_id=uid OR item.assignee_id IS NULL))) THEN RAISE EXCEPTION 'Subtarefa não atribuída a você.'; END IF;
   IF t.status IN ('completed','cancelled') AND NOT managed THEN RAISE EXCEPTION 'Peça a reabertura da tarefa.'; END IF;
   UPDATE task_items SET status=_data->>'status' WHERE id=item.id;
   IF _data->>'status'<>'completed' AND t.status='completed' THEN UPDATE tasks SET status='pending' WHERE id=_task; END IF;
  ELSIF _action='dependency' THEN
   IF NOT managed THEN RAISE EXCEPTION 'Sem autoridade para editar dependências.'; END IF;
   v:=(_data->>'depends_on')::uuid;
   IF NOT public.task_visible(v,uid) THEN RAISE EXCEPTION 'Dependência sem acesso.'; END IF;
   PERFORM pg_advisory_xact_lock(847362);
   IF EXISTS(WITH RECURSIVE chain(id) AS (SELECT v UNION SELECT d.depends_on FROM task_dependencies d JOIN chain ch ON d.task_id=ch.id) SELECT 1 FROM chain WHERE id=_task) THEN RAISE EXCEPTION 'Dependência circular não permitida.'; END IF;
   INSERT INTO task_dependencies(task_id,depends_on) VALUES(_task,v) ON CONFLICT DO NOTHING;
   IF EXISTS(SELECT 1 FROM tasks WHERE id=v AND status<>'completed') THEN UPDATE tasks SET status='blocked' WHERE id=_task; END IF;
  ELSIF _action='remove_dependency' THEN
   IF NOT managed THEN RAISE EXCEPTION 'Sem autoridade para editar dependências.'; END IF;
   DELETE FROM task_dependencies WHERE task_id=_task AND depends_on=(_data->>'depends_on')::uuid;
  ELSIF _action='comment' THEN
   IF NOT managed AND NOT executing THEN RAISE EXCEPTION 'Somente participantes registram execução.'; END IF;
   IF length(trim(coalesce(_data->>'body','')))=0 OR length(_data->>'body')>5000 THEN RAISE EXCEPTION 'Comentário deve ter entre 1 e 5000 caracteres.'; END IF;
   INSERT INTO task_comments(task_id,author_id,body) VALUES(_task,uid,trim(_data->>'body'));
  ELSE RAISE EXCEPTION 'Ação inválida.';
  END IF;
 END IF;
 UPDATE tasks SET updated_at=now() WHERE id=_task;
 UPDATE tasks tt SET status='pending' WHERE tt.status='blocked' AND EXISTS(SELECT 1 FROM task_dependencies WHERE task_id=tt.id AND depends_on=_task) AND NOT EXISTS(SELECT 1 FROM task_dependencies d JOIN tasks dep ON dep.id=d.depends_on WHERE d.task_id=tt.id AND dep.status<>'completed');
 INSERT INTO task_history(task_id,actor_id,action,details) VALUES(_task,uid,_action,_data);
 INSERT INTO audit_log(actor_id,area,action,entity,entity_id,details) VALUES(uid,'operacional','tarefa_'||_action,'tasks',_task::text,_data);
 RETURN _task;
END $$;
REVOKE ALL ON FUNCTION public.task_command(text,uuid,jsonb) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.task_command(text,uuid,jsonb) TO authenticated;
CREATE INDEX task_participants_user ON public.task_participants(user_id);
CREATE INDEX notifications_user_date ON public.notifications(user_id,created_at DESC);
CREATE INDEX tasks_sector_due ON public.tasks(sector_id,due_at);
