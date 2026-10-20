import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { attendanceQuery } from '@/lib/attendance';
import { attendancePercentage, canSeeAttendance, ATTENDANCE_STATUS, type AttendanceStatus } from '@/lib/attendance-rules';
import { meQuery, membersQuery } from '@/lib/me';
import { pageHead } from '@/lib/tasks';
import { fmtDateTime, isoToSpLocal } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const Route=createFileRoute('/_authenticated/assiduidade')({
  head:()=>pageHead('Assiduidade','Presenças e ausências registradas nos eventos convocados da equipe Aerodesign.'),
  loader:({context})=>Promise.all([context.queryClient.ensureQueryData(attendanceQuery),context.queryClient.ensureQueryData(meQuery),context.queryClient.ensureQueryData(membersQuery)]),component:AttendancePage,
});
function AttendancePage(){
  const {data:rows}=useSuspenseQuery(attendanceQuery);const {data:me}=useSuspenseQuery(meQuery);const {data:members}=useSuspenseQuery(membersQuery);
  const [subject,setSubject]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [kind,setKind]=useState('all');
  const people=members.filter(p=>canSeeAttendance(me,p)); const selected=subject||me?.id||'';
  const filtered=rows.filter(r=>{const date=isoToSpLocal(r.agenda_events.starts_at).slice(0,10);return r.user_id===selected&&(!from||date>=from)&&(!to||date<=to)&&(kind==='all'||r.agenda_events.kind===kind);});
  const stats=attendancePercentage(filtered.map(r=>({status:r.status,kind:r.invite_kind,attendance_enabled:r.agenda_events.attendance_enabled&&['scheduled','completed'].includes(r.agenda_events.status),event_kind:r.agenda_events.kind})));
  return <div className="space-y-6"><header className="border-b pb-5"><h1 className="text-2xl font-semibold">Assiduidade</h1></header>
    <div className="grid gap-4 sm:grid-cols-2">{(me?.role==='gerente'||me?.role==='capitao')&&<div className="space-y-2"><Label>Integrante</Label><Select value={selected} onValueChange={setSubject}><SelectTrigger aria-label="Integrante"><SelectValue/></SelectTrigger><SelectContent>{people.map(p=><SelectItem key={p.id} value={p.id}>{p.full_name||p.email}</SelectItem>)}</SelectContent></Select></div>}
      <div className="space-y-2"><Label>Tipo de evento</Label><Select value={kind} onValueChange={setKind}><SelectTrigger aria-label="Tipo de evento"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="meeting">Reuniões</SelectItem><SelectItem value="general">Eventos gerais</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="attendance-from">De</Label><Input id="attendance-from" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="space-y-2"><Label htmlFor="attendance-to">Até</Label><Input id="attendance-to" type="date" min={from||undefined} value={to} onChange={e=>setTo(e.target.value)}/></div>
    </div>
    <section className="space-y-4 border-y py-6"><h2 className="text-sm font-medium text-muted-foreground">{people.find(p=>p.id===selected)?.full_name||people.find(p=>p.id===selected)?.email||'Minha assiduidade'}</h2><p className="break-words text-3xl font-semibold text-primary">{stats.percentage===null?'Sem dados para cálculo':`${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(stats.percentage)}%`}</p><div className="flex flex-wrap gap-6 text-sm"><span>{stats.present} presenças</span><span>{stats.absent} ausências não justificadas</span></div></section>
    <section className="space-y-3"><h2 className="font-semibold">Registros de chamada</h2>{filtered.length===0?<p className="text-sm text-muted-foreground">Nenhum registro neste período.</p>:<div className="divide-y">{filtered.map(r=><div key={`${r.event_id}/${r.user_id}`} className="space-y-2 py-4"><Link to="/agenda/$eventId" params={{eventId:r.event_id}} className="break-words text-sm font-medium text-primary">{r.agenda_events.title}</Link><p className="text-xs text-muted-foreground">{fmtDateTime(r.agenda_events.starts_at)}</p><p className="break-words text-sm">{ATTENDANCE_STATUS[r.status as AttendanceStatus]}{!r.agenda_events.attendance_enabled?' · Chamada desabilitada':''}{r.invite_kind!=='convocation'?' · Sem convocação':''}</p>{r.note&&<p className="break-words text-xs text-muted-foreground">{r.note}</p>}</div>)}</div>}</section>
  </div>;
}