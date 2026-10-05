// Thống kê một ván (chỉ quan sát, không thay đổi gì trong mô phỏng).
// Chạy ở máy chơi một mình và máy chủ phòng (có đủ dữ liệu). Hết ván: hiện ở màn kết quả và sao chép được thành văn bản.
import type { World, Agent, GameEvent } from './sim';
import { roomName, roomAt } from './map';

export interface StatEvent { t: number; text: string }
export interface GameStatsSummary {
  players: number; imps: number; killCd: number; discuss: number; vote: number;
  play: number; full: number; firstKill: number | null; firstMeeting: number | null;
  kills: number; meetings: number; sabotages: number; ejectTotal: number; ejectImp: number; noEject: number;
  crewVotes: number; crewVotesOnImp: number; endKind: string; winner: string; kpiAtEnd: number;
  boss: { used: boolean; won: boolean; late: number };
  me: {
    name: string; role: string; won: boolean;
    kills: number; waits: number[]; sabotages: number; hiddenSec: number;
    tasksDone: number; tasksTotal: number; votes: { t: number; target: string; ok: boolean | null }[];
    bossDoneSec: number | null; diedAt: number | null; ejected: boolean;
  };
  timeline: StatEvent[];
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export class GameStats {
  private play = 0;
  /** đồng hồ thật bắt đầu khi vào ca (không tính lúc đọc tờ phân công) */
  private startWall: number | null = null;
  private firstKill: number | null = null;
  private firstMeeting: number | null = null;
  private kills = 0; private sabotages = 0; private meetings = 0;
  private ejectTotal = 0; private ejectImp = 0; private noEject = 0;
  private crewVotes = 0; private crewVotesOnImp = 0;
  private resultSeen = -1;
  private timeline: StatEvent[] = [];
  private meReady: number | null = null;
  private me = { kills: 0, waits: [] as number[], sabotages: 0, hiddenSec: 0, votes: [] as { t: number; target: string; ok: boolean | null }[], bossDoneSec: null as number | null, diedAt: null as number | null };
  private bossAt: number | null = null; private bossUsed = false;
  private finished: GameStatsSummary | null = null;

  constructor(private w: World, private meId: number) {}

  private name(a: Agent) { return `${a.name} #${a.empId}`; }
  private log(text: string) { this.timeline.push({ t: this.play, text }); }

  /** Mỗi khung hình (khi ván không tạm dừng) */
  tick(dt: number) {
    const w = this.w, me = w.agents[this.meId];
    if (w.phase === 'play') {
      if (this.startWall === null) this.startWall = performance.now();
      this.play += dt;
      // Nội gián: hồi chiêu xong (và không đang trốn) thì bắt đầu đếm thời gian tìm mồi
      if (me.role === 'impostor' && me.alive) {
        if (me.hidden !== null) this.me.hiddenSec += dt;
        if (me.killCd <= 0 && this.meReady === null) this.meReady = this.play;
      }
      if (w.sabotage?.kind === 'boss' && me.alive && me.bossDone && this.me.bossDoneSec === null && this.bossAt !== null) this.me.bossDoneSec = this.play - this.bossAt;
    }
    // Kết quả cuộc họp (ghi một lần mỗi cuộc họp)
    const m = w.meeting;
    if (w.phase === 'meeting' && m?.result && this.resultSeen !== w.meetingCount) {
      this.resultSeen = w.meetingCount;
      const ej = m.result.ejected;
      if (ej === null) { this.noEject++; this.log(`Cuộc họp kết thúc: không ai bị sa thải${m.result.tie ? ' (hòa phiếu)' : ''}`); }
      else {
        const a = w.agents[ej];
        this.ejectTotal++; if (a.role === 'impostor') this.ejectImp++;
        this.log(`Sa thải ${this.name(a)}: ${a.role === 'impostor' ? 'ĐÚNG là Nội gián' : 'người vô tội'}`);
      }
      // phiếu của Nhân viên (Nội gián bầu có tính toán nên không tính)
      for (const [voter, target] of m.votes) {
        const v = w.agents[voter];
        if (v.role === 'crew' && target !== 'skip') { this.crewVotes++; if (w.agents[target as number].role === 'impostor') this.crewVotesOnImp++; }
        if (voter === this.meId) this.me.votes.push({ t: this.play, target: target === 'skip' ? 'bỏ qua' : this.name(w.agents[target as number]), ok: target === 'skip' ? null : w.agents[target as number].role === 'impostor' });
      }
      this.meReady = null; // sau họp hồi chiêu đặt lại
    }
  }

  /** Sự kiện của mô phỏng */
  onEvents(evs: GameEvent[]) {
    const w = this.w;
    for (const e of evs) {
      switch (e.type) {
        case 'kill': {
          const k = w.agents[e.killer], v = w.agents[e.victim];
          if (k.role === 'impostor') { this.kills++; if (this.firstKill === null) this.firstKill = this.play; }
          const room = roomAt(e.x, e.y);
          this.log(`${this.name(v)} bị gài${room ? ` ở ${roomName(room)}` : ''} (bởi ${this.name(k)}${k.role === 'impostor' ? ', Nội gián' : ', phe thứ ba'})`);
          if (e.killer === this.meId) {
            this.me.kills++;
            if (this.meReady !== null) { this.me.waits.push(this.play - this.meReady); this.meReady = null; }
          }
          if (e.victim === this.meId) this.me.diedAt = this.play;
          break;
        }
        case 'meeting': {
          this.meetings++;
          if (this.firstMeeting === null) this.firstMeeting = this.play;
          const m = w.meeting;
          const by = m ? w.agents[m.reporter] : null;
          this.log(`Cuộc họp ${this.meetings}: ${m?.via === 'body' ? `${by ? this.name(by) : '?'} báo cáo ghế trống` : `${by ? this.name(by) : '?'} bấm chuông họp khẩn`}`);
          break;
        }
        case 'sabotage': {
          this.sabotages++;
          if (e.by === this.meId) this.me.sabotages++;
          const label = e.kind === 'power' ? 'Cúp điện' : e.kind === 'wifi' ? 'Rớt mạng' : e.kind === 'boss' ? 'Sếp đi tuần' : e.kind;
          if (e.kind === 'boss') { this.bossUsed = true; this.bossAt = this.play; }
          this.log(`Sự cố: ${label}`);
          break;
        }
        case 'sabotage_end': this.log('Sự cố đã được xử lý'); break;
        case 'doors': this.log(`Khóa cửa ${roomName(e.room)}`); break;
      }
    }
  }

  /** Hết ván: chốt số liệu (gọi một lần) */
  finish(): GameStatsSummary {
    if (this.finished) return this.finished;
    const w = this.w, me = w.agents[this.meId];
    const k = w.crewTasksDone();
    const r = w.winReason;
    const endKind = w.winner === 'crew' ? (r.startsWith('KPI') ? 'Nhân viên đủ KPI' : 'Nhân viên sa thải hết Nội gián')
      : w.winner === 'impostor' ? (r.includes('Sếp bắt') ? 'Nội gián thắng nhờ Sếp đi tuần' : 'Nội gián chiếm đa số')
      : w.winner === 'gd' ? 'Game Designer bị sa thải (phe thứ ba)' : 'Intern tham vọng còn lại cuối cùng (phe thứ ba)';
    const late = r.includes('Sếp bắt') ? w.agents.filter(a => a.alive && a.role === 'crew' && !a.bossDone).length : 0;
    const myTeam = w.isNeutral(me) ? me.dept : me.role;
    const myTasks = me.tasks;
    this.log(`Kết thúc: ${endKind}`);
    this.finished = {
      players: w.agents.length, imps: w.impostorTotal, killCd: w.killCdBase, discuss: w.discussTime, vote: w.voteTime,
      play: this.play, full: this.startWall === null ? 0 : (performance.now() - this.startWall) / 1000, firstKill: this.firstKill, firstMeeting: this.firstMeeting,
      kills: this.kills, meetings: this.meetings, sabotages: this.sabotages, ejectTotal: this.ejectTotal, ejectImp: this.ejectImp, noEject: this.noEject,
      crewVotes: this.crewVotes, crewVotesOnImp: this.crewVotesOnImp, endKind, winner: w.winner ?? '', kpiAtEnd: Math.round(k.done / Math.max(1, k.total) * 100),
      boss: { used: this.bossUsed, won: r.includes('Sếp bắt'), late },
      me: {
        name: this.name(me), role: me.role === 'impostor' ? 'Nội gián' : (me.dept ?? 'intern'), won: w.winner === myTeam,
        kills: this.me.kills, waits: this.me.waits, sabotages: this.me.sabotages, hiddenSec: this.me.hiddenSec,
        tasksDone: myTasks.filter(t => t.done).length, tasksTotal: myTasks.length, votes: this.me.votes,
        bossDoneSec: this.me.bossDoneSec, diedAt: this.me.diedAt, ejected: me.ejected,
      },
      timeline: this.timeline,
    };
    return this.finished;
  }
}

/** Văn bản sao chép được (dán cho người làm game) */
export function statsText(s: GameStatsSummary, idx?: number): string {
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '–';
  const avg = (a: number[]) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) + 's' : '–';
  const me = s.me;
  const L: string[] = [];
  L.push(`## Ván${idx !== undefined ? ' ' + idx : ''}: ${s.players} người, ${s.imps} Nội gián · ${me.won ? 'THẮNG' : 'THUA'} (${me.role})`);
  L.push(`- Cài đặt: hồi chiêu gài bẫy ${s.killCd}s · thảo luận ${s.discuss}s · bỏ phiếu ${s.vote}s`);
  L.push(`- Kết thúc: ${s.endKind} · KPI lúc kết thúc ${s.kpiAtEnd}%`);
  L.push(`- Độ dài: chơi ${mmss(s.play)} · cả ván (tính họp) ${mmss(s.full)} · vụ gài đầu ${s.firstKill === null ? '–' : mmss(s.firstKill)} · họp đầu ${s.firstMeeting === null ? '–' : mmss(s.firstMeeting)}`);
  L.push(`- Ván: ${s.kills} vụ gài của Nội gián · ${s.meetings} cuộc họp (${s.noEject} cuộc không ai bị sa thải) · ${s.sabotages} lần phá hoại`);
  L.push(`- Sa thải: ${s.ejectImp}/${s.ejectTotal} lần trúng Nội gián · phiếu của Nhân viên trúng Nội gián ${pct(s.crewVotesOnImp, s.crewVotes)} (${s.crewVotes} phiếu)`);
  L.push(`- Sếp đi tuần: ${s.boss.used ? (s.boss.won ? `THẮNG (${s.boss.late} người không về kịp)` : 'có dùng, không thắng') : 'không dùng'}${me.bossDoneSec !== null ? ` · bạn về bàn sau ${me.bossDoneSec.toFixed(1)}s` : ''}`);
  if (me.role === 'Nội gián') L.push(`- Bạn (Nội gián): ${me.kills} vụ gài · hồi chiêu xong → gài được TB ${avg(me.waits)}${me.waits.length ? ` (${me.waits.map(x => x.toFixed(0) + 's').join(', ')})` : ''} · ${me.sabotages} lần phá hoại · trốn ${Math.round(me.hiddenSec)}s${me.ejected ? ' · bị sa thải' : ''}`);
  else L.push(`- Bạn (${me.role}): việc xong ${me.tasksDone}/${me.tasksTotal}${me.diedAt !== null ? ` · bị gài lúc ${mmss(me.diedAt)}` : ''}${me.ejected ? ' · bị sa thải' : ''}`);
  if (me.votes.length) L.push(`- Phiếu của bạn: ${me.votes.map(v => `${v.target}${v.ok === null ? '' : v.ok ? ' ✓' : ' ✗'}`).join(' · ')}`);
  L.push(`- Dòng thời gian (tính theo thời gian chơi):`);
  for (const e of s.timeline) L.push(`  - ${mmss(e.t)} ${e.text}`);
  return L.join('\n');
}
