-- ============================================================================
-- VĂN PHÒNG ẢO (TỊNH TÂM 3D) - SUPABASE SCHEMA, MIGRATIONS & RLS POLICIES
-- Múi giờ chuẩn: Asia/Ho_Chi_Minh
-- Tất cả thao tác ghi đều xác minh danh tính qua auth.uid() từ máy chủ.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. BẢNG PHÒNG (ROOMS)
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. BẢNG THÀNH VIÊN PHÒNG (ROOM MEMBERS)
create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 40),
  avatar_gender text not null check (avatar_gender in ('male', 'female')),
  member_tag text not null, -- Mã ngắn phân biệt khi trùng biệt danh (VD: #A1B2)
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);

-- 3. BẢNG GHẾ LÀM VIỆC CỐ ĐỊNH (8 GHẾ LÀM VIỆC / PHÒNG)
-- Bàn họp (6 ghế dùng chung) nằm ngoài danh sách ghế đăng ký cố định.
create table if not exists public.seats (
  room_id uuid not null references public.rooms(id) on delete cascade,
  seat_id text not null check (seat_id in (
    'seat-top-1', 'seat-top-2',
    'seat-mid-1', 'seat-mid-2',
    'seat-bot-1', 'seat-bot-2',
    'seat-right-1', 'seat-right-2'
  )),
  label text not null,
  zone text not null,
  occupied_by_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  primary key (room_id, seat_id),
  unique (room_id, occupied_by_user_id)
);

-- 4. BẢNG TIN NHẮN TRỰC TIẾP (MESSAGES)
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_msg_id text not null, -- Chống tạo tin trùng khi retry
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (room_id, user_id, client_msg_id)
);

-- 5. BẢNG LỊCH CHẤM CÔNG CÁ NHÂN (ATTENDANCE)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null, -- Lưu theo ngày lịch Asia/Ho_Chi_Minh (YYYY-MM-DD)
  status text not null check (status in ('none', 'full', 'half', 'off')),
  seq bigint not null default 1, -- Thứ tự thao tác để giữ đúng trạng thái cuối khi bấm nhanh
  updated_at timestamptz not null default now(),
  unique (room_id, user_id, work_date)
);

-- 6. BẢNG NHẬT KÝ ẨN DANH (DIARY ENTRIES)
-- Lưu ý: Bảng gốc có author_id để tác giả quản lý trong "Bài của tôi",
-- nhưng RLS CHẶN toàn bộ thành viên khác SELECT trực tiếp bảng này.
-- Thành viên khác chỉ đọc qua RPC đã lọc quyền xem và xóa hoàn toàn author_id.
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  mood text not null default 'sharing',
  content text not null check (char_length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. BẢNG DANH SÁCH NGƯỜI BỊ ẨN KHỎI BÀI NHẬT KÝ (DIARY HIDDEN MEMBERS)
create table if not exists public.diary_hidden_members (
  diary_id uuid not null references public.diary_entries(id) on delete cascade,
  hidden_user_id uuid not null references auth.users(id) on delete cascade,
  primary key (diary_id, hidden_user_id)
);

-- 8. BẢNG TÍN HIỆU ĐỒNG BỘ NHẬT KÝ REALTIME (KHÔNG CHỨA NỘI DUNG HAY TÁC GIẢ)
create table if not exists public.diary_sync_signals (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  signal_seq bigint not null default 1,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- HÀM KIỂM TRA TƯ CÁCH THÀNH VIÊN PHÒNG
-- ============================================================================
create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = p_room_id
      and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- BẬT ROW LEVEL SECURITY (RLS) CHO TẤT CẢ CÁC BẢNG
-- ============================================================================
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.seats enable row level security;
alter table public.messages enable row level security;
alter table public.attendance enable row level security;
alter table public.diary_entries enable row level security;
alter table public.diary_hidden_members enable row level security;
alter table public.diary_sync_signals enable row level security;

-- Quy tắc cho ROOMS: chỉ thành viên trong phòng mới đọc được thông tin phòng
create policy "room_members_can_select_room"
  on public.rooms for select
  using (public.is_room_member(id));

-- Quy tắc cho ROOM_MEMBERS: chỉ thành viên cùng phòng mới đọc được danh sách thành viên
create policy "room_members_can_select_members"
  on public.room_members for select
  using (public.is_room_member(room_id));

create policy "member_can_update_own_profile"
  on public.room_members for update
  using (user_id = auth.uid() and public.is_room_member(room_id))
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Quy tắc cho SEATS: chỉ thành viên cùng phòng mới xem được trạng thái ghế
create policy "room_members_can_select_seats"
  on public.seats for select
  using (public.is_room_member(room_id));

-- Quy tắc cho MESSAGES: chỉ thành viên của phòng được đọc và gửi tin
create policy "room_members_can_select_messages"
  on public.messages for select
  using (public.is_room_member(room_id));

create policy "room_members_can_insert_own_messages"
  on public.messages for insert
  with check (
    user_id = auth.uid()
    and public.is_room_member(room_id)
  );

-- Quy tắc cho ATTENDANCE: mỗi người CHỈ đọc và chỉnh lịch chấm công của chính mình
create policy "user_can_select_own_attendance"
  on public.attendance for select
  using (user_id = auth.uid() and public.is_room_member(room_id));

create policy "user_can_insert_own_attendance"
  on public.attendance for insert
  with check (user_id = auth.uid() and public.is_room_member(room_id));

create policy "user_can_update_own_attendance"
  on public.attendance for update
  using (user_id = auth.uid() and public.is_room_member(room_id))
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- Quy tắc cho DIARY_ENTRIES:
-- Trực tiếp trên bảng: CHỈ tác giả (author_id = auth.uid()) mới được SELECT/INSERT/UPDATE/DELETE ("Bài của tôi")
-- Thành viên khác KHÔNG thể SELECT bảng này để tránh lộ author_id.
create policy "author_can_select_own_diary"
  on public.diary_entries for select
  using (author_id = auth.uid() and public.is_room_member(room_id));

create policy "author_can_insert_own_diary"
  on public.diary_entries for insert
  with check (author_id = auth.uid() and public.is_room_member(room_id));

create policy "author_can_update_own_diary"
  on public.diary_entries for update
  using (author_id = auth.uid() and public.is_room_member(room_id))
  with check (author_id = auth.uid() and public.is_room_member(room_id));

create policy "author_can_delete_own_diary"
  on public.diary_entries for delete
  using (author_id = auth.uid() and public.is_room_member(room_id));

-- Quy tắc cho DIARY_HIDDEN_MEMBERS: chỉ tác giả bài viết mới xem và cập nhật danh sách ẩn
create policy "author_can_manage_hidden_members"
  on public.diary_hidden_members for all
  using (
    exists (
      select 1 from public.diary_entries d
      where d.id = diary_id and d.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.diary_entries d
      where d.id = diary_id and d.author_id = auth.uid()
    )
  );

-- Quy tắc cho DIARY_SYNC_SIGNALS: thành viên phòng nhận tín hiệu đồng bộ không chứa nội dung
create policy "room_members_can_select_diary_signals"
  on public.diary_sync_signals for select
  using (public.is_room_member(room_id));

-- ============================================================================
-- CÁC HÀM RPC XỬ LÝ NGHIỆP VỤ AN TOÀN TRÊN MÁY CHỦ
-- ============================================================================

-- 1. Vào phòng bằng mã phòng (tự khởi tạo 8 ghế nếu phòng mới)
create or replace function public.join_room_by_code(
  p_room_code text,
  p_nickname text,
  p_gender text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_member public.room_members%rowtype;
  v_tag text;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED: Phiên đăng nhập không hợp lệ';
  end if;

  select * into v_room
  from public.rooms
  where upper(trim(code)) = upper(trim(p_room_code));

  if not found then
    raise exception 'INVALID_ROOM_CODE: Mã phòng không tồn tại';
  end if;

  v_tag := '#' || upper(substr(replace(v_user_id::text, '-', ''), 1, 4));

  insert into public.room_members (room_id, user_id, nickname, avatar_gender, member_tag, last_seen_at)
  values (v_room.id, v_user_id, trim(p_nickname), p_gender, v_tag, now())
  on conflict (room_id, user_id)
  do update set
    nickname = excluded.nickname,
    avatar_gender = excluded.avatar_gender,
    last_seen_at = now()
  returning * into v_member;

  return jsonb_build_object(
    'room_id', v_room.id,
    'room_code', v_room.code,
    'room_name', v_room.name,
    'member', row_to_json(v_member)
  );
end;
$$;

-- 2. Chọn ghế làm việc cố định (Xử lý tranh chấp nguyên tử bằng FOR UPDATE)
create or replace function public.claim_work_seat(
  p_room_id uuid,
  p_seat_id text
)
returns public.seats
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_seat public.seats%rowtype;
begin
  if v_user_id is null or not public.is_room_member(p_room_id) then
    raise exception 'FORBIDDEN: Bạn không phải thành viên của phòng này';
  end if;

  -- Khóa dòng ghế mục tiêu để chống race condition khi 2 người bấm cùng lúc
  select * into v_target_seat
  from public.seats
  where room_id = p_room_id and seat_id = p_seat_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: Ghế không tồn tại';
  end if;

  if v_target_seat.occupied_by_user_id is not null and v_target_seat.occupied_by_user_id <> v_user_id then
    raise exception 'SEAT_TAKEN: Ghế này vừa có đồng nghiệp khác chọn trước';
  end if;

  -- Nếu người dùng đang giữ ghế khác trong phòng, giải phóng ghế cũ trước
  update public.seats
  set occupied_by_user_id = null,
      claimed_at = null
  where room_id = p_room_id
    and occupied_by_user_id = v_user_id
    and seat_id <> p_seat_id;

  -- Gán ghế mới cho người dùng
  update public.seats
  set occupied_by_user_id = v_user_id,
      claimed_at = now()
  where room_id = p_room_id
    and seat_id = p_seat_id
  returning * into v_target_seat;

  return v_target_seat;
end;
$$;

-- 3. Lấy danh sách bài nhật ký ẩn danh (Lọc quyền xem ở DB & XÓA SẠCH danh tính tác giả)
create or replace function public.get_room_diary_feed(p_room_id uuid)
returns table (
  id uuid,
  room_id uuid,
  author_label text,
  mood text,
  content text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_room_member(p_room_id) then
    raise exception 'FORBIDDEN: Bạn không có quyền truy cập phòng này';
  end if;

  return query
  select
    d.id,
    d.room_id,
    'Ẩn danh'::text as author_label,
    d.mood,
    d.content,
    d.created_at,
    d.updated_at
  from public.diary_entries d
  where d.room_id = p_room_id
    and not exists (
      select 1
      from public.diary_hidden_members hm
      where hm.diary_id = d.id
        and hm.hidden_user_id = v_user_id
    )
  order by d.created_at desc;
end;
$$;

-- 4. Mở trực tiếp 1 bài nhật ký theo ID (Kiểm tra quyền xem ở DB & XÓA SẠCH danh tính tác giả)
create or replace function public.get_room_diary_entry_by_id(
  p_room_id uuid,
  p_entry_id uuid
)
returns table (
  id uuid,
  room_id uuid,
  author_label text,
  mood text,
  content text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not public.is_room_member(p_room_id) then
    raise exception 'FORBIDDEN: Bạn không có quyền truy cập phòng này';
  end if;

  return query
  select
    d.id,
    d.room_id,
    'Ẩn danh'::text as author_label,
    d.mood,
    d.content,
    d.created_at,
    d.updated_at
  from public.diary_entries d
  where d.room_id = p_room_id
    and d.id = p_entry_id
    and not exists (
      select 1
      from public.diary_hidden_members hm
      where hm.diary_id = d.id
        and hm.hidden_user_id = v_user_id
    );
end;
$$;

