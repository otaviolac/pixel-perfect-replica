import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { ClipboardCheck } from 'lucide-react';
import { eventAttendanceQuery } from '@/lib/attendance';
import { attendanceCommand } from '@/lib/attendance.functions';
import { ATTENDANCE_STATUS, type AttendanceStatus } from '@/lib/attendance-rules';
import type { AgendaEvent } from '@/lib/agenda';
import type { Tables } from '@/integrations/supabase/types';
import { fmtDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export function AttendancePanel({event,invitees,manager,owner,enabled,person,canSummon}: {event:AgendaEvent;invitees:Tables<'agenda_invitees'>[];manager:boolean;owner:boolean;enabled:boolean;person:(id:string)=>string;canSummon:(id:string)=>boolean}) {
  const {data:{records,history}}=useSuspenseQuery(eventAttendanceQuery(event.id));
  const qc=useQueryClient(); const command=useServerFn(attendanceCommand); const [busy,setBusy]=useState(false);
  const active=['scheduled','completed'].includes(event.status);
  async function act(action:'toggle'|'record'|'summon',payload:{enabled?:boolean;user_id?:string;status?:AttendanceStatus;note?:string}) {
    setBusy(true);try{await command({data:{action,event:event.id,payload}});await qc.invalidateQueries();toast.success('Chamada atualizada.');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}
  }
  return <section className="space-y-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><ClipboardCheck className="h-5 w-5"/>Chamada</h2><div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{event.attendance_enabled?'Habilitada':'Desabilitada'}</span>{manager&&<Switch aria-label="Habilitar chamada" checked={event.attendance_enabled} disabled={busy||!enabled||(!active&&!event.attendance_enabled)} onCheckedChange={value=>void act('toggle',{enabled:value})}/>}</div></div>
    {invitees.filter(i=>i.kind==='convocation').length===0&&<p className="text-sm text-muted-foreground">Nenhum integrante convocado.</p>}
    <div className="divide-y">{invitees.filter(i=>i.kind==='convocation').map(i=>{
      const record=records.find(r=>r.user_id===i.user_id);
      if(!record&&!manager&&!owner) return null;
      return <AttendanceRow key={i.user_id} name={person(i.user_id)} status={(record?.status??'unrecorded') as AttendanceStatus} note={record?.note??''} editable={enabled&&event.attendance_enabled&&active&&(manager||owner)} busy={busy} onSave={(status,note)=>void act('record',{user_id:i.user_id,status,note})}/>;
    })}</div>
    {manager&&enabled&&active&&invitees.some(i=>i.kind!=='convocation'&&canSummon(i.user_id))&&<div className="space-y-2"><h3 className="text-sm font-medium">Convocações</h3>{invitees.filter(i=>i.kind!=='convocation'&&canSummon(i.user_id)).map(i=><div key={i.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="break-words text-sm">{person(i.user_id)}</span><Button size="sm" variant="outline" disabled={busy} onClick={()=>void act('summon',{user_id:i.user_id})}>Convocar</Button></div>)}</div>}
    {history.length>0&&<details><summary className="cursor-pointer text-sm font-medium">Histórico da chamada</summary><div className="mt-2 divide-y">{history.map(h=><div key={h.id} className="space-y-1 py-3 text-xs text-muted-foreground"><p className="break-words">{person(h.user_id)} · {ATTENDANCE_STATUS[h.new_status as AttendanceStatus]} · {person(h.actor_id)} · {fmtDateTime(h.created_at)}</p>{h.note&&<p className="break-words">{h.note}</p>}</div>)}</div></details>}
  </section>;
}
function AttendanceRow({name,status,note,editable,busy,onSave}:{name:string;status:AttendanceStatus;note:string;editable:boolean;busy:boolean;onSave:(status:AttendanceStatus,note:string)=>void}) {
  const [draft,setDraft]=useState<AttendanceStatus|null>(null); const [text,setText]=useState<string|null>(null);
  return <div className="space-y-3 py-4"><p className="break-words text-sm font-medium">{name}</p>{editable?<><Select value={draft??status} onValueChange={value=>setDraft(value as AttendanceStatus)}><SelectTrigger aria-label={`Presença de ${name}`} className="h-auto min-h-10 w-full whitespace-normal text-left"><SelectValue/></SelectTrigger><SelectContent>{Object.entries(ATTENDANCE_STATUS).map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Input aria-label={`Observação de ${name}`} placeholder="Observação — opcional" value={text??note} maxLength={2000} onChange={e=>setText(e.target.value)}/><Button variant="outline" size="sm" disabled={busy} onClick={()=>onSave(draft??status,text??note)}>Salvar presença</Button></>:<><p className="text-sm text-muted-foreground">{ATTENDANCE_STATUS[status]}</p>{note&&<p className="break-words text-xs text-muted-foreground">{note}</p>}</>}</div>;
}