import { describe, expect, it } from 'vitest';
import { attendancePercentage, canSeeAttendance, type AttendanceEntry } from '../lib/attendance-rules';
const row = (status: string, extra: Partial<AttendanceEntry> = {}): AttendanceEntry => ({status, kind:'convocation',attendance_enabled:true,event_kind:'meeting',...extra});
describe('assiduidade', () => {
  it('calcula presenças / (presenças + ausências) * 100', () => { expect(attendancePercentage([row('present'),row('present'),row('absent')]).percentage).toBeCloseTo(66.6667); });
  it('exclui justificadas e dispensas', () => { expect(attendancePercentage([row('present'),row('justified'),row('excused')]).total).toBe(1); });
  it('não registrado não é ausência', () => { expect(attendancePercentage([row('unrecorded')]).percentage).toBeNull(); });
  it('sem dados não é zero nem cem', () => { expect(attendancePercentage([]).percentage).toBeNull(); });
  it('desabilitar exclui e reabilitar restaura o cálculo', () => { expect(attendancePercentage([row('absent',{attendance_enabled:false})]).percentage).toBeNull(); expect(attendancePercentage([row('absent')]).percentage).toBe(0); });
  it('convite e aviso não contam', () => { expect(attendancePercentage([row('absent',{kind:'invitation'}),row('present',{kind:'notice'})]).total).toBe(0); });
  it('teste rápido nunca conta', () => { expect(attendancePercentage([row('present',{event_kind:'quick_test'})]).total).toBe(0); });
  it('voluntária nunca conta', () => { expect(attendancePercentage([row('absent',{event_kind:'voluntary'})]).total).toBe(0); });
  it('teste normal convocado com chamada conta', () => { expect(attendancePercentage([row('present',{event_kind:'normal_test'})]).percentage).toBe(100); });
  it('titular vê só seus dados', () => { expect(canSeeAttendance({id:'a',role:'membro',sector_id:1},{id:'b',sector_id:1})).toBe(false); expect(canSeeAttendance({id:'a',role:'trainee',sector_id:1},{id:'a',sector_id:1})).toBe(true); });
  it('gerente vê somente seu setor', () => { expect(canSeeAttendance({id:'a',role:'gerente',sector_id:1},{id:'b',sector_id:2})).toBe(false); expect(canSeeAttendance({id:'a',role:'gerente',sector_id:1},{id:'b',sector_id:1})).toBe(true); });
  it('capitão vê a equipe', () => { expect(canSeeAttendance({id:'a',role:'capitao',sector_id:1},{id:'b',sector_id:2})).toBe(true); });
});