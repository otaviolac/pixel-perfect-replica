import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { techHistoryQuery } from '@/lib/technical';
import { fmtDateTime } from '@/lib/format';

const base = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function Field({ label, name, type = 'text', required, defaultValue, area, step }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | number | null; area?: boolean; step?: string }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}{required && ' *'}</span>
    {area ? <textarea name={name} required={required} defaultValue={defaultValue ?? ''} rows={3} className={base} />
      : <input name={name} type={type} step={step} required={required} defaultValue={defaultValue ?? ''} className={base} />}</label>;
}

export function Pick({ label, name, options, required, defaultValue, empty }: { label: string; name: string; options: [string, string][]; required?: boolean; defaultValue?: string | number | null; empty?: string }) {
  return <label className="block space-y-1 text-sm"><span className="font-medium">{label}{required && ' *'}</span>
    <select name={name} required={required} defaultValue={defaultValue == null ? '' : String(defaultValue)} className={base}>
      {(empty !== undefined || !required) && <option value="">{empty ?? '—'}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select></label>;
}

/** Formulário recolhível; onSubmit recebe os dados e fecha ao concluir. */
export function FormToggle({ label, children, onSubmit, pending }: { label: string; children: ReactNode; onSubmit: (f: FormData) => Promise<unknown>; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{label}</Button>;
  return <form className="space-y-3 rounded-lg border bg-card p-4" onSubmit={async e => { e.preventDefault(); try { await onSubmit(new FormData(e.currentTarget)); setOpen(false); } catch { /* erro já exibido */ } }}>
    <div className="flex items-center justify-between"><h2 className="font-semibold">{label}</h2><Button type="button" variant="ghost" size="icon" aria-label="Fechar" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
    <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    <Button type="submit" disabled={pending}>Salvar</Button>
  </form>;
}

export function Empty({ children }: { children: ReactNode }) { return <p className="border-y py-10 text-center text-sm text-muted-foreground">{children}</p>; }

export function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value?.toString().trim()) return null;
  return <p className="text-sm"><span className="text-muted-foreground">{label}: </span><span className="whitespace-pre-wrap">{value}</span></p>;
}

export function TechHistory({ kind, id, names }: { kind: string; id: string; names: Map<string, string> }) {
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ ...techHistoryQuery(kind, id), enabled: open });
  return <div><button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 text-xs text-muted-foreground underline"><History className="h-3 w-3" />Histórico</button>
    {open && <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{data.length === 0 && <li>Sem registros.</li>}
      {data.map(h => <li key={h.id}>{fmtDateTime(h.created_at)} · {names.get(h.actor ?? '') ?? '—'} · {h.action === 'insert' ? 'criado' : `alterado: ${Object.keys(h.changes as object).join(', ')}`}</li>)}</ul>}</div>;
}
