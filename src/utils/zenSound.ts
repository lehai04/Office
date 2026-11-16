// Bộ âm thanh & Nhạc nền Phòng Tịnh Tâm (src/utils/zenSound.ts)
// Bạn có thể đổi link nhạc MP3 mặc định tại mảng ZEN_MUSIC_TRACKS bên dưới,
// hoặc bấm nút "🎵 Đổi nhạc" ngay trong giao diện Phòng Tịnh Tâm để tải file .mp3 từ máy lên!

export type ZenTrackId = 'off' | 'singing_bowl_432' | 'zen_flute_528' | 'temple_breeze' | 'custom_mp3';

export interface ZenMusicTrack {
  id: ZenTrackId;
  name: string;
  description: string;
  // Nếu bạn muốn dùng file .mp3 cố định trong code, hãy bỏ file vào thư mục public/ (ví dụ public/nhac-thien.mp3)
  // rồi điền đường dẫn vào audioUrl (ví dụ: './nhac-thien.mp3' hoặc link https://...mp3)
  audioUrl?: string;
}

export const ZEN_MUSIC_TRACKS: ZenMusicTrack[] = [
  {
    id: 'singing_bowl_432',
    name: '🥣 Chuông Xoay 432Hz',
    description: 'Âm thanh chuông xoay Tây Tạng trầm ấm giúp thư giãn sâu',
    audioUrl: '',
  },
  {
    id: 'zen_flute_528',
    name: '🪷 Hòa Âm Tịnh Tâm 528Hz',
    description: 'Giai điệu tần số 528Hz nhẹ nhàng giải tỏa căng thẳng',
    audioUrl: './nhac-thien.mp3',
  },
  {
    id: 'temple_breeze',
    name: '🎐 Chuông Gió Chùa Cổ',
    description: 'Tiếng chuông gió ngân vang thanh tịnh nơi hiên chùa',
    audioUrl: '',
  },
  {
    id: 'custom_mp3',
    name: '📂 Nhạc MP3 tự chọn',
    description: 'Phát bài nhạc thiền .mp3 từ máy của bạn',
    audioUrl: '',
  },
  {
    id: 'off',
    name: '🔇 Tắt nhạc nền',
    description: 'Chỉ giữ tiếng gõ mõ và tiếng chuông khi bấm',
  },
];

// ============================================================================
// CẤU HÌNH ÂM THANH GÕ MÕ & THỈNH CHUÔNG (Hiệu ứng âm thanh khi bấm nút)
// ============================================================================
// - Nếu để trống (''), hệ thống sẽ tự tạo tiếng Mõ Gỗ ("Cốc!") và Chuông Đồng ("Boong...")
//   bằng bộ tổng hợp âm thanh Web Audio ở hàm playWoodenFishSound() & playTempleBellSound() bên dưới.
// - Nếu bạn muốn thay bằng file âm thanh .mp3/.wav thật của riêng bạn:
//   1. Bỏ file (ví dụ: tieng-mo.mp3, tieng-chuong.mp3) vào thư mục public/
//   2. Điền đường dẫn vào bên dưới (ví dụ: './tieng-mo.mp3' hoặc link https://...mp3)
export const ZEN_SFX_CONFIG = {
  woodenFishAudioUrl: '', // Ví dụ: './tieng-mo.mp3'
  templeBellAudioUrl: './tieng-chuong.mp3', // Ví dụ: './tieng-chuong.mp3'
};

let sharedAudioCtx: AudioContext | null = null;
let bgMusicTimer: number | null = null;
let bgDroneNodes: { oscs: OscillatorNode[]; masterGain: GainNode } | null = null;
let htmlAudioElement: HTMLAudioElement | null = null;
let currentCustomUrl: string | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => { });
  }
  return sharedAudioCtx;
}

/**
 * Dừng toàn bộ nhạc nền Phòng Tịnh Tâm đang phát
 */
export function stopZenBackgroundMusic(): void {
  if (bgMusicTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(bgMusicTimer);
    bgMusicTimer = null;
  }
  if (bgDroneNodes) {
    try {
      const ctx = sharedAudioCtx;
      if (ctx) {
        bgDroneNodes.masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      }
      setTimeout(() => {
        bgDroneNodes?.oscs.forEach((o) => {
          try {
            o.stop();
            o.disconnect();
          } catch {
            // ignore
          }
        });
        bgDroneNodes = null;
      }, 320);
    } catch {
      bgDroneNodes = null;
    }
  }
  if (htmlAudioElement) {
    try {
      htmlAudioElement.pause();
      htmlAudioElement.currentTime = 0;
    } catch {
      // ignore
    }
  }
}

/**
 * Bắt đầu phát nhạc nền Phòng Tịnh Tâm theo bài được chọn
 */
export function startZenBackgroundMusic(
  trackId: ZenTrackId,
  customAudioUrl?: string | null
): void {
  stopZenBackgroundMusic();
  if (trackId === 'off' || typeof window === 'undefined') return;

  const trackConfig = ZEN_MUSIC_TRACKS.find((t) => t.id === trackId);
  const targetUrl =
    trackId === 'custom_mp3'
      ? customAudioUrl || currentCustomUrl || trackConfig?.audioUrl
      : trackConfig?.audioUrl;

  if (customAudioUrl) {
    currentCustomUrl = customAudioUrl;
  }

  // Nếu có file .mp3 hoặc URL âm thanh riêng -> phát bằng HTMLAudioElement lặp vô tận
  if (targetUrl) {
    try {
      if (!htmlAudioElement) {
        htmlAudioElement = new Audio();
        htmlAudioElement.loop = true;
      }
      htmlAudioElement.src = targetUrl;
      htmlAudioElement.volume = 0.45;
      htmlAudioElement.play().catch(() => { });
      return;
    } catch {
      // fallback sang bộ tổng hợp nhạc thiền Web Audio bên dưới
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  // Tạo nền hòa âm Ambient Pad êm dịu
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);
  masterGain.connect(ctx.destination);

  const baseFreqs =
    trackId === 'singing_bowl_432'
      ? [216, 432, 648]
      : trackId === 'zen_flute_528'
        ? [264, 396, 528]
        : [288, 432, 576];

  const oscs: OscillatorNode[] = baseFreqs.map((freq, idx) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    oscGain.gain.setValueAtTime(idx === 0 ? 0.5 : idx === 1 ? 0.3 : 0.15, ctx.currentTime);
    osc.connect(oscGain);
    oscGain.connect(masterGain);
    osc.start();
    return osc;
  });

  bgDroneNodes = { oscs, masterGain };

  // Điểm xuyết nốt chuông thiền / chuông gió định kỳ
  const scaleNotes =
    trackId === 'singing_bowl_432'
      ? [432, 576, 648, 864]
      : trackId === 'zen_flute_528'
        ? [528, 594, 660, 792, 880]
        : [768, 864, 1024, 1152, 1296];

  const playNote = () => {
    const c = getAudioContext();
    if (!c) return;
    const now = c.currentTime;
    const noteFreq = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(noteFreq, now);

    const duration = trackId === 'temple_breeze' ? 2.4 : 4.2;
    const peak = trackId === 'temple_breeze' ? 0.06 : 0.09;

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  };

  playNote();
  bgMusicTimer = window.setInterval(
    playNote,
    trackId === 'temple_breeze' ? 2200 : 3800
  );
}

/**
 * Phát tiếng gõ mõ gỗ ("Cốc!") ấm và vang tự nhiên
 * - Nếu ZEN_SFX_CONFIG.woodenFishAudioUrl có đường dẫn file .mp3/.wav -> ưu tiên phát file đó
 * - Nếu để trống -> phát âm thanh mõ gỗ tổng hợp bằng Web Audio API (có thể chỉnh tần số bên dưới)
 */
export function playWoodenFishSound(): void {
  if (ZEN_SFX_CONFIG.woodenFishAudioUrl && typeof window !== 'undefined') {
    try {
      const sfx = new Audio(ZEN_SFX_CONFIG.woodenFishAudioUrl);
      sfx.volume = 0.85;
      sfx.play().catch(() => { });
      return;
    } catch {
      // Nếu lỗi tải file thì tự động dùng âm thanh mõ tổng hợp bên dưới
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Âm thân gỗ chính (Resonant hollow wood tone) — chỉnh 640 -> 490 để đổi độ trầm/ổng của tiếng mõ
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(640, now);
  osc.frequency.exponentialRampToValueAtTime(490, now + 0.09);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(580, now);
  filter.Q.setValueAtTime(4.5, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.65, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.24);

  // Tiếng dùi chạm mặt mõ (Wood click transient)
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'sine';
  clickOsc.frequency.setValueAtTime(1450, now);
  clickOsc.frequency.exponentialRampToValueAtTime(520, now + 0.025);

  clickGain.gain.setValueAtTime(0.35, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);

  clickOsc.start(now);
  clickOsc.stop(now + 0.035);
}

/**
 * Phát tiếng chuông đồng / chuông xoay tịnh tâm ("Boong...") ngân dài
 * - Nếu ZEN_SFX_CONFIG.templeBellAudioUrl có đường dẫn file .mp3/.wav -> ưu tiên phát file đó
 * - Nếu để trống -> phát âm thanh chuông đồng 432Hz tổng hợp bằng Web Audio API
 */
export function playTempleBellSound(): void {
  if (ZEN_SFX_CONFIG.templeBellAudioUrl && typeof window !== 'undefined') {
    try {
      const sfx = new Audio(ZEN_SFX_CONFIG.templeBellAudioUrl);
      sfx.volume = 0.85;
      sfx.play().catch(() => { });
      return;
    } catch {
      // Nếu lỗi tải file thì tự động dùng âm thanh chuông tổng hợp bên dưới
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Chỉnh freq (tần số Hz) hoặc decay (độ ngân dài tính bằng giây) của tiếng chuông tại đây:
  const harmonics = [
    { freq: 432, amp: 0.35, decay: 3.2 },
    { freq: 864, amp: 0.18, decay: 2.2 },
    { freq: 1296, amp: 0.08, decay: 1.4 },
  ];

  for (const h of harmonics) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(h.freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(h.amp, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + h.decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + h.decay + 0.05);
  }
}

/**
 * Phát âm thanh phi tiêu / dao cắm phập vào khúc gỗ xoay (Knife Hit wood thud)
 */
export function playDartHitSound(isBullseye = false): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Tiếng dao cắm phập vào thân gỗ
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'triangle';
  thudOsc.frequency.setValueAtTime(220, now);
  thudOsc.frequency.exponentialRampToValueAtTime(58, now + 0.085);

  thudGain.gain.setValueAtTime(0.65, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  thudOsc.connect(thudGain);
  thudGain.connect(ctx.destination);
  thudOsc.start(now);
  thudOsc.stop(now + 0.11);

  if (isBullseye) {
    // Âm thanh chém trúng Táo hoặc phá vỡ khúc gỗ (Stage Clear!)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(0.24, now + idx * 0.055 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.34);
    });
  }
}

/**
 * Phát âm thanh "KENG!" khi phóng dao trúng phải con dao khác đang cắm trên khúc gỗ (Game Over / Mất lượt)
 */
export function playKnifeClangSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const freqs = [1180, 1760, 2420];
  freqs.forEach((f, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = idx === 0 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 0.65, now + 0.28);

    gain.gain.setValueAtTime(0.22 / (idx + 1), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  });
}

/**
 * Phát âm thanh Khúc Gỗ Vỡ Tung ("RẦM! CRACK!") khi cắm con dao cuối cùng qua màn
 */
export function playWoodShatterSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const boomOsc = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boomOsc.type = 'sawtooth';
  boomOsc.frequency.setValueAtTime(160, now);
  boomOsc.frequency.exponentialRampToValueAtTime(32, now + 0.32);

  boomGain.gain.setValueAtTime(0.7, now);
  boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  boomOsc.connect(boomGain);
  boomGain.connect(ctx.destination);
  boomOsc.start(now);
  boomOsc.stop(now + 0.36);

  playDartHitSound(true);
}

// ============================================================================
// ÂM THANH TIẾNG MÈO KÊU ("MEOW~", "PURR~") & NHẠC NỀN NHẸ NHÀNG CHO GAME NUÔI MÈO
// ============================================================================
let catBgMusicTimer: number | null = null;

/**
 * Phát tiếng mèo kêu dễ thương theo từng hành động:
 * - 'happy': Tiếng "Meow~" ngọt ngào kèm tiếng gừ gừ khi vuốt ve
 * - 'eat': Tiếng "Mlem~ Meow!" vui sướng khi được cho ăn
 * - 'play': Tiếng "Miu-miu!" nảy cao tinh nghịch khi chơi đùa
 * - 'adopt': Tiếng "Meow~" chào chủ mới kèm chuông lấp lánh
 */
export function playCatMeowSound(
  mood: 'happy' | 'eat' | 'play' | 'adopt' = 'happy'
): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const playSingleMeow = (
    startTime: number,
    startFreq: number,
    peakFreq: number,
    endFreq: number,
    duration: number,
    volume = 0.28
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, startTime + duration * 0.38);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(peakFreq * 1.15, startTime);
    filter.Q.setValueAtTime(2.2, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + duration * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.03);
  };

  if (mood === 'eat') {
    // Hai tiếng "Mlem~ Meow!" hào hứng khi ăn
    playSingleMeow(now, 540, 820, 660, 0.18, 0.24);
    playSingleMeow(now + 0.2, 620, 980, 580, 0.32, 0.28);
  } else if (mood === 'play') {
    // Tiếng "Miu~ Miu!" tinh nghịch khi vờn đồ chơi
    playSingleMeow(now, 680, 1080, 760, 0.22, 0.26);
    playSingleMeow(now + 0.24, 720, 1160, 820, 0.24, 0.26);
  } else if (mood === 'adopt') {
    // Tiếng "Meow~" kèm nốt chuông vui tươi
    playSingleMeow(now, 560, 940, 620, 0.38, 0.28);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + 0.15 + idx * 0.06);
      g.gain.setValueAtTime(0.001, now + 0.15 + idx * 0.06);
      g.gain.linearRampToValueAtTime(0.12, now + 0.17 + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42 + idx * 0.06);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + 0.15 + idx * 0.06);
      o.stop(now + 0.45 + idx * 0.06);
    });
  } else {
    // Mặc định 'happy' (Vuốt ve): Tiếng "Meow~" dịu dàng
    playSingleMeow(now, 510, 880, 560, 0.42, 0.28);
  }
}

/**
 * Nhạc nền Music-Box nhẹ nhàng, vui tươi khi ở trong màn hình Nuôi Mèo (chỉ phát khi người chơi bật âm thanh)
 */
export function startCatGameMusic(): void {
  stopCatGameMusic();
  if (typeof window === 'undefined') return;

  const melody = [523.25, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 698.46];
  let step = 0;

  const playTick = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freq = melody[step % melody.length];
    step += 1;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.95);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.0);
  };

  playTick();
  catBgMusicTimer = window.setInterval(playTick, 720);
}

export function stopCatGameMusic(): void {
  if (catBgMusicTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(catBgMusicTimer);
    catBgMusicTimer = null;
  }
}

/**
 * Phát âm báo tin nhắn mới ("Ting-tong~" nhẹ nhàng, rõ ràng) khi có người nhắn tin trong phòng
 */
export function playChatNotificationSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const notes = [587.33, 880]; // D5 -> A5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const t0 = now + idx * 0.09;
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.22, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.38);
  });
}

