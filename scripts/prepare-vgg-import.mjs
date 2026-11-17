import { randomBytes, scryptSync } from 'node:crypto';

export function prepareVggImport(snapshot) {
  const accounts = [];
  const seen = new Map();
  for (const account of snapshot.accounts) {
    const password = typeof account.password === 'string' ? account.password.trim() : '';
    if (!password) continue;
    if (seen.has(account.userId)) {
      if (seen.get(account.userId) !== password) throw new Error('Conflicting passwords for one member ID. Review the backup before importing.');
      continue;
    }
    seen.set(account.userId, password);
    const salt = randomBytes(16).toString('hex');
    accounts.push({
      userId: account.userId,
      nickname: account.nickname,
      avatarGender: account.avatarGender,
      memberTag: account.memberTag,
      createdAt: account.createdAt,
      passwordHash: `${salt}:${scryptSync(password, salt, 32).toString('hex')}`,
    });
  }

  return {
    format: 'office-room-import-v1',
    room: snapshot.room,
    accounts,
    roomMembers: snapshot.roomMembers,
    seats: snapshot.seats,
    attendance: snapshot.attendance,
    messages: snapshot.messages,
    diaryEntries: snapshot.diaryEntries,
    legacyRoomData: {
      browserData: snapshot.browserData,
      roomCats: snapshot.roomCats,
      roomGiftRequests: snapshot.roomGiftRequests,
      roomPuzzles: snapshot.roomPuzzles,
      roomDonationBoxes: snapshot.roomDonationBoxes,
      roomDonationCases: snapshot.roomDonationCases,
      roomEconomyLedgers: snapshot.roomEconomyLedgers,
      chatClearedAt: snapshot.chatClearedAt,
    },
  };
}
