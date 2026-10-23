CREATE TABLE public.test_datasets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL REFERENCES public.test_sessions(id), filename text NOT NULL,
 columns jsonb NOT NULL CHECK(jsonb_typeof(columns)='array'), rows jsonb NOT NULL CHECK(jsonb_typeof(rows)='array'),
 metadata jsonb NOT NULL DEFAULT '{}', created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.test_datasets TO authenticated; GRANT ALL ON public.test_datasets TO service_role;
ALTER TABLE public.test_datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_datasets_read ON public.test_datasets FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.test_sessions s WHERE s.id=session_id AND public.test_visible(s.test_id,auth.uid())));
CREATE TABLE public.test_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), test_id uuid NOT NULL REFERENCES public.tests(id), revision integer NOT NULL, partial boolean NOT NULL,
 snapshot jsonb NOT NULL, issued_by uuid NOT NULL REFERENCES public.profiles(id), issued_at timestamptz NOT NULL DEFAULT now(), UNIQUE(test_id,revision)
);
GRANT SELECT ON public.test_documents TO authenticated; GRANT ALL ON public.test_documents TO service_role;
ALTER TABLE public.test_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_documents_read ON public.test_documents FOR SELECT TO authenticated USING(public.test_visible(test_id,auth.uid()));
CREATE OR REPLACE FUNCTION public.test_analysis_command(_action text,_test uuid,_session uuid DEFAULT NULL,_data jsonb DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); t public.tests%ROWTYPE; s public.test_sessions%ROWTYPE; e public.agenda_events%ROWTYPE; result_id uuid; col jsonb; row_values jsonb; cell jsonb; col_count integer; doc_revision integer; doc_snapshot jsonb; is_partial boolean; manager boolean;
BEGIN
 IF u IS NULL OR NOT public.is_active_member(u) THEN RAISE EXCEPTION 'Acesso não autorizado.'; END IF;
 SELECT * INTO t FROM public.tests WHERE id=_test FOR UPDATE;
 IF NOT FOUND OR NOT public.test_visible(t.id,u) THEN RAISE EXCEPTION 'Teste não encontrado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='testes' AND enabled) OR NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='agenda' AND enabled) OR t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Registro em consulta. Histórico preservado.'; END IF;
 manager:=public.is_captain(u) OR EXISTS(SELECT 1 FROM public.memberships WHERE user_id=u AND role='gerente' AND sector_id=t.sector_id);
 IF _action='dataset' THEN
  SELECT * INTO s FROM public.test_sessions WHERE id=_session AND test_id=t.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada.'; END IF;
  SELECT * INTO e FROM public.agenda_events WHERE id=s.event_id;
  IF NOT(manager OR e.organizer_id=u) OR s.status IN ('pending','rejected','cancelled') THEN RAISE EXCEPTION 'Sem permissão para registrar medições.'; END IF;
  IF jsonb_typeof(_data->'columns') IS DISTINCT FROM 'array' OR jsonb_typeof(_data->'rows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Dados CSV inválidos.'; END IF;
  col_count:=jsonb_array_length(_data->'columns');
  IF col_count<2 OR col_count>30 OR jsonb_array_length(_data->'rows')<1 OR jsonb_array_length(_data->'rows')>10000 OR octet_length(_data::text)>2097152 THEN RAISE EXCEPTION 'Arquivo fora dos limites de importação.'; END IF;
  FOR col IN SELECT value FROM jsonb_array_elements(_data->'columns') LOOP
   IF length(trim(COALESCE(col->>'name','')))=0 OR length(trim(COALESCE(col->>'unit','')))=0 THEN RAISE EXCEPTION 'Informe nome e unidade de cada coluna.'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT lower(trim(value->>'name'))) FROM jsonb_array_elements(_data->'columns'))<>col_count THEN RAISE EXCEPTION 'Nomes de colunas repetidos.'; END IF;
  FOR row_values IN SELECT value FROM jsonb_array_elements(_data->'rows') LOOP
   IF jsonb_typeof(row_values)<>'array' OR jsonb_array_length(row_values)<>col_count THEN RAISE EXCEPTION 'Quantidade de colunas inconsistente.'; END IF;
   FOR cell IN SELECT value FROM jsonb_array_elements(row_values) LOOP
    IF jsonb_typeof(cell) NOT IN ('number','null') THEN RAISE EXCEPTION 'As medições devem ser números ou campos ausentes.'; END IF;
   END LOOP;
  END LOOP;
  IF length(trim(COALESCE(_data->>'filename','')))=0 THEN RAISE EXCEPTION 'Arquivo sem nome.'; END IF;
  INSERT INTO public.test_datasets(session_id,filename,columns,rows,metadata,created_by) VALUES(s.id,_data->>'filename',_data->'columns',_data->'rows',COALESCE(_data->'metadata','{}'),u) RETURNING id INTO result_id;
  INSERT INTO public.agenda_history(event_id,actor_id,action,details) VALUES(e.id,u,'test_dataset',jsonb_build_object('dataset_id',result_id,'filename',_data->>'filename'));
 ELSIF _action='document' THEN
  IF NOT(manager OR t.created_by=u OR EXISTS(SELECT 1 FROM public.test_sessions ss JOIN public.agenda_events ev ON ev.id=ss.event_id WHERE ss.test_id=t.id AND ev.organizer_id=u)) THEN RAISE EXCEPTION 'Sem permissão para emitir documentos.'; END IF;
  SELECT COALESCE(max(revision),0)+1 INTO doc_revision FROM public.test_documents WHERE test_id=t.id;
  SELECT NOT EXISTS(SELECT 1 FROM public.test_sessions WHERE test_id=t.id) OR EXISTS(SELECT 1 FROM public.test_sessions WHERE test_id=t.id AND status<>'completed') INTO is_partial;
  SELECT jsonb_build_object('test',to_jsonb(t),'sessions',COALESCE((SELECT jsonb_agg(to_jsonb(ss)||jsonb_build_object('event',to_jsonb(ev),'responsible',COALESCE(NULLIF(p.full_name,''),p.email),'participants',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',COALESCE(NULLIF(pp.full_name,''),pp.email),'kind',i.kind,'response',i.response)) FROM public.agenda_invitees i JOIN public.profiles pp ON pp.id=i.user_id WHERE i.event_id=ev.id),'[]'::jsonb),'safety',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',COALESCE(NULLIF(ap.full_name,''),ap.email),'version',c.version,'body',c.body,'accepted_at',a.created_at)) FROM public.test_safety_acknowledgments a JOIN public.test_checklists c ON c.id=a.checklist_id JOIN public.profiles ap ON ap.id=a.user_id WHERE a.session_id=ss.id),'[]'::jsonb),'datasets',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at) FROM public.test_datasets d WHERE d.session_id=ss.id),'[]'::jsonb)) ORDER BY ss.created_at) FROM public.test_sessions ss JOIN public.agenda_events ev ON ev.id=ss.event_id JOIN public.profiles p ON p.id=ev.organizer_id WHERE ss.test_id=t.id),'[]'::jsonb),'sector',(SELECT name FROM public.sectors WHERE id=t.sector_id),'issuer',(SELECT COALESCE(NULLIF(full_name,''),email) FROM public.profiles WHERE id=u)) INTO doc_snapshot;
  INSERT INTO public.test_documents(test_id,revision,partial,snapshot,issued_by) VALUES(t.id,doc_revision,is_partial,doc_snapshot,u) RETURNING id INTO result_id;
 ELSE RAISE EXCEPTION 'Ação inválida.'; END IF;
 INSERT INTO public.audit_log(actor_id,area,action,entity,entity_id,details) VALUES(u,'operacional','test_'||_action,'tests',t.id::text,jsonb_build_object('record_id',result_id,'session_id',_session));
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.test_analysis_command(text,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.test_analysis_command(text,uuid,uuid,jsonb) TO authenticated;