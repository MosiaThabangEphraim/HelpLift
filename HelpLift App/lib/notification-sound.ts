// A short two-note chime for new notifications, generated with the Web Audio API
// so no sound file is needed. Browsers refuse to make sound until the person has
// interacted with the page, so playback is best-effort and never throws.

const STORAGE_KEY = "helplift:notification-sound"

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
    return window.localStorage.getItem(STORAGE_KEY) !== "off"
  } catch {
    return true
  }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off")
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

export function playNotificationSound() {
  try {
    if (!isNotificationSoundEnabled()) return
    const audio = getContext()
    if (!audio) return
    if (audio.state === "suspended") audio.resume().catch(() => undefined)

    const start = audio.currentTime + 0.02
    const notes: [number, number][] = [[880, 0], [1318.5, 0.14]] // A5, then E6
    for (const [frequency, offset] of notes) {
      const oscillator = audio.createOscillator()
      const gain = audio.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      // Quick fade in and out so it doesn't click; kept quiet on purpose.
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.28)
      oscillator.connect(gain).connect(audio.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.3)
    }
  } catch {
    // No sound is better than an error.
  }
}
