type BlipParams = {
  freq?: number;
  type?: OscillatorType;
  dur?: number;
  vol?: number;
  slide?: number;
};

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const w = window as WebkitWindow;
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      audioCtx = null;
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function blip({
  freq = 880,
  type = "triangle",
  dur = 0.09,
  vol = 0.18,
  slide = 0,
}: BlipParams = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + slide),
      t + dur,
    );
  }
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playSelectSound(): void {
  blip({ freq: 720, type: "triangle", dur: 0.06, vol: 0.16, slide: 240 });
}

export function playDeselectSound(): void {
  blip({ freq: 520, type: "triangle", dur: 0.06, vol: 0.14, slide: -160 });
}

export function playAddSound(): void {
  blip({ freq: 660, type: "square", dur: 0.05, vol: 0.1 });
  setTimeout(() => blip({ freq: 990, type: "square", dur: 0.05, vol: 0.1 }), 35);
}

export function playRemoveSound(): void {
  blip({ freq: 440, type: "square", dur: 0.06, vol: 0.1, slide: -120 });
}

export function playBuySound(): void {
  blip({ freq: 660, type: "sine", dur: 0.1, vol: 0.18 });
  setTimeout(() => blip({ freq: 880, type: "sine", dur: 0.1, vol: 0.18 }), 80);
  setTimeout(
    () => blip({ freq: 1320, type: "sine", dur: 0.18, vol: 0.2 }),
    160,
  );
}

export function scheduleSpinTicks(
  durationMs: number,
): ReturnType<typeof setTimeout>[] {
  const handles: ReturnType<typeof setTimeout>[] = [];
  if (typeof window === "undefined") return handles;
  const ticks = 22;
  for (let i = 0; i < ticks; i++) {
    const t = i / ticks;
    const delay = durationMs * (1 - Math.pow(1 - t, 3));
    const handle = setTimeout(() => {
      blip({
        freq: 1200 + Math.random() * 200,
        type: "square",
        dur: 0.025,
        vol: 0.06,
      });
    }, delay);
    handles.push(handle);
  }
  return handles;
}

export function clearScheduledSounds(
  handles: ReturnType<typeof setTimeout>[],
): void {
  for (const handle of handles) {
    clearTimeout(handle);
  }
}
