import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function readVggBackup(path, passphrase) {
  const envelope = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  const format = 'office-vgg-backup-v1';
  if (envelope.format !== format || envelope.iterations !== 600_000) {
    throw new Error('Dinh dang tep sao luu Office khong hop le.');
  }
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const payload = Buffer.from(envelope.ciphertext, 'base64');
  if (salt.length !== 16 || iv.length !== 12 || payload.length <= 16) {
    throw new Error('Thong tin ma hoa trong tep khong hop le.');
  }

  const key = pbkdf2Sync(passphrase, salt, 600_000, 32, 'sha256');
  passphrase.fill(0);
  let plaintext;
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(format));
    cipher.setAuthTag(payload.subarray(-16));
    plaintext = Buffer.concat([cipher.update(payload.subarray(0, -16)), cipher.final()]);
  } catch {
    throw new Error('Khong mo duoc tep. Kiem tra mat khau sao luu.');
  } finally {
    key.fill(0);
  }
  let snapshot;
  try {
    snapshot = JSON.parse(plaintext.toString('utf8'));
  } finally {
    plaintext.fill(0);
  }

  const { room, roomMembers, accounts, messages } = snapshot;
  if (room?.code !== 'VGG' || !room.id ||
      ![roomMembers, accounts, messages].every(Array.isArray)) {
    throw new Error('Noi dung khong khop voi ban sao luu phong VGG.');
  }
  const members = new Set();
  for (const member of roomMembers) {
    if (member.roomId !== room.id || !member.userId || members.has(member.userId)) {
      throw new Error('Ban sao co thanh vien ngoai phong hoac ID thanh vien trung.');
    }
    members.add(member.userId);
  }
  const protectedAccounts = new Set();
  for (const account of accounts) {
    if (!members.has(account.userId)) throw new Error('Ban sao co tai khoan khong thuoc VGG.');
    if (typeof account.password === 'string' && account.password.trim()) {
      protectedAccounts.add(account.userId);
    }
  }
  if (messages.some((message) => message.roomId !== room.id)) {
    throw new Error('Ban sao co tin nhan khong thuoc VGG.');
  }
  const counts = {
    Phong: room.code,
    ThanhVien: members.size,
    CoMatKhau: protectedAccounts.size,
    CanKhoiPhucTaiKhoan: members.size - protectedAccounts.size,
    TinNhan: messages.length,
    Ghe: snapshot.seats?.length ?? 0,
    BanGhiChamCong: Object.keys(snapshot.attendance ?? {}).length,
    NhatKy: snapshot.diaryEntries?.length ?? 0,
  };
  return { snapshot, counts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const passphrase = Buffer.from(readFileSync(0, 'ascii').trim(), 'base64');
    console.table(readVggBackup(process.argv[2], passphrase).counts);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Khong the kiem tra tep sao luu.');
    process.exitCode = 1;
  }
}
