import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { agendaCommand } from '@/lib/agenda.functions';
import { agendaQuery, type AgendaEvent } from '@/lib/agenda';
import { eventsOverlap } from '@/lib/agenda-rules';
import { useMe, membersQuery, sectorsQuery } from '@/lib/me';
import { isoToSpLocal, spLocalToISO } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const selectClass='h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
export function AgendaForm({ kind, current, onClose }: {kind:'meeting'|'general'; current?:AgendaEvent; onClose:()=>void}) {
  const {data:me}=useMe(); const {data:members=[]}=useQuery(membersQuery); const {data:sectors=[]}=useQuery(sectorsQuery); const {data:calendar}=useQuery(agendaQuery);
  const command=useServerFn(agendaCommand); const qc=useQueryClient(); const navigate=useNavigate();
  const [title,setTitle]=useState(current?.title??''); const [starts,setStarts]=useState(current?isoToSpLocal(current.starts_at):''); const [ends,setEnds]=useState(current?isoToSpLocal(current.ends_at):'');
  const [location,setLocation]=useState(current?.location??''); const [agenda,setAgenda]=useState(current?.agenda??''); const [sector,setSector]=useState(current?.sector_id??me?.sector_id??1);
  const [organizer,setOrganizer]=useState(current?.organizer_id??me?.id??''); const [people,setPeople]=useState<string[]>([]); const [team,setTeam]=useState(false); const [inviteKind,setInviteKind]=useState('invitation');
  const [recurrence,setRecurrence]=useState('none'); const [occurrences,setOccurrences]=useState(4); const [busy,setBusy]=useState(false);
  const eligible=members.filter(p=>p.active && (me?.role!=='membro'||p.sector_id===me.sector_id));
  const selected=team?eligible.map(p=>p.id):people;
  const conflicts=starts&&ends ? (calendar?.events??[]).filter(e=>e.id!==current?.id&&!e.archived_at&&['scheduled','pending'].includes(e.status)&&eventsOverlap({starts_at:spLocalToISO(starts),ends_at:spLocalToISO(ends)},e)&&(e.organizer_id===organizer||(calendar?.invitees??[]).some(i=>i.event_id===e.id&&selected.includes(i.user_id)))):[];
  async function save(e:React.FormEvent) {
    e.preventDefault(); if(ends<=starts){toast.error('O término deve ser posterior ao início.');return;} setBusy(true);
    try {
      const result=await command({data:{action:current?'edit':'create',event:current?.id,payload:{title,kind,starts_at:spLocalToISO(starts),ends_at:spLocalToISO(ends),location,agenda,sector_id:sector,organizer_id:organizer,invitees:people,team_wide:team,invite_kind:inviteKind,recurrence,occurrences}}});
      await qc.invalidateQueries(); toast.success(current?'Evento atualizado.':me?.role==='membro'?'Proposta enviada para aprovação.':'Evento agendado.'); onClose();
      if(!current) navigate({to:'/agenda/$eventId',params:{eventId:result.id}});
    }catch(error){toast.error(error instanceof Error?error.message:'Não foi possível salvar.');}finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{current?'Editar evento':kind==='meeting'?(me?.role==='membro'?'Propor reunião':'Nova reunião'):'Novo evento'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={save}>
      <div className="space-y-2"><Label htmlFor="event-title">Título</Label><Input id="event-title" required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-start">Início (Brasília)</Label><Input id="event-start" type="datetime-local" required value={starts} onChange={e=>setStarts(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="event-end">Término (Brasília)</Label><Input id="event-end" type="datetime-local" required value={ends} onChange={e=>setEnds(e.target.value)}/></div></div>
      <div className="space-y-2"><Label htmlFor="event-location">Local</Label><Input id="event-location" required value={location} onChange={e=>setLocation(e.target.value)}/></div>
      <div className="space-y-2"><Label htmlFor="event-agenda">Pauta — opcional</Label><Textarea id="event-agenda" value={agenda} onChange={e=>setAgenda(e.target.value)}/></div>
      {!current&&<>
        <div className="space-y-2"><Label htmlFor="event-sector">Setor responsável</Label><select id="event-sector" className={selectClass} value={sector} disabled={me?.role!=='capitao'} onChange={e=>setSector(Number(e.target.value))}>{sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="event-organizer">Organizador / responsável</Label><select id="event-organizer" className={selectClass} required value={organizer} disabled={me?.role==='membro'} onChange={e=>setOrganizer(e.target.value)}>{members.filter(p=>p.active&&(me?.role==='capitao'||p.sector_id===me?.sector_id)).map(p=><option key={p.id} value={p.id}>{p.full_name||p.email}</option>)}</select></div>
        {me?.role!=='membro'&&<label className="flex items-center gap-2 text-sm"><Checkbox checked={team} onCheckedChange={v=>setTeam(v===true)}/>Equipe inteira</label>}
        {!team&&<fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Convidados</legend><div className="max-h-48 space-y-2 overflow-y-auto border-y py-3">{eligible.map(p=><label key={p.id} className="flex items-start gap-2 text-sm"><Checkbox checked={people.includes(p.id)} onCheckedChange={()=>setPeople(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):[...ids,p.id])}/><span className="min-w-0 break-words">{p.full_name||p.email}<span className="block text-xs text-muted-foreground">{sectors.find(s=>s.id===p.sector_id)?.name}</span></span></label>)}</div></fieldset>}
        <div className="space-y-2"><Label htmlFor="event-invite">Participação</Label><select id="event-invite" className={selectClass} value={inviteKind} onChange={e=>setInviteKind(e.target.value)}><option value="invitation">Convite</option><option value="notice">Aviso informativo</option>{me?.role!=='membro'&&<option value="convocation">Convocação</option>}</select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="event-rec">Recorrência</Label><select id="event-rec" className={selectClass} value={recurrence} onChange={e=>setRecurrence(e.target.value)}><option value="none">Não se repete</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select></div>{recurrence!=='none'&&<div className="space-y-2"><Label htmlFor="event-count">Número de encontros</Label><Input id="event-count" type="number" min={1} max={52} required value={occurrences} onChange={e=>setOccurrences(Number(e.target.value))}/></div>}</div>
      </>}
      {conflicts.length>0&&<div role="status" className="flex gap-2 border-l-2 border-warning bg-warning/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0"/><div>Conflito de horário: {conflicts.map(e=>e.title).join(', ')}.</div></div>}
      <Button className="w-full" disabled={busy} type="submit">{busy?'Salvando…':current?'Salvar alterações':me?.role==='membro'?'Enviar proposta':'Agendar'}</Button>
    </form>
  </DialogContent></Dialog>;
}