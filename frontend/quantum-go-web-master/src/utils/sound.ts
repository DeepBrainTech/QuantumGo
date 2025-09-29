// Simple sound manager for game SFX and BGM
// - put: stone placement sound
// - start: game start sound
// - chinese-ancient: background music (looped)

// Import assets via Vite
import putSrc from "@/assets/audio/put.mp3";
import startSrc from "@/assets/audio/start.mp3";
import bgmSrc from "@/assets/audio/chinese-ancient.mp3";

let putAudio: HTMLAudioElement | null = null;
let startAudio: HTMLAudioElement | null = null;
let bgmAudio: HTMLAudioElement | null = null;

let bgmEnabled = true;

function ensureInit() {
  if (!putAudio) {
    putAudio = new Audio(putSrc);
    putAudio.volume = 0.6;
  }
  if (!startAudio) {
    startAudio = new Audio(startSrc);
    startAudio.volume = 0.8;
  }
  if (!bgmAudio) {
    bgmAudio = new Audio(bgmSrc);
    bgmAudio.loop = true;
    bgmAudio.volume = 0.25;
  }
}

export function playPut() {
  ensureInit();
  try {
    // Always allow put sound
    putAudio!.currentTime = 0;
    putAudio!.play();
  } catch (_) {
    // ignore autoplay errors
  }
}

export function playStart() {
  ensureInit();
  try {
    startAudio!.currentTime = 0;
    startAudio!.play();
  } catch (_) {
    // ignore autoplay errors
  }
}

export function startBgm() {
  ensureInit();
  if (!bgmEnabled) return;
  try {
    if (bgmAudio!.paused) {
      // resume from last time to avoid overlap
      bgmAudio!.play();
    }
  } catch (_) {
    // ignore autoplay errors
  }
}

// Explicitly restart BGM for a brand-new game
export function startBgmFromBeginning() {
  ensureInit();
  if (!bgmEnabled) return;
  try {
    if (!bgmAudio!.paused) bgmAudio!.pause();
    bgmAudio!.currentTime = 0;
    bgmAudio!.play();
  } catch (_) {
    // ignore autoplay errors
  }
}

export function stopBgm() {
  ensureInit();
  try {
    if (!bgmAudio!.paused) {
      bgmAudio!.pause();
    }
  } catch (_) {
    // ignore
  }
}

export function setBgmEnabled(on: boolean) {
  bgmEnabled = on;
  if (!on) {
    stopBgm();
  }
}

// Call to keep bgm consistent when game status or setting changes
export function syncBgm(status: "waiting" | "playing" | "finished", enabled: boolean) {
  setBgmEnabled(enabled);
  if (status === "playing" && enabled) {
    startBgm();
  } else {
    stopBgm();
  }
}
