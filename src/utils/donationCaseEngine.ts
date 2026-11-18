// Engine cho Mini Game "Vụ án Hòm Công Đức" - src/utils/donationCaseEngine.ts
import type { AvatarGender, RoomMember } from '../types/office';

export const CASE_PHASE_DURATION_MS = 5 * 60 * 1000; // 5 phút mỗi đợt
export const CASE_TOTAL_DURATION_MS = 30 * 60 * 1000; // 30 phút tổng cộng
const QUICK_VOTE_DURATION_MS = 5_000;
const CASE_RESULT_DISPLAY_MS = 10_000;

// Cấu hình kinh tế mặc định (xu ảo Office & điểm Công đức)
export const DONATION_CASE_CONFIG = {
  DEFAULT_STEAL_MIN_VND: 100_000,
  DEFAULT_STEAL_RATIO: 0.5, // Lấy 50% số dư hòm (tối thiểu 100.000 xu nếu hòm >= 100.000)
  ABBOT_BASE_MERIT_PENALTY: 5, // Lần 1 x1 = 5, lần 2 x2 = 10, lần 3 x4 = 20...
  THIEF_CAUGHT_MERIT_PENALTY: 50,
  THIEF_CAUGHT_COMPENSATION_VND: 200_000,
  ESCAPED_FINE_VND: 100_000,
  ESCAPED_ABBOT_EXTRA_MERIT_PENALTY: 5,
} as const;

export type DonationCaseStatus =
  | 'stolen_unreported'
  | 'investigating'
  | 'caught'
  | 'escaped';

export interface ThiefSnapshot {
  userId: string;
  nickname: string;
  memberTag: string;
  avatarGender: AvatarGender;
}

export interface CaseClue {
  round: number; // 1..5
  title: string;
  text: string;
  publishedAt: number;
}

export interface CaseSettlementSummary {
  outcome: 'caught' | 'escaped';
  thiefNickname?: string; // Chỉ có khi caught
  actualRefundedVnd: number;
  actualCompensatedTotalVnd: number;
  actualFinedTotalVnd: number;
  abbotExtraMeritPenalty: number;
}

export interface DonationCaseServerRecord {
  id: string;
  roomId: string;
  roomCode: string;
  status: DonationCaseStatus;
  stolenAmountVnd: number;
  stolenAt: number;
  thiefSnapshot: ThiefSnapshot;
  abbotUserId: string | null;
  abbotMeritLostOnTheft: number;
  stealSequenceNumber: number;
  policeReportedAt: number | null;
  currentPhase: 0 | 1 | 2 | 3 | 4 | 5;
  publishedClues: CaseClue[];
  votesByRound: Record<number, Record<string, string>>; // round -> voterUserId -> suspectUserId
  scopeUserIds: string[]; // Chốt tại lúc chủ trì báo cảnh sát, chỉ lưu phía máy chủ
  settlementDone: boolean;
  settlementSummary: CaseSettlementSummary | null;
  resolvedAt: number | null;
  quickVote?: { endsAt: number; votes: Record<string, string> };
  lastQuickVoteResult?: 'correct' | 'incorrect';
  queuedCases?: DonationCaseServerRecord[];
  revision?: number;
}

export interface PublicDonationCaseView {
  id: string;
  status: DonationCaseStatus;
  stolenAmountVnd: number;
  stolenAt: number;
  policeReportedAt: number | null;
  currentPhase: 0 | 1 | 2 | 3 | 4 | 5;
  nextPhaseAt: number | null;
  endsAt: number | null;
  publishedClues: CaseClue[];
  currentRoundVoteCount: number;
  hasVotedCurrentRound: boolean;
  myCurrentVoteLabel: string | null;
  canReportPolice: boolean;
  caughtThiefNickname: string | null;
  settlementSummary: CaseSettlementSummary | null;
  quickVoteEndsAt: number | null;
  lastQuickVoteResult: 'correct' | 'incorrect' | null;
  queuedCaseCount: number;
}

export function isDonationCaseOpen(caseRec?: Pick<DonationCaseServerRecord, 'status'> | null): boolean {
  return caseRec?.status === 'stolen_unreported' || caseRec?.status === 'investigating';
}

export function queueDonationCase(
  current: DonationCaseServerRecord | null,
  next: DonationCaseServerRecord
): DonationCaseServerRecord {
  if (!current || (!isDonationCaseOpen(current) && !current.queuedCases?.length &&
    (current.resolvedAt === null || next.stolenAt >= current.resolvedAt + CASE_RESULT_DISPLAY_MS))) return next;
  (current.queuedCases ??= []).push(next);
  current.revision = (current.revision ?? 0) + 1;
  return current;
}

export function nextDonationCase(current: DonationCaseServerRecord, nowMs: number): DonationCaseServerRecord {
  if (current.resolvedAt === null || nowMs < current.resolvedAt + CASE_RESULT_DISPLAY_MS) return current;
  const [next, ...remaining] = current.queuedCases ?? [];
  if (!next) return current;
  next.queuedCases = remaining;
  return next;
}

export function nextDonationCaseUpdateAt(caseRec: DonationCaseServerRecord): number | undefined {
  if (caseRec.quickVote) return caseRec.quickVote.endsAt;
  if (caseRec.status === 'investigating' && caseRec.policeReportedAt !== null &&
    (caseRec.currentPhase < 5 || !caseRec.lastQuickVoteResult)) {
    return caseRec.policeReportedAt + (caseRec.currentPhase + 1) * CASE_PHASE_DURATION_MS;
  }
  if (caseRec.queuedCases?.length && caseRec.resolvedAt !== null) {
    return caseRec.resolvedAt + CASE_RESULT_DISPLAY_MS;
  }
}

export function submitDonationCaseVote(
  caseRec: DonationCaseServerRecord,
  voterId: string,
  suspectId: string,
  nowMs: number
): void {
  caseRec.quickVote ??= { endsAt: nowMs + QUICK_VOTE_DURATION_MS, votes: {} };
  caseRec.quickVote.votes[voterId] = suspectId;
  caseRec.revision = (caseRec.revision ?? 0) + 1;
}

export interface UserEconomyLedgerEntry {
  balanceVnd: number;
  meritCount: number;
  pendingDebtVnd: number;
}

export interface RoomEconomyLedger {
  users: Record<string, UserEconomyLedgerEntry>;
  abbotStealCount: number;
}

export function isAbbotNickname(nickname: string): boolean {
  return nickname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('thanh ngoc');
}

export function calculateStealAmountVnd(boxTotalVnd: number): number {
  if (boxTotalVnd <= 0) return 0;
  if (boxTotalVnd <= DONATION_CASE_CONFIG.DEFAULT_STEAL_MIN_VND) {
    return boxTotalVnd;
  }
  const half = Math.round(boxTotalVnd * DONATION_CASE_CONFIG.DEFAULT_STEAL_RATIO);
  return Math.min(
    boxTotalVnd,
    Math.max(DONATION_CASE_CONFIG.DEFAULT_STEAL_MIN_VND, half)
  );
}

export function calculateAbbotTheftMeritPenalty(stealSequenceNumber: number): number {
  const power = Math.max(0, stealSequenceNumber - 1);
  return DONATION_CASE_CONFIG.ABBOT_BASE_MERIT_PENALTY * Math.pow(2, power);
}

function maskNamePattern(name: string, revealRatio: number): string {
  const chars = Array.from(name);
  return chars
    .map((ch, idx) => {
      if (ch === ' ') return ' ';
      if (idx === 0) return ch;
      if (revealRatio >= 0.65 && (idx === chars.length - 1 || idx % 2 === 0)) {
        return ch;
      }
      if (revealRatio >= 0.4 && idx % 3 === 0) {
        return ch;
      }
      return '•';
    })
    .join('');
}

function shiftCharBack(ch: string): string {
  const code = ch.charCodeAt(0);
  if (code >= 65 && code <= 90) {
    return String.fromCharCode(code === 65 ? 90 : code - 1);
  }
  if (code >= 97 && code <= 122) {
    return String.fromCharCode(code === 97 ? 122 : code - 1);
  }
  return ch;
}

export function buildClueForRound(snapshot: ThiefSnapshot, round: number, publishedAt: number): CaseClue {
  const cleanName = snapshot.nickname.trim();
  const chars = Array.from(cleanName);
  const nonSpaceChars = chars.filter((c) => c !== ' ');
  const firstChar = nonSpaceChars[0] || '?';
  const lastChar = nonSpaceChars[nonSpaceChars.length - 1] || '?';
  const wordCount = cleanName.split(/\s+/).filter(Boolean).length;
  const genderLabel = snapshot.avatarGender === 'female' ? 'Nữ' : 'Nam';
  const tagTail = snapshot.memberTag.slice(-2);

  if (round === 1) {
    return {
      round: 1,
      title: 'Manh mối 1',
      text: `Nhân vật này có tạo hình ${genderLabel}, tên gồm ${nonSpaceChars.length} ký tự (không tính khoảng trắng).`,
      publishedAt,
    };
  }
  if (round === 2) {
    return {
      round: 2,
      title: 'Manh mối 2',
      text: `Mật thư chữ cái: ký tự đứng liền trước chữ cái đầu của tên là "${shiftCharBack(firstChar)}" (tên bắt đầu bằng "${firstChar}").`,
      publishedAt,
    };
  }
  if (round === 3) {
    return {
      round: 3,
      title: 'Manh mối 3',
      text: `Tên nhân vật gồm ${wordCount} từ và kết thúc bằng ký tự "${lastChar}".`,
      publishedAt,
    };
  }
  if (round === 4) {
    return {
      round: 4,
      title: 'Manh mối 4',
      text: `Mẫu tên bị mờ một phần: "${maskNamePattern(cleanName, 0.42)}".`,
      publishedAt,
    };
  }
  return {
    round: 5,
    title: 'Manh mối 5 (Cuối)',
    text: `Bản ghi rõ nét hơn: "${maskNamePattern(cleanName, 0.72)}" • 2 ký tự cuối mã thẻ là "${tagTail}".`,
    publishedAt,
  };
}

export function resolveSuspectByInput(
  members: Array<{ userId: string; nickname: string; memberTag: string }>,
  rawInput: string
):
  | { ok: true; member: { userId: string; nickname: string; memberTag: string } }
  | { ok: false; code: 'NOT_FOUND' | 'AMBIGUOUS'; message: string } {
  const query = rawInput.trim();
  if (!query) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: 'Vui lòng nhập tên nhân vật bạn nghi ngờ.',
    };
  }

  // Khớp định danh dạng "Tên (#TAG)" hoặc "#TAG"
  const tagMatch = query.match(/#([A-Za-z0-9]{4})/);
  if (tagMatch) {
    const targetTag = `#${tagMatch[1].toUpperCase()}`;
    const byTag = members.find((m) => m.memberTag.toUpperCase() === targetTag);
    if (byTag) {
      return { ok: true, member: byTag };
    }
  }

  const normalizedQuery = query.toLowerCase();
  const exactMatches = members.filter(
    (m) => m.nickname.trim().toLowerCase() === normalizedQuery
  );

  if (exactMatches.length === 1) {
    return { ok: true, member: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    return {
      ok: false,
      code: 'AMBIGUOUS',
      message:
        'Có nhiều nhân vật trùng tên này. Vui lòng nhập kèm mã thẻ, ví dụ: Tên (#ABCD).',
    };
  }

  return {
    ok: false,
    code: 'NOT_FOUND',
    message: 'Không tìm thấy nhân vật nào khớp chính xác tên bạn nhập.',
  };
}

export function ensureUserLedger(
  ledger: RoomEconomyLedger,
  userId: string,
  defaultBalance = 5_000_000,
  defaultMerit = 0
): UserEconomyLedgerEntry {
  if (!ledger.users[userId]) {
    ledger.users[userId] = {
      balanceVnd: defaultBalance,
      meritCount: defaultMerit,
      pendingDebtVnd: 0,
    };
  }
  return ledger.users[userId];
}

/**
 * Cộng xu vào ví (tự động khấu trừ vào khoản nợ còn thiếu pendingDebtVnd nếu có)
 */
export function creditWalletWithDebtRecovery(
  entry: UserEconomyLedgerEntry,
  amountVnd: number
): number {
  if (amountVnd <= 0) return 0;
  let remaining = amountVnd;
  if (entry.pendingDebtVnd > 0) {
    const paidDebt = Math.min(entry.pendingDebtVnd, remaining);
    entry.pendingDebtVnd -= paidDebt;
    remaining -= paidDebt;
  }
  entry.balanceVnd += remaining;
  return remaining;
}

/**
 * Trừ xu từ ví; nếu ví không đủ thì trừ về 0 và ghi phần thiếu vào pendingDebtVnd.
 * Trả về số xu thực tế đã chuyển được.
 */
export function debitWalletOrRecordDebt(
  entry: UserEconomyLedgerEntry,
  amountVnd: number
): number {
  if (amountVnd <= 0) return 0;
  const actualPaid = Math.min(entry.balanceVnd, amountVnd);
  const unpaid = amountVnd - actualPaid;
  entry.balanceVnd -= actualPaid;
  if (unpaid > 0) {
    entry.pendingDebtVnd += unpaid;
  }
  return actualPaid;
}

export interface CaseTickCallbacks {
  onPostNpcChat: (content: string) => void;
  onAdjustDonationBox: (deltaVnd: number) => void;
  getUserLedger: (userId: string) => UserEconomyLedgerEntry;
}

function settleCaseRewardsAndPenalties(
  caseRec: DonationCaseServerRecord,
  outcome: 'caught' | 'escaped',
  callbacks: CaseTickCallbacks
): void {
  if (caseRec.settlementDone) return; // Đảm bảo chỉ thưởng phạt 1 lần cho mỗi vụ
  caseRec.settlementDone = true;

  const thiefId = caseRec.thiefSnapshot.userId;
  const thiefEntry = callbacks.getUserLedger(thiefId);

  if (outcome === 'caught') {
    // 1. Trừ kẻ trộm 50 điểm công đức
    thiefEntry.meritCount = Math.max(
      0,
      thiefEntry.meritCount - DONATION_CASE_CONFIG.THIEF_CAUGHT_MERIT_PENALTY
    );

    // 2. Kẻ trộm hoàn trả số xu đã lấy vào hòm công đức
    const actualRefundedVnd = debitWalletOrRecordDebt(
      thiefEntry,
      caseRec.stolenAmountVnd
    );
    if (actualRefundedVnd > 0) {
      callbacks.onAdjustDonationBox(actualRefundedVnd);
    }

    // 3. Kẻ trộm bồi thường 200.000 xu cho mỗi người trong phạm vi (trừ kẻ trộm)
    let actualCompensatedTotalVnd = 0;
    const recipients = Array.from(new Set(caseRec.scopeUserIds)).filter(
      (uid) => uid !== thiefId
    );
    for (const uid of recipients) {
      const paid = debitWalletOrRecordDebt(
        thiefEntry,
        DONATION_CASE_CONFIG.THIEF_CAUGHT_COMPENSATION_VND
      );
      if (paid > 0) {
        const recEntry = callbacks.getUserLedger(uid);
        creditWalletWithDebtRecovery(recEntry, paid);
        actualCompensatedTotalVnd += paid;
      }
    }

    caseRec.settlementSummary = {
      outcome: 'caught',
      thiefNickname: caseRec.thiefSnapshot.nickname,
      actualRefundedVnd,
      actualCompensatedTotalVnd,
      actualFinedTotalVnd: 0,
      abbotExtraMeritPenalty: 0,
    };
  } else {
    // Kẻ trộm thoát: trừ 100.000 xu của mỗi người thuộc phạm vi (trừ kẻ trộm)
    let actualFinedTotalVnd = 0;
    const penalizedUsers = Array.from(new Set(caseRec.scopeUserIds)).filter(
      (uid) => uid !== thiefId
    );
    for (const uid of penalizedUsers) {
      const uEntry = callbacks.getUserLedger(uid);
      actualFinedTotalVnd += debitWalletOrRecordDebt(
        uEntry,
        DONATION_CASE_CONFIG.ESCAPED_FINE_VND
      );
    }

    // Chủ trì mất thêm 5 điểm công đức (cộng thêm vào số đã bị trừ lúc hòm bị trộm)
    if (caseRec.abbotUserId && caseRec.abbotUserId !== thiefId) {
      const abbotEntry = callbacks.getUserLedger(caseRec.abbotUserId);
      abbotEntry.meritCount = Math.max(
        0,
        abbotEntry.meritCount - DONATION_CASE_CONFIG.ESCAPED_ABBOT_EXTRA_MERIT_PENALTY
      );
    }

    caseRec.settlementSummary = {
      outcome: 'escaped',
      actualRefundedVnd: 0,
      actualCompensatedTotalVnd: 0,
      actualFinedTotalVnd,
      abbotExtraMeritPenalty: DONATION_CASE_CONFIG.ESCAPED_ABBOT_EXTRA_MERIT_PENALTY,
    };
  }
}

function tallyMajorityWinner(votes: Record<string, string> | undefined): string | null {
  if (!votes) return null;
  const values = Object.values(votes);
  const total = values.length;
  if (total === 0) return null;

  const counts = new Map<string, number>();
  for (const suspectId of values) {
    counts.set(suspectId, (counts.get(suspectId) || 0) + 1);
  }

  for (const [suspectId, count] of counts.entries()) {
    if (count > total / 2) {
      return suspectId;
    }
  }
  return null;
}

/**
 * Tiến trình điều tra theo thời gian máy chủ (mốc policeReportedAt).
 * An toàn khi gọi lặp lại nhiều lần hoặc từ nhiều client.
 */
export function advanceDonationCaseByTime(
  caseRec: DonationCaseServerRecord,
  nowMs: number,
  callbacks: CaseTickCallbacks
): boolean {
  let changed = false;
  const quickVote = caseRec.quickVote;
  if (isDonationCaseOpen(caseRec) && quickVote) {
    if (nowMs < quickVote.endsAt) return false;
    const correct = tallyMajorityWinner(quickVote.votes) === caseRec.thiefSnapshot.userId;
    delete caseRec.quickVote;
    caseRec.revision = (caseRec.revision ?? 0) + 1;
    caseRec.lastQuickVoteResult = correct ? 'correct' : 'incorrect';
    if (correct) {
      caseRec.status = 'caught';
      caseRec.resolvedAt = nowMs;
      settleCaseRewardsAndPenalties(caseRec, 'caught', callbacks);
      callbacks.onPostNpcChat(
        `🚓 [VỤ ÁN CÔNG ĐỨC] Bình chọn đúng! Đã bắt được kẻ trộm: "${caseRec.thiefSnapshot.nickname}".`
      );
      return true;
    }
    callbacks.onPostNpcChat('🕵️ [VỤ ÁN CÔNG ĐỨC] Bình chọn chưa đúng. Có thể mở lượt bình chọn mới.');
    changed = true;
  }
  if (caseRec.status !== 'investigating' || !caseRec.policeReportedAt) {
    return changed;
  }

  const elapsed = Math.max(0, nowMs - caseRec.policeReportedAt);
  const targetStep = Math.min(caseRec.lastQuickVoteResult ? 5 : 6, Math.floor(elapsed / CASE_PHASE_DURATION_MS));
  if (targetStep <= caseRec.currentPhase) {
    return changed;
  }

  for (let step = caseRec.currentPhase + 1; step <= targetStep; step++) {
    // Chốt vòng trước đó (nếu step >= 2 tức là vừa hết vòng step - 1)
    if (step >= 2 && !caseRec.lastQuickVoteResult) {
      const finishedRound = step - 1;
      const winnerId = tallyMajorityWinner(caseRec.votesByRound[finishedRound]);
      if (winnerId && winnerId === caseRec.thiefSnapshot.userId) {
        caseRec.status = 'caught';
        caseRec.resolvedAt =
          caseRec.policeReportedAt + finishedRound * CASE_PHASE_DURATION_MS;
        settleCaseRewardsAndPenalties(caseRec, 'caught', callbacks);
        const s = caseRec.settlementSummary!;
        callbacks.onPostNpcChat(
          `🚓 [VỤ ÁN CÔNG ĐỨC] Đã bắt đúng kẻ trộm: "${caseRec.thiefSnapshot.nickname}"! Đã hoàn trả ${s.actualRefundedVnd.toLocaleString('vi-VN')} xu vào hòm và bồi thường thực tế ${s.actualCompensatedTotalVnd.toLocaleString('vi-VN')} xu cho mọi người.`
        );
        changed = true;
        break;
      } else {
        callbacks.onPostNpcChat(
          `🕵️ [VỤ ÁN CÔNG ĐỨC] Hết vòng ${finishedRound}: Chưa bắt được kẻ trộm!`
        );
        changed = true;
      }
    }

    if (step <= 5) {
      const clueTime = caseRec.policeReportedAt + step * CASE_PHASE_DURATION_MS;
      const clue = buildClueForRound(caseRec.thiefSnapshot, step, clueTime);
      if (!caseRec.publishedClues.some((c) => c.round === step)) {
        caseRec.publishedClues.push(clue);
      }
      caseRec.currentPhase = step as 1 | 2 | 3 | 4 | 5;
      callbacks.onPostNpcChat(
        `🔎 [VỤ ÁN CÔNG ĐỨC] ${clue.title}: ${clue.text}`
      );
      changed = true;
    } else if (step === 6) {
      caseRec.status = 'escaped';
      caseRec.resolvedAt = caseRec.policeReportedAt + CASE_TOTAL_DURATION_MS;
      settleCaseRewardsAndPenalties(caseRec, 'escaped', callbacks);
      const s = caseRec.settlementSummary!;
      callbacks.onPostNpcChat(
        `💨 [VỤ ÁN CÔNG ĐỨC] Kẻ trộm đã thoát sau 30 phút! Đã thu phạt thực tế ${s.actualFinedTotalVnd.toLocaleString('vi-VN')} xu trong phạm vi xử phạt.`
      );
      changed = true;
      break;
    }
  }

  return changed;
}

export function toPublicDonationCaseView(
  caseRec: DonationCaseServerRecord | null,
  viewerUserId: string,
  viewerNickname: string,
  members: Array<{ userId: string; nickname: string; memberTag: string }>
): PublicDonationCaseView | null {
  if (!caseRec) return null;

  const roundVotes = caseRec.quickVote?.votes ?? {};
  const myVoteTargetId = roundVotes[viewerUserId] || null;
  const myTargetMember = myVoteTargetId
    ? members.find((m) => m.userId === myVoteTargetId)
    : null;

  const nextPhaseAt =
    caseRec.status === 'investigating' && caseRec.policeReportedAt &&
    (caseRec.currentPhase < 5 || !caseRec.lastQuickVoteResult)
      ? caseRec.policeReportedAt + (caseRec.currentPhase + 1) * CASE_PHASE_DURATION_MS
      : null;
  const endsAt =
    caseRec.status === 'investigating' && caseRec.policeReportedAt && !caseRec.lastQuickVoteResult && !caseRec.quickVote
      ? caseRec.policeReportedAt + CASE_TOTAL_DURATION_MS
      : null;

  return {
    id: caseRec.id,
    status: caseRec.status,
    stolenAmountVnd: caseRec.stolenAmountVnd,
    stolenAt: caseRec.stolenAt,
    policeReportedAt: caseRec.policeReportedAt,
    currentPhase: caseRec.currentPhase,
    nextPhaseAt,
    endsAt,
    publishedClues: [...caseRec.publishedClues],
    currentRoundVoteCount: Object.keys(roundVotes).length,
    hasVotedCurrentRound: Boolean(myVoteTargetId),
    myCurrentVoteLabel: myTargetMember
      ? `${myTargetMember.nickname} (${myTargetMember.memberTag})`
      : null,
    canReportPolice:
      caseRec.status === 'stolen_unreported' && isAbbotNickname(viewerNickname),
    caughtThiefNickname:
      caseRec.status === 'caught' ? caseRec.thiefSnapshot.nickname : null,
    settlementSummary:
      caseRec.status === 'caught' || caseRec.status === 'escaped'
        ? caseRec.settlementSummary
        : null,
    quickVoteEndsAt: caseRec.quickVote?.endsAt ?? null,
    lastQuickVoteResult: caseRec.lastQuickVoteResult ?? null,
    queuedCaseCount: caseRec.queuedCases?.length ?? 0,
  };
}
