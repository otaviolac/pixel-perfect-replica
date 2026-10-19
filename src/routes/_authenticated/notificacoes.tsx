import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { toast } from 'sonner';
import { notificationsQuery, pageHead } from '@/lib/tasks';
import { fmtDateTime } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
export const Route = createFileRoute('/_authenticated/notificacoes')({ head: () => pageHead('Notificações', 'Avisos de tarefas e solicitações da equipe Aerodesign.'), loader: ({ context }) => context.queryClient.ensureQueryData(notificationsQuery), component: Notifications });
function Notifications() {
  const { data } = useSuspenseQuery(notificationsQuery); const qc = useQueryClient();
  async function read(id?: string) { let q = supabase.from('notifications').update({read_at:new Date().toISOString()}).is('read_at',null); if (id) q=q.eq('id',id); const r=await q; if (r.error) toast.error('Não foi possível marcar como lida.'); else qc.invalidateQueries({queryKey:['notifications']}); }
  return <div className="space-y-6"><div className="flex flex-wrap justify-between gap-3"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Bell className="h-6 w-6" />Notificações</h1><Button variant="outline" disabled={!data.some(n=>!n.read_at)} onClick={()=>read()}><Check className="h-4 w-4" />Marcar todas como lidas</Button></div>{data.length===0 && <p className="border-y py-12 text-center text-muted-foreground">Nenhuma notificação.</p>}<div className="divide-y">{data.map(n=><article key={n.id} className={`flex items-start gap-3 py-4 ${n.read_at?'text-muted-foreground':'text-foreground'}`}><div className="min-w-0 flex-1">{n.task_id?<Link to="/tarefas/$taskId" params={{taskId:n.task_id}} className="break-words font-medium underline">{n.title}</Link>:<p className="font-medium">{n.title}</p>}{n.body && <p className="mt-1 text-sm">{n.body}</p>}<p className="mt-2 text-xs text-muted-foreground">{fmtDateTime(n.created_at)}</p></div>{!n.read_at && <Button variant="ghost" size="icon" title="Marcar como lida" aria-label="Marcar como lida" onClick={()=>read(n.id)}><Check className="h-4 w-4" /></Button>}</article>)}</div></div>;
}