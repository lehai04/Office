// Bộ tổng hợp âm thanh Tịnh Tâm (Web Audio API) — Tiếng Mõ Gỗ & Chuông Đồng

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Phát tiếng gõ mõ gỗ ("Cốc!") ấm và vang tự nhiên
 */
export function playWoodenFishSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Âm thân gỗ chính (Resonant hollow wood tone)
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
 */
export function playTempleBellSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
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

