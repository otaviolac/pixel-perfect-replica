import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Plus, ListChecks, HeartHandshake, Clock } from 'lucide-react';
import { tasksQuery, flagsQuery } from '@/lib/tasks';
import { useMe, sectorsQuery } from '@/lib/me';
import { canCreateTask, deadlineState, TASK_STATUS, type TaskStatus } from '@/lib/task-rules';
import { fmtDateTime, countdown } from '@/lib/format';
import { TaskForm, selectClass } from './TaskForm';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function TasksPage({ kind }: { kind: 'official' | 'voluntary' }) {
  const { data: tasks } = useSuspenseQuery(tasksQuery); const { data: flags } = useSuspenseQuery(flagsQuery); const { data: me } = useMe(); const { data: sectors = [] } = useQuery(sectorsQuery);
  const [create, setCreate] = useState(false); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [sector, setSector] = useState('all'); const [group, setGroup] = useState('list');
  const enabled = flags.find(f => f.key === (kind === 'official' ? 'tarefas' : 'voluntarias'))?.enabled;
  if (!enabled) return <div className="space-y-2"><h1 className="text-2xl font-semibold">Módulo desativado</h1><p className="text-muted-foreground">Os registros anteriores estão preservados.</p></div>;
  const filtered = tasks.filter(t => t.kind === kind && t.title.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || t.status === status) && (sector === 'all' || t.sector_id === Number(sector)));
  const groups = group === 'status' ? Object.entries(TASK_STATUS).map(([value, label]) => ({ label, rows: filtered.filter(t => t.status === value) })) : [{ label: '', rows: group === 'due' ? [...filtered].sort((a,b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999')) : filtered }];
  const Icon = kind === 'official' ? ListChecks : HeartHandshake;
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">Operação</p><h1 className="flex items-center gap-2 text-2xl font-semibold"><Icon className="h-6 w-6 text-accent" />{kind === 'official' ? 'Tarefas oficiais' : 'Voluntárias'}</h1></div>{me && canCreateTask(me.role, kind, me.sector_id, me.sector_id) && <Button onClick={() => setCreate(true)}><Plus className="h-4 w-4" />{kind === 'official' ? 'Nova tarefa' : 'Nova voluntária'}</Button>}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Input aria-label="Buscar tarefas" placeholder="Buscar tarefa" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Estado" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(TASK_STATUS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><select aria-label="Setor" className={selectClass} value={sector} onChange={e => setSector(e.target.value)}><option value="all">Todos os setores</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select aria-label="Agrupamento" className={selectClass} value={group} onChange={e => setGroup(e.target.value)}><option value="list">Lista</option><option value="status">Por estado</option><option value="due">Por prazo</option></select></div>
    {filtered.length === 0 && <div className="border-y py-14 text-center"><Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-medium">Nenhuma tarefa encontrada</h2></div>}
    {groups.filter(g => g.rows.length).map(g => <section key={g.label} className="space-y-3">{g.label && <h2 className="font-semibold">{g.label} <span className="text-muted-foreground">({g.rows.length})</span></h2>}<div className="divide-y border-y">{g.rows.map(t => {
      const state = deadlineState(t.due_at, t.status); const cd = t.due_at ? countdown(t.due_at, Date.now()) : null;
      return <Link key={t.id} to="/tarefas/$taskId" params={{ taskId: t.id }} className="block space-y-2 py-4 transition-colors hover:bg-muted/50"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="break-words font-semibold">{t.title}</h3><span className="rounded border px-2 py-1 text-xs">{TASK_STATUS[t.status as TaskStatus]}</span></div><p className="text-xs text-muted-foreground">{sectors.find(s => s.id === t.sector_id)?.name} · {t.priority === 'high' ? 'Alta prioridade' : t.priority === 'low' ? 'Baixa prioridade' : 'Prioridade normal'}</p><p className={`flex flex-wrap items-center gap-2 text-xs ${state === 'overdue' ? 'text-destructive' : state === 'soon' ? 'text-accent' : 'text-muted-foreground'}`}><Clock className="h-3.5 w-3.5" />{t.due_at ? fmtDateTime(t.due_at) : 'Sem prazo'}{state === 'overdue' ? ' · Atrasada' : cd && state !== 'none' ? ` · ${cd.days}d ${cd.hours}h ${cd.minutes}min` : ''}{t.recurring && ' · Recorrente'}</p></Link>;
    })}</div></section>)}
    {create && <TaskForm kind={kind} onClose={() => setCreate(false)} />}
  </div>;
}