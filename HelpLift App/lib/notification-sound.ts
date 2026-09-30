// A short chime for new notifications, generated with the Web Audio API so no
// sound file is needed. Browsers refuse to make sound until the person has
// interacted with the page, so playback is best-effort and never throws.

const ENABLED_STORAGE_KEY = "helplift:notification-sound"
const CHOICE_STORAGE_KEY = "helplift:notification-sound-choice"

type Note = { frequency: number; offset: number; duration: number; type: OscillatorType; peakGain: number }

export type NotificationSoundId = "chime" | "ping" | "marimba" | "bell" | "pop"

export const NOTIFICATION_SOUNDS: { id: NotificationSoundId; label: string }[] = [
  { id: "chime", label: "Chime" },
  { id: "ping", label: "Ping" },
  { id: "marimba", label: "Marimba" },
  { id: "bell", label: "Bell" },
  { id: "pop", label: "Pop" },
]

const SOUND_NOTES: Record<NotificationSoundId, Note[]> = {
  // Two-note ascending sine, A5 then E6 - the original default sound.
  chime: [
    { frequency: 880, offset: 0, duration: 0.3, type: "sine", peakGain: 0.18 },
    { frequency: 1318.5, offset: 0.14, duration: 0.3, type: "sine", peakGain: 0.18 },
  ],
  // A single short, bright note.
  ping: [
    { frequency: 1760, offset: 0, duration: 0.18, type: "sine", peakGain: 0.16 },
  ],
  // Three quick descending triangle-wave notes.
  marimba: [
    { frequency: 1046.5, offset: 0, duration: 0.16, type: "triangle", peakGain: 0.16 },
    { frequency: 880, offset: 0.08, duration: 0.16, type: "triangle", peakGain: 0.14 },
    { frequency: 698.5, offset: 0.16, duration: 0.22, type: "triangle", peakGain: 0.14 },
  ],
  // A fundamental plus a quiet overtone, with a longer decay, for a softer,
  // rounder tone.
  bell: [
    { frequency: 659.3, offset: 0, duration: 0.55, type: "sine", peakGain: 0.16 },
    { frequency: 1318.5, offset: 0, duration: 0.4, type: "sine", peakGain: 0.05 },
  ],
  // A very short, low, percussive blip.
  pop: [
    { frequency: 220, offset: 0, duration: 0.09, type: "square", peakGain: 0.12 },
  ],
}

let context: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctor) return null
  if (!context) context = new Ctor()
  return context
}

export function isNotificationSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "on" : "off")
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
}

export function getNotificationSoundChoice(): NotificationSoundId {
  try {
    const stored = window.localStorage.getItem(CHOICE_STORAGE_KEY)
    if (stored && stored in SOUND_NOTES) return stored as NotificationSoundId
  } catch {
    // Fall through to the default below.
  }
  return "chime"
}

export function setNotificationSoundChoice(id: NotificationSoundId) {
  try {
    window.localStorage.setItem(CHOICE_STORAGE_KEY, id)
  } catch {
    // Storage can be blocked (private windows); the choice just won't persist.
  }
}

// Call from a click/keypress so the browser allows sound later, when a
// notification arrives without any interaction.
export function unlockNotificationSound() {
  const audio = getContext()
  if (audio && audio.state === "suspended") audio.resume().catch(() => undefined)
}

// Plays the given sound regardless of the on/off setting - used for previews
// in the settings dialog. Pass no id to play whichever sound is currently
// chosen (the normal "a notification just arrived" path, which does respect
// the on/off setting).
export function playNotificationSound(id?: NotificationSoundId) {
  try {
    const isPreview = id !== undefined
    if (!isPreview && !isNotificationSoundEnabled()) return
    const audio = getContext()
    if (!audio) return
    if (audio.state === "suspended") audio.resume().catch(() => undefined)

    const notes = SOUND_NOTES[id ?? getNotificationSoundChoice()]
    const start = audio.currentTime + 0.02
    for (const note of notes) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = note.type
      oscillator.frequency.value = note.frequency
      // Quick fade in and out so it doesn't click; kept quiet on purpose.
      gain.gain.setValueAtTime(0.0001, start + note.offset)
      gain.gain.exponentialRampToValueAtTime(note.peakGain, start + note.offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.offset + note.duration)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(start + note.offset)
      oscillator.stop(start + note.offset + note.duration + 0.02)
    }
  } catch {
    // No sound is better than an error.
  }
}
