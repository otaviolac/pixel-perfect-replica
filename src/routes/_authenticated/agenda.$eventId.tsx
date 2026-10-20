import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, MapPin, Clock, Paperclip, Check, X, Archive } from 'lucide-react';
import { agendaDetailQuery } from '@/lib/agenda';
import { agendaCommand } from '@/lib/agenda.functions';
import { flagsQuery, pageHead } from '@/lib/tasks';
import { useMe, membersQuery, sectorsQuery } from '@/lib/me';
import { canManageEvent, EVENT_STATUS, INVITE_KIND, RESPONSE } from '@/lib/agenda-rules';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { AgendaForm } from '@/components/AgendaForm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AttendancePanel } from '@/components/AttendancePanel';
import { eventAttendanceQuery } from '@/lib/attendance';

export const Route=createFileRoute('/_authenticated/agenda/$eventId')({head:()=>pageHead('Detalhes do evento','Organização, participantes, aprovação e histórico do evento da equipe Aerodesign.'),loader:({context,params})=>Promise.all([context.queryClient.ensureQueryData(agendaDetailQuery(params.eventId)),context.queryClient.ensureQueryData(flagsQuery),context.queryClient.ensureQueryData(eventAttendanceQuery(params.eventId))]),component:EventDetail});
function EventDetail(){
  const {eventId}=Route.useParams(); const {data:{event,invitees,history,files}}=useSuspenseQuery(agendaDetailQuery(eventId)); const {data:flags}=useSuspenseQuery(flagsQuery);
  const {data:me}=useMe(); const {data:members=[]}=useQuery(membersQuery); const {data:sectors=[]}=useQuery(sectorsQuery); const qc=useQueryClient(); const command=useServerFn(agendaCommand);
  const [edit,setEdit]=useState(false); const [minutes,setMinutes]=useState<string|null>(null); const [busy,setBusy]=useState(false);
  const enabled=flags.some(f=>f.key==='agenda'&&f.enabled)&&(event.kind!=='meeting'||flags.some(f=>f.key==='reunioes'&&f.enabled));
  const manager=canManageEvent(me,event); const manage=enabled&&manager; const owner=me?.id===event.organizer_id; const pendingOwn=enabled&&me?.role==='membro'&&event.created_by===me.id&&event.status==='pending';
  const mine=invitees.find(i=>i.user_id===me?.id); const person=(id:string)=>members.find(p=>p.id===id)?.full_name||members.find(p=>p.id===id)?.email||'Integrante';
  async function act(action:'approve'|'reject'|'respond'|'cancel'|'complete'|'minutes'|'archive'|'file',payload:Record<string,unknown>={}){
    setBusy(true); try{await command({data:{action,event:eventId,payload}});await qc.invalidateQueries();toast.success('Registro atualizado.');return true;}catch(error){toast.error(error instanceof Error?error.message:'Não foi possível atualizar.');return false;}finally{setBusy(false);}
  }
  async function upload(file:File|undefined){
    if(!file||!me)return; if(file.size>20*1024*1024){toast.error('O arquivo deve ter até 20 MB.');return;}
    setBusy(true);const path=`${eventId}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\-]/g,'_')}`;
    const result=await supabase.storage.from('agenda-files').upload(path,file);
    if(result.error){toast.error('Não foi possível anexar o arquivo.');setBusy(false);return;}
    const saved=await act('file',{path,name:file.name});if(!saved)await supabase.storage.from('agenda-files').remove([path]);
  }
  async function download(path:string){const result=await supabase.storage.from('agenda-files').createSignedUrl(path,60);if(result.error||!result.data){toast.error('Não foi possível abrir o anexo.');return;}window.open(result.data.signedUrl,'_blank','noopener,noreferrer');}
  const actionLabel:Record<string,string>={create:'Evento criado',edit:'Evento alterado',approve:'Proposta aprovada',reject:'Proposta não aprovada',respond:'Resposta de participação',cancel:'Evento cancelado',complete:'Evento concluído',minutes:'Ata registrada',archive:'Evento arquivado',file:'Anexo registrado',attendance_toggle:'Estado da chamada alterado',attendance_summon:'Convocação registrada'};
  return <div className="space-y-6">
    <Link to="/agenda" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>Agenda da equipe</Link>
    <header className="space-y-3 border-b pb-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs uppercase text-muted-foreground">{event.kind==='meeting'?'Reunião':'Evento geral'}{event.recurrence!=='none'?' · Recorrente':''}</p><h1 className="mt-2 break-words text-2xl font-semibold">{event.title}</h1></div>{(manage||pendingOwn)&&['scheduled','pending'].includes(event.status)&&<Button variant="outline" disabled={busy} onClick={()=>setEdit(true)}><Pencil className="h-4 w-4"/>Editar</Button>}</div>
      <p className={`text-sm font-medium ${event.status==='pending'?'text-warning':event.status==='cancelled'||event.status==='rejected'?'text-destructive':'text-primary'}`}>{EVENT_STATUS[event.status]}{event.archived_at?' · Arquivado':''}</p>
      <p className="flex items-start gap-2 text-sm"><Clock className="h-4 w-4 shrink-0"/>{fmtDateTime(event.starts_at)} — {fmtDateTime(event.ends_at)}</p><p className="flex items-start gap-2 break-words text-sm"><MapPin className="h-4 w-4 shrink-0"/>{event.location}</p>
      <p className="break-words text-sm text-muted-foreground">Responsável: {person(event.organizer_id)} · {sectors.find(s=>s.id===event.sector_id)?.name}</p>
    </header>
    {!enabled&&<p className="border-l-2 border-warning p-3 text-sm">Módulo desabilitado. Histórico preservado.</p>}
    {event.status==='pending'&&<section className="space-y-3 border-l-2 border-warning bg-warning/10 p-4"><h2 className="font-semibold">Aprovação da reunião</h2><p className="text-sm">Aguardando decisão da gerência. Os convidados receberam somente aviso informativo.</p>{manage&&<div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>act('approve')}><Check className="h-4 w-4"/>Aprovar reunião</Button><Button disabled={busy} variant="outline" onClick={()=>act('reject')}><X className="h-4 w-4"/>Não aprovar</Button></div>}</section>}
    {event.agenda&&<section className="space-y-2"><h2 className="font-semibold">Pauta</h2><p className="whitespace-pre-wrap break-words text-sm">{event.agenda}</p></section>}
    {enabled&&event.status==='scheduled'&&mine&&mine.kind!=='notice'&&<section className="space-y-3"><h2 className="font-semibold">Sua participação</h2><p className="text-sm text-muted-foreground">{INVITE_KIND[mine.kind]} · {RESPONSE[mine.response]}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} variant={mine.response==='yes'?'default':'outline'} onClick={()=>act('respond',{response:'yes'})}><Check className="h-4 w-4"/>Vou participar</Button><Button disabled={busy} variant={mine.response==='no'?'secondary':'outline'} onClick={()=>act('respond',{response:'no'})}><X className="h-4 w-4"/>Não poderei</Button></div></section>}
    <section className="space-y-3"><h2 className="font-semibold">Convidados</h2><div className="divide-y">{invitees.map(i=><div key={i.user_id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><p className="min-w-0 break-words">{person(i.user_id)}</p><p className="text-xs text-muted-foreground">{event.status==='pending'?'Aviso informativo':INVITE_KIND[i.kind]}{event.status!=='pending'&&i.kind!=='notice'?` · ${RESPONSE[i.response]}`:''}</p></div>)}</div></section>
    {event.kind==='meeting'&&<section className="space-y-3"><h2 className="font-semibold">Ata — opcional</h2>{enabled&&(manager||owner)&&['scheduled','completed'].includes(event.status)?<><Label className="sr-only" htmlFor="event-minutes">Ata</Label><Textarea id="event-minutes" rows={5} value={minutes??event.minutes} onChange={e=>setMinutes(e.target.value)}/><Button disabled={busy} variant="outline" onClick={()=>act('minutes',{minutes:minutes??event.minutes})}>Salvar ata</Button><div className="space-y-2"><Label htmlFor="event-file" className="flex items-center gap-2"><Paperclip className="h-4 w-4"/>Anexar à ata</Label><Input id="event-file" type="file" disabled={busy} onChange={e=>{const file=e.target.files?.[0];void upload(file);e.target.value='';}}/></div></>:<p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.minutes||'Nenhuma ata registrada.'}</p>}{files.map(f=><Button key={f.id} variant="link" className="h-auto max-w-full justify-start whitespace-normal break-all px-0" onClick={()=>download(f.path)}><Paperclip className="h-4 w-4 shrink-0"/>{f.name}</Button>)}</section>}
    {manage&&<div className="flex flex-wrap gap-2 border-y py-4">{event.status==='scheduled'&&<Button disabled={busy} onClick={()=>act('complete')}><Check className="h-4 w-4"/>Concluir evento</Button>}{['scheduled','pending'].includes(event.status)&&<Button disabled={busy} variant="outline" onClick={()=>{if(window.confirm('Cancelar este evento e avisar os participantes?'))void act('cancel');}}><X className="h-4 w-4"/>Cancelar evento</Button>}{!event.archived_at&&['completed','cancelled'].includes(event.status)&&<Button disabled={busy} variant="outline" onClick={()=>act('archive')}><Archive className="h-4 w-4"/>Arquivar evento</Button>}</div>}
    <section className="space-y-3"><h2 className="font-semibold">Histórico</h2><div className="divide-y">{history.map(h=><p key={h.id} className="break-words py-3 text-xs text-muted-foreground">{actionLabel[h.action]??h.action} · {person(h.actor_id)} · {fmtDateTime(h.created_at)}</p>)}</div></section>
    <AttendancePanel event={event} invitees={invitees} manager={manager} owner={owner} enabled={enabled} person={person} canSummon={id=>me?.role==='capitao'||(me?.role==='gerente'&&members.some(p=>p.id===id&&p.sector_id===me.sector_id))}/>
    {edit&&<AgendaForm kind={event.kind==='meeting'?'meeting':'general'} current={event} onClose={()=>setEdit(false)}/>}
  </div>;
}