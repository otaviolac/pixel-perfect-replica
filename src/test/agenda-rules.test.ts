import { describe, expect, it } from 'vitest';
import { canCreateEvent, canInviteSector, canManageEvent, eventsOverlap } from '@/lib/agenda-rules';
import { spLocalToISO } from '@/lib/format';

describe('Agenda da equipe', () => {
  it('trainee não agenda reunião nem evento', () => { expect(canCreateEvent('trainee','meeting')).toBe(false); expect(canCreateEvent('trainee','general')).toBe(false); });
  it('membro propõe apenas reunião do próprio setor', () => { expect(canCreateEvent('membro','meeting')).toBe(true); expect(canCreateEvent('membro','general')).toBe(false); expect(canInviteSector('membro',1,1)).toBe(true); expect(canInviteSector('membro',1,2)).toBe(false); });
  it('gerente e capitão podem convidar entre setores', () => { expect(canInviteSector('gerente',1,2)).toBe(true); expect(canInviteSector('capitao',1,8)).toBe(true); });
  it('gerente convidado não ganha autoridade só pelo convite', () => { expect(canManageEvent({id:'g2',role:'gerente',sector_id:2},{sector_id:1,organizer_id:'g1',created_by:'g1'})).toBe(false); });
  it('organizador gerente e capitão têm autoridade sobre evento', () => { const e={sector_id:1,organizer_id:'g2',created_by:'g1'}; expect(canManageEvent({id:'g2',role:'gerente',sector_id:2},e)).toBe(true); expect(canManageEvent({id:'c',role:'capitao',sector_id:8},e)).toBe(true); });
  it('admin sem cargo competente não ganha permissão operacional', () => { const me={id:'a',role:'trainee' as const,sector_id:1,isAdmin:true}; expect(canManageEvent(me,{sector_id:1,organizer_id:'g',created_by:'g'})).toBe(false); });
  it('horário da reunião em Brasília é salvo em UTC', () => { expect(spLocalToISO('2026-10-21T12:00')).toBe('2026-10-21T15:00:00.000Z'); });
  it('conflitos usam intervalos, não bloqueiam horários adjacentes', () => { const a={starts_at:'2026-10-21T15:00:00Z',ends_at:'2026-10-21T16:00:00Z'}; expect(eventsOverlap(a,{starts_at:'2026-10-21T15:30:00Z',ends_at:'2026-10-21T16:30:00Z'})).toBe(true); expect(eventsOverlap(a,{starts_at:'2026-10-21T16:00:00Z',ends_at:'2026-10-21T17:00:00Z'})).toBe(false); });
});