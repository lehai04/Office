import assert from 'node:assert/strict';
import {
  advanceDonationCaseByTime,
  calculateAbbotTheftMeritPenalty,
  calculateStealAmountVnd,
  CASE_PHASE_DURATION_MS,
  CASE_TOTAL_DURATION_MS,
  creditWalletWithDebtRecovery,
  DONATION_CASE_CONFIG,
  ensureUserLedger,
  isAbbotNickname,
  nextDonationCase,
  nextDonationCaseUpdateAt,
  queueDonationCase,
  resolveSuspectByInput,
  submitDonationCaseVote,
  toPublicDonationCaseView,
  type DonationCaseServerRecord,
  type RoomEconomyLedger,
} from '../src/utils/donationCaseEngine';

// 1. Kiểm tra phân quyền Chủ trì & mức trừ công đức nhân đôi
assert.equal(isAbbotNickname('Trụ trì Thanh Ngọc'), true);
assert.equal(isAbbotNickname('LeLe'), false);
assert.equal(calculateAbbotTheftMeritPenalty(1), 5);
assert.equal(calculateAbbotTheftMeritPenalty(2), 10);
assert.equal(calculateAbbotTheftMeritPenalty(3), 20);
assert.equal(calculateAbbotTheftMeritPenalty(4), 40);
assert.equal(calculateStealAmountVnd(400_000), 200_000);
assert.equal(calculateStealAmountVnd(80_000), 80_000);

const members = [
  { userId: 'abbot', nickname: 'Trụ trì Thanh Ngọc', memberTag: '#0001' },
  { userId: 'thief', nickname: 'LeLe', memberTag: '#AAAA' },
  { userId: 'u2', nickname: 'LeLe', memberTag: '#BBBB' },
  { userId: 'u3', nickname: 'Cá chép', memberTag: '#CCCC' },
];

// 2. Xử lý trùng tên khi bình chọn bằng tên nhân vật
const amb = resolveSuspectByInput(members, 'LeLe');
assert.equal(amb.ok, false);
if (!amb.ok) assert.equal(amb.code, 'AMBIGUOUS');

const exact = resolveSuspectByInput(members, 'LeLe (#AAAA)');
assert.equal(exact.ok, true);
if (exact.ok) assert.equal(exact.member.userId, 'thief');

function createTestCase(t0: number): DonationCaseServerRecord {
  return {
    id: 'case_test_1',
    roomId: 'room1',
    roomCode: 'VGG',
    status: 'investigating',
    stolenAmountVnd: 200_000,
    stolenAt: t0 - 1000,
    thiefSnapshot: {
      userId: 'thief',
      nickname: 'LeLe',
      memberTag: '#AAAA',
      avatarGender: 'female',
    },
    abbotUserId: 'abbot',
    abbotMeritLostOnTheft: 5,
    stealSequenceNumber: 1,
    policeReportedAt: t0,
    currentPhase: 0,
    publishedClues: [],
    votesByRound: {},
    scopeUserIds: ['abbot', 'thief', 'u2', 'u3'],
    settlementDone: false,
    settlementSummary: null,
    resolvedAt: null,
  };
}

// 3. Không lộ tên kẻ trộm trước kết quả & Chỉ chủ trì báo cảnh sát được
{
  const c = createTestCase(1_000_000);
  c.status = 'stolen_unreported';
  c.policeReportedAt = null;
  const viewAbbot = toPublicDonationCaseView(c, 'abbot', 'Trụ trì Thanh Ngọc', members);
  const viewOther = toPublicDonationCaseView(c, 'u3', 'Cá chép', members);
  assert.equal(viewAbbot?.canReportPolice, true);
  assert.equal(viewOther?.canReportPolice, false);
  assert.equal(viewOther?.caughtThiefNickname, null);
}

// 4. Hòa phiếu chuyển vòng, 1 người bình chọn đúng vẫn bắt được, thưởng phạt chỉ chạy 1 lần
{
  const t0 = 10_000_000;
  const c = createTestCase(t0);
  const ledger: RoomEconomyLedger = {
    abbotStealCount: 1,
    users: {
      abbot: { balanceVnd: 5_000_000, meritCount: 95, pendingDebtVnd: 0 },
      thief: { balanceVnd: 500_000, meritCount: 80, pendingDebtVnd: 0 },
      u2: { balanceVnd: 5_000_000, meritCount: 10, pendingDebtVnd: 0 },
      u3: { balanceVnd: 5_000_000, meritCount: 10, pendingDebtVnd: 0 },
    },
  };
  let boxTotal = 0;
  const chats: string[] = [];
  const callbacks = {
    onPostNpcChat: (msg: string) => chats.push(msg),
    onAdjustDonationBox: (delta: number) => {
      boxTotal += delta;
    },
    getUserLedger: (uid: string) => ensureUserLedger(ledger, uid),
  };

  // Phút 5: mở manh mối 1 + vòng 1
  advanceDonationCaseByTime(c, t0 + CASE_PHASE_DURATION_MS, callbacks);
  assert.equal(c.currentPhase, 1);
  assert.equal(c.publishedClues.length, 1);

  // Vòng 1: hòa phiếu (1 phiếu cho thief, 1 phiếu cho u2) -> chưa bắt được, chuyển vòng 2
  c.votesByRound[1] = { u2: 'thief', u3: 'u2' };
  advanceDonationCaseByTime(c, t0 + 2 * CASE_PHASE_DURATION_MS, callbacks);
  assert.equal(c.status, 'investigating');
  assert.equal(c.currentPhase, 2);
  assert.equal(c.publishedClues.length, 2);
  // Đảm bảo thông báo chuyển vòng không lộ tên người bị đoán sai (u2)
  assert.equal(chats.some((m) => m.includes('#BBBB')), false);

  // Vòng 2: 1 người bầu nhầm rồi đổi phiếu sang đúng thief -> đủ quá nửa (1/1) -> bắt được ở phút 15
  c.votesByRound[2] = { u3: 'u2' };
  c.votesByRound[2].u3 = 'thief';
  advanceDonationCaseByTime(c, t0 + 3 * CASE_PHASE_DURATION_MS, callbacks);
  assert.equal(c.status, 'caught');
  assert.equal(c.settlementDone, true);
  assert.equal(boxTotal, 200_000);
  // Kẻ trộm mất 50 công đức (80 -> 30)
  assert.equal(ledger.users.thief.meritCount, 30);
  // Kẻ trộm có 500k: trả 200k vào hòm, còn 300k bồi thường cho 3 người (mỗi người cần 200k => tổng 600k => trả 300k, nợ 300k)
  assert.equal(ledger.users.thief.balanceVnd, 0);
  assert.equal(ledger.users.thief.pendingDebtVnd, 300_000);

  // Chạy tick lần nữa -> không được thưởng phạt thêm lần 2
  const snapshotDebt = ledger.users.thief.pendingDebtVnd;
  const changedAgain = advanceDonationCaseByTime(
    c,
    t0 + 4 * CASE_PHASE_DURATION_MS,
    callbacks
  );
  assert.equal(changedAgain, false);
  assert.equal(ledger.users.thief.pendingDebtVnd, snapshotDebt);

  // Kiểm tra thu hồi nợ khi ví kẻ trộm nhận xu mới
  creditWalletWithDebtRecovery(ledger.users.thief, 400_000);
  assert.equal(ledger.users.thief.pendingDebtVnd, 0);
  assert.equal(ledger.users.thief.balanceVnd, 100_000);
}

// 5. Phút 30 kết thúc khi đoán sai -> Kẻ trộm thoát
{
  const t0 = 20_000_000;
  const c = createTestCase(t0);
  const ledger: RoomEconomyLedger = {
    abbotStealCount: 1,
    users: {
      abbot: { balanceVnd: 5_000_000, meritCount: 95, pendingDebtVnd: 0 },
      thief: { balanceVnd: 5_000_000, meritCount: 80, pendingDebtVnd: 0 },
      u2: { balanceVnd: 5_000_000, meritCount: 10, pendingDebtVnd: 0 },
      u3: { balanceVnd: 5_000_000, meritCount: 10, pendingDebtVnd: 0 },
    },
  };
  const callbacks = {
    onPostNpcChat: () => {},
    onAdjustDonationBox: () => {},
    getUserLedger: (uid: string) => ensureUserLedger(ledger, uid),
  };

  advanceDonationCaseByTime(c, t0 + CASE_TOTAL_DURATION_MS, callbacks);
  assert.equal(c.status, 'escaped');
  assert.equal(c.publishedClues.length, 5);
  assert.equal(
    ledger.users.abbot.balanceVnd,
    5_000_000 - DONATION_CASE_CONFIG.ESCAPED_FINE_VND
  );
  assert.equal(
    ledger.users.abbot.meritCount,
    95 - DONATION_CASE_CONFIG.ESCAPED_ABBOT_EXTRA_MERIT_PENALTY
  );
  assert.equal(
    ledger.users.u2.balanceVnd,
    5_000_000 - DONATION_CASE_CONFIG.ESCAPED_FINE_VND
  );
  // Kẻ trộm không bị phạt tiền 100k
  assert.equal(ledger.users.thief.balanceVnd, 5_000_000);
}

// 6. Bình chọn trước khi báo cảnh sát và xử lý lần lượt nhiều vụ trộm.
{
  const start = 30_000_000;
  const first = createTestCase(start);
  first.status = 'stolen_unreported';
  first.policeReportedAt = null;
  const second = {
    ...first,
    id: 'case_test_2',
    stealSequenceNumber: 2,
    thiefSnapshot: { ...first.thiefSnapshot, userId: 'u2' },
  };
  const ledger: RoomEconomyLedger = { abbotStealCount: 2, users: {} };
  let refunded = 0;
  const callbacks = {
    onPostNpcChat: () => {},
    onAdjustDonationBox: (amount: number) => { refunded += amount; },
    getUserLedger: (uid: string) => ensureUserLedger(ledger, uid),
  };

  assert.equal(queueDonationCase(first, second), first);
  assert.equal(toPublicDonationCaseView(first, 'u2', 'LeLe', members)?.queuedCaseCount, 1);
  assert.equal(submitDonationCaseVote(first, 'u3', 'u2', start), true);
  assert.equal(submitDonationCaseVote(first, 'abbot', 'thief', start + 500), false);
  assert.equal(nextDonationCaseUpdateAt(first), start + 5_000);
  assert.equal(advanceDonationCaseByTime(first, start + 4_999, callbacks), false);

  assert.equal(advanceDonationCaseByTime(first, start + 5_000, callbacks), true);
  assert.equal(first.lastQuickVoteResult, 'no_majority');
  assert.equal(first.status, 'stolen_unreported');

  assert.equal(submitDonationCaseVote(first, 'u3', 'u2', start + 5_001), true);
  assert.equal(advanceDonationCaseByTime(first, start + 10_001, callbacks), true);
  const wrong = toPublicDonationCaseView(first, 'u3', 'Cá chép', members);
  assert.equal(wrong?.lastQuickVoteResult, 'incorrect');
  assert.equal(wrong?.quickVoteEndsAt, null);
  assert.equal(wrong?.caughtThiefNickname, null);
  assert.equal(first.status, 'stolen_unreported');
  assert.equal(refunded, 0);

  submitDonationCaseVote(first, 'u3', 'thief', start + 10_002);
  assert.equal(advanceDonationCaseByTime(first, start + 15_002, callbacks), true);
  assert.equal(first.status, 'caught');
  assert.equal(first.lastQuickVoteResult, 'correct');
  assert.equal(refunded, first.stolenAmountVnd);
  assert.equal(advanceDonationCaseByTime(first, start + 15_003, callbacks), false);
  assert.equal(refunded, first.stolenAmountVnd);

  const promoteAt = nextDonationCaseUpdateAt(first);
  assert.ok(promoteAt);
  assert.equal(nextDonationCase(first, promoteAt - 1), first);
  assert.equal(nextDonationCase(first, promoteAt), second);
  assert.equal(second.status, 'stolen_unreported');
}

// 7. Chỉ công bố danh tính khi lượt sai thứ năm đã được chốt.
{
  const start = 40_000_000;
  const c = createTestCase(start);
  const ledger: RoomEconomyLedger = { abbotStealCount: 1, users: {} };
  const chats: string[] = [];
  const callbacks = {
    onPostNpcChat: (message: string) => chats.push(message),
    onAdjustDonationBox: () => {},
    getUserLedger: (uid: string) => ensureUserLedger(ledger, uid),
  };
  const view = () => toPublicDonationCaseView(c, 'u3', 'Cá chép', members);
  for (let round = 0; round < 4; round++) {
    const at = start + round * 6_000;
    assert.equal(submitDonationCaseVote(c, 'u3', 'u2', at), true);
    advanceDonationCaseByTime(c, at + 5_000, callbacks);
    assert.equal(view()?.wrongVoteCount, round + 1);
    assert.equal(view()?.settlementSummary, null);
  }
  const tieAt = start + 24_000;
  assert.equal(submitDonationCaseVote(c, 'u3', 'u2', tieAt), true);
  assert.equal(submitDonationCaseVote(c, 'abbot', 'thief', tieAt + 1), false);
  advanceDonationCaseByTime(c, tieAt + 5_000, callbacks);
  assert.equal(view()?.lastQuickVoteResult, 'no_majority');
  assert.equal(view()?.wrongVoteCount, 4);
  assert.equal(chats.some((message) => message.includes('#AAAA')), false);

  const lastAt = start + 30_000;
  assert.equal(submitDonationCaseVote(c, 'u3', 'u2', lastAt), true);
  assert.equal(advanceDonationCaseByTime(c, lastAt + 4_999, callbacks), false);
  assert.equal(view()?.settlementSummary, null);
  assert.equal(advanceDonationCaseByTime(c, lastAt + 5_000, callbacks), true);
  assert.equal(c.status, 'escaped');
  assert.equal(view()?.wrongVoteCount, 5);
  assert.equal(view()?.settlementSummary?.thiefNickname, 'LeLe');
  assert.equal(view()?.settlementSummary?.thiefMemberTag, '#AAAA');
  assert.equal(advanceDonationCaseByTime(c, lastAt + 5_001, callbacks), false);
  assert.equal(chats.filter((message) => message.includes('LeLe') && message.includes('#AAAA')).length, 1);
}

console.log('✅ All Vụ án Hòm Công Đức unit tests passed!');
