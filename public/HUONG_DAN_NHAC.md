# Thư mục `public/` — Nơi chứa file âm thanh `.mp3` / `.wav` của Phòng Tịnh Tâm

Bạn hãy chép (copy/paste) các file nhạc hoặc âm thanh `.mp3` / `.wav` từ máy tính của bạn vào trực tiếp thư mục `public/` này.

## Ví dụ cách đặt tên file và điền vào `src/utils/zenSound.ts`:

1. Nếu bạn bỏ các file sau vào thư mục `public/` này:
   - `public/nhac-thien.mp3` (Nhạc nền phòng thiền)
   - `public/tieng-mo.mp3` (Tiếng gõ mõ)
   - `public/tieng-chuong.mp3` (Tiếng thỉnh chuông)

2. Mở file `src/utils/zenSound.ts`:
   - Tại `ZEN_MUSIC_TRACKS` (dòng 21), sửa `audioUrl` thành:
     ```ts
     audioUrl: './nhac-thien.mp3',
     ```
   - Tại `ZEN_SFX_CONFIG` (dòng 54-58), sửa thành:
     ```ts
     export const ZEN_SFX_CONFIG = {
       woodenFishAudioUrl: './tieng-mo.mp3',
       templeBellAudioUrl: './tieng-chuong.mp3',
     };
     ```

