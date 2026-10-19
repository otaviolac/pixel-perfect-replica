import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useMe, membersQuery, sectorsQuery } from '@/lib/me';
import { taskCommand } from '@/lib/tasks.functions';
import type { Task } from '@/lib/tasks';
import { isoToSpLocal, spLocalToISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
export function TaskForm({ kind, current, onClose }: { kind: 'official' | 'voluntary'; current?: Task; onClose: () => void }) {
  const { data: me } = useMe(); const { data: sectors = [] } = useQuery(sectorsQuery); const { data: members = [] } = useQuery(membersQuery);
  const command = useServerFn(taskCommand); const qc = useQueryClient(); const navigate = useNavigate();
  const [busy, setBusy] = useState(false); const [title, setTitle] = useState(current?.title ?? ''); const [description, setDescription] = useState(current?.description ?? '');
  const [due, setDue] = useState(current?.due_at ? isoToSpLocal(current.due_at) : ''); const [sector, setSector] = useState(current?.sector_id ?? me?.sector_id ?? 1);
  const [owner, setOwner] = useState(current?.owner_id ?? me?.id ?? ''); const [priority, setPriority] = useState(current?.priority ?? 'normal');
  const [execution, setExecution] = useState('collective'); const [whole, setWhole] = useState(false); const [people, setPeople] = useState<string[]>([]);
  const [invited, setInvited] = useState<number[]>([]); const [capacity, setCapacity] = useState(''); const [recurring, setRecurring] = useState(false);
  const togglePerson = (id: string) => setPeople(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const result = await command({ data: { action: current ? 'edit' : 'create', task: current?.id, payload: { title, description, kind, sector_id: sector, owner_id: owner, priority, due_at: due ? spLocalToISO(due) : null, execution, whole_sector: whole, participants: whole ? [] : people, invited_sectors: invited, capacity: capacity ? Number(capacity) : null, recurring } } });
      await qc.invalidateQueries(); toast.success(current ? 'Tarefa atualizada.' : 'Tarefa criada.'); onClose();
      if (!current) navigate({ to: '/tarefas/$taskId', params: { taskId: result.id } });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{current ? 'Editar tarefa' : kind === 'official' ? 'Nova tarefa oficial' : 'Nova tarefa voluntária'}</DialogTitle></DialogHeader>
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="task-title">Título</Label><Input id="task-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="task-description">Descrição</Label><Textarea id="task-description" value={description} onChange={e => setDescription(e.target.value)} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="task-due">Prazo (Brasília){kind === 'voluntary' ? ' — opcional' : ''}</Label><Input id="task-due" type="datetime-local" required={kind === 'official'} value={due} onChange={e => setDue(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="task-priority">Prioridade</Label><select id="task-priority" className={selectClass} value={priority} onChange={e => setPriority(e.target.value)}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></div></div>
      {!current && <><div className="space-y-2"><Label htmlFor="task-sector">Setor responsável</Label><select id="task-sector" className={selectClass} value={sector} onChange={e => { setSector(Number(e.target.value)); setPeople([]); }} disabled={me?.role !== 'capitao'}>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="task-owner">{kind === 'official' ? 'Responsável gerencial' : 'Responsável'}</Label><select id="task-owner" className={selectClass} value={owner} onChange={e => setOwner(e.target.value)} required>{members.filter(p => p.active && (kind === 'voluntary' || p.role === 'capitao' || (p.role === 'gerente' && p.sector_id === sector))).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}</select></div>
      {kind === 'official' ? <>
        <div className="space-y-2"><Label htmlFor="task-execution">Execução</Label><select id="task-execution" className={selectClass} value={execution} onChange={e => { setExecution(e.target.value); setWhole(false); }}><option value="collective">Coletiva</option><option value="individual">Entregas individuais</option></select></div>
        {execution === 'collective' && <label className="flex items-center gap-2 text-sm"><Checkbox checked={whole} onCheckedChange={v => setWhole(v === true)} /> Atribuir ao setor inteiro</label>}
        {!whole && <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Responsáveis</legend>{members.filter(p => p.active && (me?.role === 'capitao' || p.sector_id === sector)).map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={people.includes(p.id)} onCheckedChange={() => togglePerson(p.id)} />{p.full_name || p.email}</label>)}</fieldset>}
      </> : <>
        <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Setores convidados (nenhum = equipe inteira)</legend>{sectors.map(s => <label key={s.id} className="flex items-center gap-2 text-sm"><Checkbox checked={invited.includes(s.id)} onCheckedChange={() => setInvited(p => p.includes(s.id) ? p.filter(x => x !== s.id) : [...p, s.id])} />{s.name}</label>)}</fieldset>
        <div className="space-y-2"><Label htmlFor="task-capacity">Vagas — opcional</Label><Input id="task-capacity" type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={recurring} onCheckedChange={v => setRecurring(v === true)} /> Permanente / recorrente</label>
      </> }</>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Salvando…' : 'Salvar tarefa'}</Button>
    </form></DialogContent></Dialog>;
}