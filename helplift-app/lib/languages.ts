// Languages HelpLift can translate content into (components/translatable-text.tsx,
// app/api/public/translate). South Africa's official languages first, by how widely
// they're spoken at home, then a few others visitors may use.
export const TRANSLATE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
  { code: "af", label: "Afrikaans" },
  { code: "nso", label: "Sepedi" },
  { code: "tn", label: "Setswana" },
  { code: "st", label: "Sesotho" },
  { code: "ts", label: "Xitsonga" },
  { code: "ss", label: "siSwati" },
  { code: "ve", label: "Tshivenda" },
  { code: "nr", label: "isiNdebele" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
] as const

export type TranslateLanguage = (typeof TRANSLATE_LANGUAGES)[number]["code"]

// Speech locales for the microphone and spoken replies (BCP 47). Browsers
// support these unevenly - e.g. Chrome recognises isiZulu and Afrikaans
// speech, but few devices have isiZulu voices to read replies aloud.
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-ZA", zu: "zu-ZA", xh: "xh-ZA", af: "af-ZA", nso: "nso-ZA", tn: "tn-ZA", st: "st-ZA",
  ts: "ts-ZA", ss: "ss-ZA", ve: "ve-ZA", nr: "nr-ZA", pt: "pt-PT", fr: "fr-FR",
}
export function speechLocale(code: string): string | undefined {
  return SPEECH_LOCALES[code]
}

// A light guess at which language a text is in, from common words - enough to
// stop an English voice reading isiZulu (which sounds like gibberish). Returns
// a language code from TRANSLATE_LANGUAGES, or null when it looks English or
// can't tell.
const COMMON_WORDS: Record<string, string[]> = {
  af: ["die", "en", "nie", "van", "het", "jy", "jou", "om", "ek", "wat", "vir", "met", "is", "kan", "ons", "hierdie", "asseblief"],
  zu: ["ukuthi", "futhi", "noma", "ngoba", "uma", "ukuze", "kanye", "ngicela", "sawubona", "yini", "ukunikela", "lapho", "kodwa", "nje", "ngiyabonga", "kahle", "khona"],
  xh: ["ukuba", "kwaye", "okanye", "nceda", "enkosi", "molo", "kakhulu", "kodwa", "apho", "ukuze", "kule", "yintoni"],
  st: ["ho", "hore", "mme", "ka", "le", "ya", "ke", "ena", "kapa", "hobane", "haholo", "dumela", "kgotso", "hao", "rona"],
  tn: ["go", "gore", "mme", "le", "ka", "ke", "fa", "kgotsa", "thata", "dumela", "rona", "gonne", "jaaka"],
  nso: ["go", "gore", "le", "ka", "ke", "goba", "gomme", "thušo", "kudu", "dumela", "rena", "ka gobane"],
}
const ENGLISH_WORDS = ["the", "and", "to", "you", "is", "of", "for", "your", "a", "in", "on", "it", "can", "with", "this", "that", "please"]

export function guessLanguage(text: string): string | null {
  const words = text.toLowerCase().match(/[a-zà-ÿš]+/g) || []
  if (words.length < 3) return null
  const count = (list: string[]) => words.filter(word => list.includes(word)).length
  const english = count(ENGLISH_WORDS)
  let best: string | null = null
  let bestScore = 0
  for (const [code, list] of Object.entries(COMMON_WORDS)) {
    const score = count(list)
    if (score > bestScore) { best = code; bestScore = score }
  }
  return best && bestScore >= 2 && bestScore > english ? best : null
}

export function languageLabel(code: string) {
  return TRANSLATE_LANGUAGES.find(language => language.code === code)?.label || code
}
