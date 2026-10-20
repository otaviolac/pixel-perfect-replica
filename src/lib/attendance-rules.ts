import type { Me } from './me';

export const ATTENDANCE_STATUS = {
  present: 'Presente', absent: 'Ausente', justified: 'Ausência justificada aceita',
  excused: 'Dispensado', unrecorded: 'Não registrado',
} as const;
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS;
export type AttendanceEntry = {
  status: string; kind: string; attendance_enabled: boolean; event_kind: string;
};
export function attendancePercentage(rows: AttendanceEntry[]) {
  const eligible = rows.filter(r => r.attendance_enabled && r.kind === 'convocation' && ['meeting','general','normal_test'].includes(r.event_kind));
  const present = eligible.filter(r => r.status === 'present').length;
  const absent = eligible.filter(r => r.status === 'absent').length;
  return { present, absent, total: present + absent, percentage: present + absent ? present / (present + absent) * 100 : null };
}
export function canSeeAttendance(me: Pick<Me,'id'|'role'|'sector_id'> | null | undefined, subject: {id: string; sector_id: number}) {
  return !!me && (me.id === subject.id || me.role === 'capitao' || (me.role === 'gerente' && me.sector_id === subject.sector_id));
}