// Optional click sounds - a short, soft sound whenever a button, link, tab,
// switch or checkbox is pressed, different for each kind of control. Off by
// default; turned on in Settings and kept in localStorage on this device (like
// font size and reduce motion).
// The sound is generated with the Web Audio API, so there's no audio file to
// download. See components/click-sound-provider.tsx for when it plays.

const STORAGE_KEY = "helplift:click-sounds"
const CHANGE_EVENT = "helplift:click-sounds-change"

export function isClickSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on"
  } catch {
    return false
  }
}

export function setClickSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off")
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function onClickSoundChange(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

let context: AudioContext | null = null

// Each kind of control has its own short sound, so the sound says what you did.
export type ClickSoundKind =
  | "tap" //       ordinary buttons
  | "confirm" //   main / submit buttons
  | "tab" //       switching tabs
  | "toggle-on" // switch or checkbox turned on
  | "toggle-off" //  ...and off
  | "link" //      links
  | "danger" //    delete and other destructive buttons
  | "dismiss" //   close / cancel
  | "select" //    menu items and dropdown options

type Note = { from: number; to: number; at: number; length: number; volume: number; wave: OscillatorType }

// Frequencies in Hz, times in seconds. Everything stays short (<= ~0.12s) and quiet.
const SOUNDS: Record<ClickSoundKind, Note[]> = {
  tap: [{ from: 1400, to: 700, at: 0, length: 0.045, volume: 0.06, wave: "triangle" }],
  confirm: [
    { from: 880, to: 880, at: 0, length: 0.06, volume: 0.05, wave: "sine" },
    { from: 1320, to: 1320, at: 0.06, length: 0.08, volume: 0.05, wave: "sine" },
  ],
  tab: [{ from: 600, to: 1100, at: 0, length: 0.06, volume: 0.045, wave: "sine" }],
  "toggle-on": [{ from: 900, to: 1600, at: 0, length: 0.05, volume: 0.055, wave: "triangle" }],
  "toggle-off": [{ from: 1200, to: 600, at: 0, length: 0.05, volume: 0.05, wave: "triangle" }],
  link: [{ from: 2000, to: 1500, at: 0, length: 0.03, volume: 0.035, wave: "sine" }],
  danger: [{ from: 220, to: 110, at: 0, length: 0.1, volume: 0.09, wave: "sine" }],
  dismiss: [{ from: 1000, to: 450, at: 0, length: 0.07, volume: 0.045, wave: "sine" }],
  select: [{ from: 1250, to: 1250, at: 0, length: 0.04, volume: 0.045, wave: "sine" }],
}

/** Plays the sound for a kind of control. Safe to call on every click; it only plays from a user gesture. */
export function playClickSound(kind: ClickSoundKind = "tap") {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    context = context || new Ctor()
    if (context.state === "suspended") context.resume()
    const start = context.currentTime
    for (const note of SOUNDS[kind]) {
      const at = start + note.at
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = note.wave
      oscillator.frequency.setValueAtTime(note.from, at)
      if (note.to !== note.from) oscillator.frequency.exponentialRampToValueAtTime(note.to, at + note.length)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(note.volume, at + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.length)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + note.length + 0.01)
    }
  } catch {
    // Audio unavailable (blocked or unsupported) - clicks just stay silent.
  }
}
