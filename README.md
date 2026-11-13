# Văn phòng ảo — Tịnh Tâm 3D

Ứng dụng web nhiều người dùng **“Văn phòng ảo”** (phát triển từ ý tưởng *Tịnh Tâm*), mang đến một không gian văn phòng 3D low-poly ấm cúng để đồng nghiệp trò chuyện trực tiếp, tự ghi nhận lịch chấm công cá nhân và chia sẻ tâm sự ẩn danh an toàn.

---

## 1. Kiến trúc & Công nghệ

- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, Lucide Icons.
- **Cảnh 3D**: Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei` với mô hình nhân vật Nam/Nữ low-poly nhẹ, góc nhìn 3D từ trên chéo xuống thấy rõ bố cục phòng và từng nhân vật.
- **Backend & Cơ sở dữ liệu (Hỗ trợ 2 chế độ)**:
  1. **Chế độ Máy chủ cục bộ tích hợp sẵn (`VITE_BACKEND_MODE=local_server` — Mặc định, chạy ngay không cần cấu hình ngoài)**:
     - Tích hợp trực tiếp máy chủ API & Realtime (Server-Sent Events) tại [server/officeServer.ts](./server/officeServer.ts) cùng cơ sở dữ liệu lưu bền vững tại `server/data/db.json`.
     - Xác thực phiên ẩn danh bằng token do máy chủ cấp (`Authorization: Bearer <sessionToken>`), khóa nguyên tử (atomic lock) khi tranh chấp ghế, kiểm tra tư cách thành viên phòng và lọc quyền xem nhật ký ẩn danh hoàn toàn ở tầng máy chủ.
  2. **Chế độ Supabase Cloud (`VITE_BACKEND_MODE=supabase`)**:
     - Đã cung cấp đầy đủ schema, migration, Row Level Security (RLS) và các hàm RPC `security definer` tại [supabase/migrations/001_initial_schema.sql](./supabase/migrations/001_initial_schema.sql).
     - Không bao giờ đưa khóa quản trị (`service_role`) vào frontend; mọi thao tác ghi đều xác minh qua `auth.uid()`.

---

## 2. Hướng dẫn cài đặt & Chạy ứng dụng

### Bước 1: Cài đặt gói phụ thuộc

```bash
npm install
```

### Bước 2: Cấu hình biến môi trường (Tùy chọn)

Sao chép file `.env.example` thành `.env`:

```bash
cp .env.example .env
```

- Mặc định `VITE_BACKEND_MODE=local_server` giúp ứng dụng chạy đầy đủ tính năng nhiều người dùng ngay lập tức.
- Nếu muốn kết nối dự án Supabase thật, chạy file SQL trong `supabase/migrations/001_initial_schema.sql` trên Supabase SQL Editor và cập nhật `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` trong `.env`.

### Bước 3: Khởi chạy máy chủ phát triển

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

---

## 3. Cách kiểm thử nhiều người dùng (3 phiên độc lập A, B và C)

### Cách 1: Chạy kịch bản kiểm thử tự động 3 phiên A, B, C

Dự án đi kèm script kiểm thử đầu-cuối xác minh toàn bộ 5 luồng nghiệp vụ và bảo mật máy chủ:

```bash
npm run test:flows
```

Script này tự động kiểm tra:
1. **Tranh chấp ghế cố định**: A và B bấm cùng một ghế (`seat-top-1`) cùng lúc -> chỉ 1 người nhận được ghế (`200 OK`), người còn lại nhận thông báo `409 Conflict` và đứng ở vùng gần cửa hoặc chọn ghế khác.
2. **Tải lại trang**: A tải lại trang -> khôi phục đúng nhân vật, biệt danh, về đúng ghế đã lưu và giữ nguyên màu lịch chấm công.
3. **Chat trực tiếp & Bong bóng 5 giây**: A gửi tin nhắn -> B nhận được tin theo thời gian thực kèm `userId` của nhân vật A để hiện bong bóng trên đầu A; thử gửi lại (retry) với cùng `clientMsgId` không tạo tin nhắn trùng.
4. **Lịch chấm công cá nhân (`Asia/Ho_Chi_Minh`)**: A bấm một ô ngày 4 lần liên tiếp -> chuyển đúng vòng `Xanh lá (Làm đủ ca) → Vàng (Làm nửa ngày) → Đỏ (Nghỉ) → Xám (Chưa chấm công)`.
5. **Phòng nhật ký ẩn danh & Quyền ẩn theo ID nội bộ**: A đăng bài tâm sự và chọn *“Ẩn bài này với B”* -> A thấy trong *“Bài của tôi”*, C thấy bài dưới tên *“Ẩn danh”* (payload JSON của C hoàn toàn không chứa `authorId`, `nickname`, `avatar` hay `seatId`), còn B không thấy bài trong danh sách và bị máy chủ chặn (`404`) kể cả khi truy vấn trực tiếp bằng ID bài.

### Cách 2: Kiểm thử trực tiếp trên trình duyệt với 3 tab độc lập

Ứng dụng hỗ trợ tham số `?session=` trên URL để mở nhiều tài khoản ẩn danh độc lập ngay trên cùng một trình duyệt mà vẫn giữ lưu trữ riêng khi nhấn `F5` (tải lại trang):

- **Phiên A**: `http://localhost:5173/?session=A`
- **Phiên B**: `http://localhost:5173/?session=B`
- **Phiên C**: `http://localhost:5173/?session=C`

*(Hoặc dùng 3 cửa sổ ẩn danh / 3 trình duyệt khác nhau vào `http://localhost:5173` với mã phòng mặc định `TINHTAM`).*

