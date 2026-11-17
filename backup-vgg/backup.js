'use strict';

const roomCode = 'VGG';
const encoder = new TextEncoder();
const format = 'office-vgg-backup-v1';
const iterations = 600_000;
const summary = document.getElementById('summary');
const status = document.getElementById('status');
const button = document.getElementById('download');
const passphrase = document.getElementById('passphrase');
const repeat = document.getElementById('repeat');

function readSnapshot() {
  const db = JSON.parse(localStorage.getItem('van_phong_ao_static_db_v3') ?? 'null');
  const room = db?.rooms?.[roomCode];
  if (db?.dbVersion !== 3 || !room?.id) {
    throw new Error('Trình duyệt này chưa có dữ liệu phòng VGG. Hãy mở game bằng hồ sơ trình duyệt đã chơi trước đây.');
  }

  const keys = Object.keys(localStorage);
  const sessions = keys.filter((key) => key.startsWith('van_phong_ao_session_v2:'));
  const managerSession = sessions.some((key) => {
    try {
      const session = JSON.parse(localStorage.getItem(key));
      return session?.roomCode === roomCode && session.userId === room.managerUserId &&
        db.accounts?.[session.sessionToken]?.userId === session.userId;
    } catch {
      return false;
    }
  });
  if (!managerSession) {
    throw new Error('Hãy đăng nhập tài khoản trưởng phòng VGG trong game rồi mở lại trang này.');
  }

  const roomMembers = db.roomMembers.filter((item) => item.roomId === room.id);
  const userIds = new Set(roomMembers.map((item) => item.userId));
  const accounts = Object.values(db.accounts ?? {}).filter((account) => userIds.has(account.userId))
    .map(({ userId, nickname, avatarGender, memberTag, createdAt, password }) =>
      ({ userId, nickname, avatarGender, memberTag, createdAt, password }));
  const roomKeys = new Set([
    `van_phong_ao_room_cats_v1:${roomCode}`,
    `van_phong_ao_cat_gifts_v1:${roomCode}`,
    `van_phong_ao_donation_box_v1:${roomCode}`,
  ]);
  for (const userId of userIds) {
    roomKeys.add(`van_phong_ao_wallet_v1:${roomCode}:${userId}`);
    roomKeys.add(`van_phong_ao_zen_merit:${roomCode}:${userId}`);
    roomKeys.add(`van_phong_ao_cat_inventory_v1:${userId}`);
    roomKeys.add(`van_phong_ao_pet_collection_v1:${userId}`);
  }
  const browserData = Object.fromEntries(keys.filter((key) => roomKeys.has(key))
    .map((key) => [key, localStorage.getItem(key)]));
  return {
    createdAt: new Date().toISOString(),
    room, accounts, roomMembers, browserData,
    seats: db.seats.filter((item) => item.roomId === room.id),
    messages: db.messages.filter((item) => item.roomId === room.id),
    attendance: Object.fromEntries(Object.entries(db.attendance).filter(([key]) => key.startsWith(`${room.id}:`))),
    diaryEntries: db.diaryEntries.filter((item) => item.roomId === room.id),
    chatClearedAt: db.chatClearedAtByRoom?.[room.id],
    roomCats: db.roomCats?.[roomCode],
    roomGiftRequests: db.roomGiftRequests?.[roomCode],
    roomPuzzles: db.roomPuzzles?.[roomCode],
    roomDonationBoxes: db.roomDonationBoxes?.[roomCode],
    roomDonationCases: db.roomDonationCases?.[roomCode],
    roomEconomyLedgers: db.roomEconomyLedgers?.[roomCode],
  };
}

async function encryptSnapshot(snapshot, secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(format) },
    key, encoder.encode(JSON.stringify(snapshot)));
  const toBase64 = (bytes) => {
    let result = '';
    for (const value of new Uint8Array(bytes)) result += String.fromCharCode(value);
    return btoa(result);
  };
  return { format, iterations, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(encrypted) };
}

try {
  const snapshot = readSnapshot();
  const accounts = new Set(snapshot.accounts.filter((item) => item.password).map((item) => item.userId));
  const missing = snapshot.roomMembers.filter((member) => !accounts.has(member.userId)).length;
  summary.textContent = `Phòng VGG có ${snapshot.roomMembers.length} thành viên và ${snapshot.messages.length} tin nhắn trong bản ghi này. ${missing} thành viên chưa có mật khẩu trong bản ghi.`;
  status.textContent = 'Đã tìm thấy dữ liệu. Hãy đặt mật khẩu riêng để mã hóa tệp.';
  button.disabled = false;
} catch (error) {
  status.textContent = error.message;
}

document.getElementById('backup').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (passphrase.value !== repeat.value || passphrase.value.length < 12) {
    status.textContent = 'Hai mật khẩu phải giống nhau và có ít nhất 12 ký tự.';
    return;
  }
  button.disabled = true;
  try {
    const snapshot = readSnapshot();
    const backup = await encryptSnapshot(snapshot, passphrase.value);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Office-VGG-${snapshot.createdAt.slice(0, 10)}.officebackup`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    passphrase.value = '';
    repeat.value = '';
    status.textContent = 'Đã tạo bản sao lưu mã hóa. Hãy kiểm tra thư mục tải xuống.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
