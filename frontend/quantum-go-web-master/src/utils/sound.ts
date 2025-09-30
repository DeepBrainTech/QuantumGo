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

// Sound switches
let masterMuted = false;
let sfxEnabled = true; // stone placement, start sound
let bgmEnabled = true; // background music on/off

// Volumes (0..1)
let sfxVolume = 0.6;
let startVolume = 0.8;
let bgmVolume = 0.25;

function ensureInit() {
  if (!putAudio) {
    putAudio = new Audio(putSrc);
    putAudio.volume = sfxVolume;
  }
  if (!startAudio) {
    startAudio = new Audio(startSrc);
    startAudio.volume = startVolume;
  }
  if (!bgmAudio) {
    bgmAudio = new Audio(bgmSrc);
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;
  }
}

export function playPut() {
  ensureInit();
  try {
    if (masterMuted || !sfxEnabled) return;
    putAudio!.currentTime = 0;
    putAudio!.play();
  } catch (_) {
    // ignore autoplay errors
  }
}

export function playStart() {
  ensureInit();
  try {
    if (masterMuted || !sfxEnabled) return;
    startAudio!.currentTime = 0;
    startAudio!.play();
  } catch (_) {
    // ignore autoplay errors
  }
}

export function startBgm() {
  ensureInit();
  if (!bgmEnabled || masterMuted) return;
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
  if (!bgmEnabled || masterMuted) return;
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

export function setSfxEnabled(on: boolean) {
  sfxEnabled = on;
}

export function setMasterMuted(muted: boolean) {
  masterMuted = muted;
  if (muted) stopBgm();
}

export function setBgmVolume(v: number) {
  bgmVolume = Math.max(0, Math.min(1, v));
  ensureInit();
  if (bgmAudio) bgmAudio.volume = bgmVolume;
}

export function setSfxVolume(v: number) {
  sfxVolume = Math.max(0, Math.min(1, v));
  startVolume = sfxVolume; // keep same scale for start sound
  ensureInit();
  if (putAudio) putAudio.volume = sfxVolume;
  if (startAudio) startAudio.volume = startVolume;
}

// Call to keep bgm consistent when game status or setting changes
export function syncBgm(status: "waiting" | "playing" | "finished", enabled: boolean) {
  setBgmEnabled(enabled);
  if (status === "playing" && enabled && !masterMuted) {
    startBgm();
  } else {
    stopBgm();
  }
}

export function getState() {
  return { masterMuted, sfxEnabled, bgmEnabled, sfxVolume, bgmVolume };
}
