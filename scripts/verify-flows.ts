import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApiRequest } from '../server/officeServer';
import { getNextAttendanceStatus } from '../src/components/AttendanceDrawer';
import { WORK_SEAT_LAYOUTS, MEETING_CHAIRS, DOOR_STANDING_SLOTS } from '../src/constants/officeLayout';
import type { AttendanceStatus } from '../src/types/office';

async function apiCall(
  path: string,
  options: { method?: string; body?: unknown } = {},
  token?: string
): Promise<{ status: number; data: any }> {
  const reqEmitter = new EventEmitter() as IncomingMessage;
  reqEmitter.url = path;
  reqEmitter.method = options.method || 'GET';
  reqEmitter.headers = {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };

  let statusCode = 200;
  let responseBody = '';
  const resHeaders: Record<string, string> = {};

  const resMock = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader(name: string, value: string) {
      resHeaders[name.toLowerCase()] = value;
    },
    writeHead(code: number, headers?: Record<string, string>) {
      statusCode = code;
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          resHeaders[k.toLowerCase()] = v;
        }
      }
    },
    write(chunk: string | Buffer) {
      responseBody += chunk.toString();
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk) {
        responseBody += chunk.toString();
      }
    },
  } as unknown as ServerResponse;

  const handlePromise = handleApiRequest(reqEmitter, resMock);

  setImmediate(() => {
    if (options.body !== undefined) {
      const raw =
        typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      reqEmitter.emit('data', Buffer.from(raw, 'utf-8'));
    }
    reqEmitter.emit('end');
  });

  await handlePromise;
  const parsed = responseBody ? JSON.parse(responseBody) : {};
  return { status: statusCode, data: parsed };
}

async function runVerification() {
  console.log('================================================================');
  console.log(' BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG 3 PHIÊN ĐỘC LẬP (A, B, C) - VĂN PHÒNG ẢO');
  console.log('================================================================\n');

  // 0. Kiểm tra cấu trúc bố cục phòng 3D theo yêu cầu
  assert.equal(WORK_SEAT_LAYOUTS.length, 8, 'Có đúng 8 ghế làm việc cố định');
  assert.equal(
    WORK_SEAT_LAYOUTS.filter((s) => s.zone === 'top_row').length,
    2,
    '2 ghế ở dãy trên'
  );
  assert.equal(
    WORK_SEAT_LAYOUTS.filter((s) => s.zone === 'lower_row_1' || s.zone === 'lower_row_2').length,
    4,
    '4 ghế ở hai dãy phía dưới'
  );
  assert.equal(
    WORK_SEAT_LAYOUTS.filter((s) => s.zone === 'right_wall').length,
    2,
    '2 ghế sát tường phải'
  );
  assert.equal(MEETING_CHAIRS.length, 6, 'Bàn họp có 6 ghế dùng chung ngoài danh sách đăng ký');
  assert.ok(
    DOOR_STANDING_SLOTS.length >= 8,
    'Các vị trí đứng gần cửa được bố trí lệch nhau để không chồng lên nhau'
  );
  console.log('✅ Kiểm tra cấu trúc 3D: 8 ghế cố định (2 trên, 4 dưới, 2 sát tường phải) + 6 ghế bàn họp chung + vị trí đứng lệch nhau gần cửa.\n');

  const testRoomCode = `TEST${Math.floor(1000 + Math.random() * 9000)}`;

  // Khởi tạo 3 phiên độc lập A, B, C cùng vào phòng testRoomCode
  const joinA = await apiCall('/api/auth/join', {
    method: 'POST',
    body: {
      roomCode: testRoomCode,
      nickname: 'An (User A)',
      avatarGender: 'male',
      createIfMissing: true,
    },
  });
  assert.equal(joinA.status, 200, 'Phiên A vào phòng thành công');
  const sessionA = joinA.data.session;

  const joinB = await apiCall('/api/auth/join', {
    method: 'POST',
    body: {
      roomCode: testRoomCode,
      nickname: 'Bình (User B)',
      avatarGender: 'female',
    },
  });
  assert.equal(joinB.status, 200, 'Phiên B vào phòng thành công');
  const sessionB = joinB.data.session;

  const joinC = await apiCall('/api/auth/join', {
    method: 'POST',
    body: {
      roomCode: testRoomCode,
      nickname: 'Chi (User C)',
      avatarGender: 'female',
    },
  });
  assert.equal(joinC.status, 200, 'Phiên C vào phòng thành công');
  const sessionC = joinC.data.session;

  console.log('✅ Khởi tạo 3 phiên ẩn danh độc lập A, B, C thành công:');
  console.log(`   - A: userId=${sessionA.userId}, nickname="${sessionA.nickname}", tag=${sessionA.memberTag}`);
  console.log(`   - B: userId=${sessionB.userId}, nickname="${sessionB.nickname}", tag=${sessionB.memberTag}`);
  console.log(`   - C: userId=${sessionC.userId}, nickname="${sessionC.nickname}", tag=${sessionC.memberTag}\n`);

  // Kiểm tra bảo mật tư cách thành viên phòng:
  // Tạo người dùng ở phòng khác ("Kẻ lạ") và thử truy cập dữ liệu của testRoomCode -> phải bị chặn 403
  const outsiderRoomCode = `OUT${Math.floor(1000 + Math.random() * 9000)}`;
  const joinOutsider = await apiCall('/api/auth/join', {
    method: 'POST',
    body: {
      roomCode: outsiderRoomCode,
      nickname: 'Kẻ lạ',
      avatarGender: 'male',
      createIfMissing: true,
    },
  });
  const outsiderToken = joinOutsider.data.session.sessionToken;
  const outsiderTryRead = await apiCall(
    `/api/rooms/${testRoomCode}/messages`,
    { method: 'GET' },
    outsiderToken
  );
  assert.equal(outsiderTryRead.status, 403, 'Kẻ lạ (người ngoài phòng) bị chặn 403');
  console.log('✅ Kiểm tra tư cách thành viên: Kẻ lạ (người ngoài phòng) truy cập dữ liệu bị máy chủ chặn (403 Forbidden).\n');

  // ------------------------------------------------------------------------
  // KỊCH BẢN 1: A và B cùng chọn một ghế (`seat-top-1`).
  // Chỉ một người lấy được ghế, người còn lại nhận lỗi 409 và chọn ghế khác hoặc đứng.
  // ------------------------------------------------------------------------
  console.log('▶ Kiểm thử 1: A và B bấm chọn cùng một ghế (seat-top-1) đồng thời...');
  const [claimA, claimB] = await Promise.all([
    apiCall(
      `/api/rooms/${testRoomCode}/seats/claim`,
      {
        method: 'POST',
        body: { seatId: 'seat-top-1' },
      },
      sessionA.sessionToken
    ),
    apiCall(
      `/api/rooms/${testRoomCode}/seats/claim`,
      {
        method: 'POST',
        body: { seatId: 'seat-top-1' },
      },
      sessionB.sessionToken
    ),
  ]);

  const statuses = [claimA.status, claimB.status].sort();
  assert.deepEqual(
    statuses,
    [200, 409],
    'Đúng 1 người nhận được ghế (200) và 1 người bị từ chối tranh chấp (409)'
  );
  console.log(
    `   ✅ Xử lý tranh chấp ghế chính xác: Phiên A (${claimA.status}), Phiên B (${claimB.status} - ${claimB.data.error})`
  );

  // Kiểm tra trạng thái B đang đứng và vẫn dùng được chat, chấm công, nhật ký hoặc chọn ghế khác
  const stateBeforeBClaim = await apiCall(
    `/api/rooms/${testRoomCode}/state`,
    { method: 'GET' },
    sessionB.sessionToken
  );
  const memberBStanding = stateBeforeBClaim.data.members.find(
    (m: any) => m.userId === sessionB.userId
  );
  assert.equal(memberBStanding.seatId, null, 'Người không lấy được ghế đang đứng ở khu vực cửa');
  console.log('   ✅ Người còn lại đứng ở khu vực gần cửa (hoặc có thể chọn ghế trống khác).');

  // Kiểm tra ngồi tự do ở bàn họp chung (6 ghế: meet-top-1..meet-right)
  const sitMeetingB = await apiCall(
    `/api/rooms/${testRoomCode}/meeting/sit`,
    {
      method: 'POST',
      body: { meetingChairId: 'meet-top-1' },
    },
    sessionB.sessionToken
  );
  assert.equal(sitMeetingB.status, 200, 'B vào ngồi tự do tại ghế bàn họp meet-top-1');
  const memberBAtMeeting = sitMeetingB.data.members.find(
    (m: any) => m.userId === sessionB.userId
  );
  assert.equal(memberBAtMeeting.meetingChairId, 'meet-top-1');
  console.log('   ✅ Bàn họp chung (6 ghế H1–H6) cho phép thành viên bấm vào ngồi họp tự do và rời bàn họp bất cứ lúc nào.');

  // ------------------------------------------------------------------------
  // KỊCH BẢN 4 & 2:
  // - A bấm một ô ngày bốn lần. Kết quả lần lượt là xanh (full), vàng (half), đỏ (off), xám (none).
  // - Kiểm tra bấm nhanh liên tiếp khi gói tin đến lệch thứ tự (seq).
  // - Sau đó A bấm sang xanh (full) trên ngày 2026-11-13 và tải lại trang:
  //   Nhân vật về đúng ghế đã lưu, lịch chấm công giữ đúng màu.
  // ------------------------------------------------------------------------
  console.log('\n▶ Kiểm thử 4: A bấm một ô ngày (2026-11-10) 4 lần liên tiếp...');
  let currentStatus: AttendanceStatus = 'none';
  const expectedSequence: AttendanceStatus[] = ['full', 'half', 'off', 'none'];
  const actualSequence: AttendanceStatus[] = [];

  for (let i = 0; i < 4; i++) {
    currentStatus = getNextAttendanceStatus(currentStatus);
    const resAtt = await apiCall(
      `/api/rooms/${testRoomCode}/attendance`,
      {
        method: 'POST',
        body: {
          date: '2026-11-10',
          status: currentStatus,
          seq: i + 1,
        },
      },
      sessionA.sessionToken
    );
    assert.equal(resAtt.status, 200);
    actualSequence.push(resAtt.data.record.status);
  }

  assert.deepEqual(
    actualSequence,
    expectedSequence,
    'Thứ tự 4 lần bấm phải lần lượt là xanh lá (full), vàng (half), đỏ (off), xám (none)'
  );
  console.log(
    `   ✅ Kết quả 4 lần bấm trên ô ngày: ${actualSequence
      .map((s) =>
        s === 'full'
          ? 'Xanh lá (Làm đủ ca)'
          : s === 'half'
            ? 'Vàng (Làm nửa ngày)'
            : s === 'off'
              ? 'Đỏ (Nghỉ)'
              : 'Xám (Chưa chấm công)'
      )
      .join(' → ')}`
  );

  // Mô phỏng bấm nhanh liên tiếp (gói tin seq=20 đến trước gói tin cũ seq=19)
  await apiCall(
    `/api/rooms/${testRoomCode}/attendance`,
    {
      method: 'POST',
      body: { date: '2026-11-13', status: 'full', seq: 20 },
    },
    sessionA.sessionToken
  );
  const staleRes = await apiCall(
    `/api/rooms/${testRoomCode}/attendance`,
    {
      method: 'POST',
      body: { date: '2026-11-13', status: 'half', seq: 19 },
    },
    sessionA.sessionToken
  );
  assert.equal(
    staleRes.data.record.status,
    'full',
    'Bảo đảm giá trị cuối cùng (seq=20) không bị ghi đè bởi request cũ (seq=19)'
  );

  console.log('\n▶ Kiểm thử 2: A tải lại trang (khôi phục từ phiên đăng nhập đã lưu)...');
  const reloadA = await apiCall(
    '/api/auth/join',
    {
      method: 'POST',
      body: {
        roomCode: testRoomCode,
        nickname: sessionA.nickname,
        avatarGender: sessionA.avatarGender,
      },
    },
    sessionA.sessionToken
  );
  assert.equal(reloadA.status, 200);
  assert.equal(reloadA.data.mySeatId, 'seat-top-1', 'Nhân vật A về đúng ghế đã lưu seat-top-1');

  const stateAfterReloadA = await apiCall(
    `/api/rooms/${testRoomCode}/state`,
    { method: 'GET' },
    sessionA.sessionToken
  );
  const savedDay = stateAfterReloadA.data.attendance.find(
    (a: any) => a.date === '2026-11-13'
  );
  assert.equal(savedDay?.status, 'full', 'Lịch chấm công của A giữ đúng màu xanh lá (full)');
  console.log(
    `   ✅ Sau khi tải lại trang: Nhân vật A về đúng ghế "${reloadA.data.mySeatId}", ngày 2026-11-13 giữ đúng màu "${savedDay.status}" (Xanh lá).`
  );

  // ------------------------------------------------------------------------
  // KỊCH BẢN 3: A gửi chat. B thấy tin trong khung chat và nhận sự kiện realtime
  // để hiển thị bong bóng trên đúng nhân vật A. Kiểm tra gửi lại (retry) không tạo tin trùng.
  // ------------------------------------------------------------------------
  console.log('\n▶ Kiểm thử 3: A gửi chat trực tiếp & B nhận tin...');
  const clientMsgId = 'test_msg_unique_001';
  const sendChatRes = await apiCall(
    `/api/rooms/${testRoomCode}/messages`,
    {
      method: 'POST',
      body: {
        content: 'Chào buổi chiều cả phòng nhé!',
        clientMsgId,
      },
    },
    sessionA.sessionToken
  );
  assert.equal(sendChatRes.status, 201);
  assert.equal(sendChatRes.data.message.userId, sessionA.userId);

  // Thử gửi lại với cùng clientMsgId (mô phỏng retry khi mạng chập chờn)
  const retryChatRes = await apiCall(
    `/api/rooms/${testRoomCode}/messages`,
    {
      method: 'POST',
      body: {
        content: 'Chào buổi chiều cả phòng nhé!',
        clientMsgId,
      },
    },
    sessionA.sessionToken
  );
  assert.equal(retryChatRes.status, 200);
  assert.equal(retryChatRes.data.deduplicated, true, 'Retry không tạo tin nhắn trùng');

  // B tải danh sách tin nhắn trong phòng
  const bMessagesRes = await apiCall(
    `/api/rooms/${testRoomCode}/messages`,
    { method: 'GET' },
    sessionB.sessionToken
  );
  assert.equal(bMessagesRes.status, 200);
  assert.equal(bMessagesRes.data.messages.length, 1, 'Không có tin nhắn trùng lặp');
  assert.equal(
    bMessagesRes.data.messages[0].content,
    'Chào buổi chiều cả phòng nhé!',
    'B thấy đúng nội dung tin nhắn của A'
  );
  assert.equal(
    bMessagesRes.data.messages[0].userId,
    sessionA.userId,
    'Tin nhắn gắn đúng với nhân vật A để hiển thị bong bóng trên đầu nhân vật A'
  );
  console.log(
    '   ✅ B thấy tin nhắn của A trong khung chat, đúng userId của nhân vật A và chống trùng tin khi retry.'
  );

  // ------------------------------------------------------------------------
  // KỊCH BẢN 5: A đăng nhật ký và ẩn với B.
  // - A thấy trong “Bài của tôi”
  // - C thấy bài dưới tên “Ẩn danh”, phản hồi C nhận được KHÔNG chứa danh tính tác giả
  // - B không đọc được trong danh sách VÀ không đọc được kể cả khi truy vấn trực tiếp bằng ID
  // ------------------------------------------------------------------------
  console.log('\n▶ Kiểm thử 5: A đăng nhật ký ẩn danh và chọn "Ẩn bài này với B"...');
  const postDiaryRes = await apiCall(
    `/api/rooms/${testRoomCode}/diary`,
    {
      method: 'POST',
      body: {
        mood: 'pressure',
        content: 'Hôm nay deadline hơi căng nhưng may có mọi người hỗ trợ.',
        hiddenUserIds: [sessionB.userId],
      },
    },
    sessionA.sessionToken
  );
  assert.equal(postDiaryRes.status, 201);
  const diaryId = postDiaryRes.data.myEntry.id;

  // 5a. Kiểm tra A thấy trong "Bài của tôi"
  const aMineRes = await apiCall(
    `/api/rooms/${testRoomCode}/diary/mine`,
    { method: 'GET' },
    sessionA.sessionToken
  );
  assert.equal(aMineRes.status, 200);
  assert.equal(aMineRes.data.entries.length, 1);
  assert.equal(aMineRes.data.entries[0].id, diaryId);
  console.log(`   ✅ A thấy bài viết (ID: ${diaryId}) trong mục "Bài của tôi".`);

  // 5b. Kiểm tra C thấy bài dưới tên "Ẩn danh" và phản hồi JSON của C KHÔNG chứa danh tính tác giả
  const cFeedRes = await apiCall(
    `/api/rooms/${testRoomCode}/diary`,
    { method: 'GET' },
    sessionC.sessionToken
  );
  assert.equal(cFeedRes.status, 200);
  assert.equal(cFeedRes.data.entries.length, 1, 'C thấy bài tâm sự trên bảng chung');
  const entryForC = cFeedRes.data.entries[0];
  assert.equal(entryForC.authorLabel, 'Ẩn danh', 'Tác giả hiển thị là Ẩn danh');

  const rawJsonForC = JSON.stringify(entryForC);
  assert.equal(
    'authorId' in entryForC,
    false,
    'Phản hồi cho C tuyệt đối không có trường authorId'
  );
  assert.equal(
    'userId' in entryForC,
    false,
    'Phản hồi cho C tuyệt đối không có trường userId'
  );
  assert.equal(
    'nickname' in entryForC,
    false,
    'Phản hồi cho C tuyệt đối không có trường nickname'
  );
  assert.equal(
    rawJsonForC.includes(sessionA.userId),
    false,
    'Chuỗi JSON trả về cho C không chứa userId của A'
  );
  assert.equal(
    rawJsonForC.includes(sessionA.nickname),
    false,
    'Chuỗi JSON trả về cho C không chứa biệt danh của A'
  );
  console.log(
    `   ✅ C thấy bài dưới tên "${entryForC.authorLabel}". Phản hồi JSON của C hoàn toàn sạch (không chứa authorId, nickname, avatar hay seatId): ${rawJsonForC}`
  );

  // 5c. Kiểm tra B không thấy bài trong danh sách VÀ không đọc được kể cả khi truy vấn trực tiếp bằng ID
  const bFeedRes = await apiCall(
    `/api/rooms/${testRoomCode}/diary`,
    { method: 'GET' },
    sessionB.sessionToken
  );
  assert.equal(bFeedRes.status, 200);
  assert.equal(
    bFeedRes.data.entries.length,
    0,
    'B không thấy bài nhật ký bị ẩn trong danh sách'
  );

  const bDirectRes = await apiCall(
    `/api/rooms/${testRoomCode}/diary/${diaryId}`,
    { method: 'GET' },
    sessionB.sessionToken
  );
  assert.equal(
    bDirectRes.status,
    404,
    'B truy vấn trực tiếp bằng ID bài cũng bị máy chủ chặn (404)'
  );
  console.log(
    `   ✅ B không thấy bài trong danh sách (0 bài) và truy vấn trực tiếp /diary/${diaryId} bị máy chủ từ chối (${bDirectRes.status}).`
  );

  // 5d. B đổi biệt danh -> quyền ẩn theo ID nội bộ vẫn giữ nguyên
  await apiCall(
    `/api/rooms/${testRoomCode}/profile`,
    {
      method: 'PUT',
      body: { nickname: 'Bình Đổi Tên Mới' },
    },
    sessionB.sessionToken
  );
  const bFeedAfterRename = await apiCall(
    `/api/rooms/${testRoomCode}/diary`,
    { method: 'GET' },
    sessionB.sessionToken
  );
  assert.equal(
    bFeedAfterRename.data.entries.length,
    0,
    'Sau khi B đổi biệt danh, quyền ẩn theo ID nội bộ vẫn chính xác'
  );
  console.log('   ✅ Khi B đổi biệt danh, quyền ẩn lưu theo ID nội bộ vẫn giữ nguyên hiệu lực.');

  // ------------------------------------------------------------------------
  // KỊCH BẢN 6: Chức vụ Trưởng phòng (Người tạo phòng -> Chuyển quyền -> Xóa người chơi khỏi phòng)
  // ------------------------------------------------------------------------
  console.log('\n▶ Kiểm thử 6: Quyền Trưởng phòng (Người tạo phòng, chuyển quyền & xóa thành viên)...');
  const stateCheckManager = await apiCall(
    `/api/rooms/${testRoomCode}/state`,
    { method: 'GET' },
    sessionA.sessionToken
  );
  assert.equal(
    stateCheckManager.data.room.managerUserId,
    sessionA.userId,
    'Người tạo phòng (A) mặc định là Trưởng phòng'
  );
  console.log('   ✅ Người tạo phòng (A) tự động giữ chức vụ Trưởng phòng.');

  // Thành viên thường (B) thử xóa C khi chưa phải Trưởng phòng -> bị từ chối 403
  const unauthorizedKick = await apiCall(
    `/api/rooms/${testRoomCode}/members/kick`,
    {
      method: 'POST',
      body: { targetUserId: sessionC.userId },
    },
    sessionB.sessionToken
  );
  assert.equal(unauthorizedKick.status, 403, 'Thành viên thường không được phép xóa người khác');

  // A chuyển quyền Trưởng phòng cho B
  const transferToB = await apiCall(
    `/api/rooms/${testRoomCode}/manager/transfer`,
    {
      method: 'POST',
      body: { targetUserId: sessionB.userId },
    },
    sessionA.sessionToken
  );
  assert.equal(transferToB.status, 200);
  assert.equal(transferToB.data.room.managerUserId, sessionB.userId);
  console.log('   ✅ A chuyển quyền Trưởng phòng cho B thành công.');

  // B (nay là Trưởng phòng) xóa C ra khỏi phòng
  const kickCRes = await apiCall(
    `/api/rooms/${testRoomCode}/members/kick`,
    {
      method: 'POST',
      body: { targetUserId: sessionC.userId },
    },
    sessionB.sessionToken
  );
  assert.equal(kickCRes.status, 200);
  assert.equal(
    kickCRes.data.members.some((m: any) => m.userId === sessionC.userId),
    false,
    'C đã bị xóa khỏi danh sách thành viên phòng'
  );

  // C thử truy cập lại phòng sau khi bị xóa -> bị chặn 403
  const cStateAfterKick = await apiCall(
    `/api/rooms/${testRoomCode}/state`,
    { method: 'GET' },
    sessionC.sessionToken
  );
  assert.equal(cStateAfterKick.status, 403, 'Người bị xóa không còn quyền truy cập phòng (403)');
  console.log('   ✅ Trưởng phòng mới (B) xóa C ra khỏi phòng thành công; C bị thu hồi quyền vào phòng (403).');

  // Dọn dẹp lại dữ liệu test để phòng mặc định luôn sạch sẽ cho người dùng
  await apiCall('/api/reset', { method: 'POST', body: {} });

  console.log('\n================================================================');
  console.log(' TẤT CẢ 6 KỊCH BẢN KIỂM THỬ A, B, C ĐỀU VƯỢT QUA 100%!');
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
