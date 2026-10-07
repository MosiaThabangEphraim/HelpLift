// Shared by every "Continue with <provider>" button (Google, LinkedIn, and
// whichever comes next) to remember where the person started before they
// leave for the provider's own sign-in page. /auth/callback reads (and
// clears) this single cookie once they're sent back - one cookie for every
// provider, rather than a new one to read per provider as more get added.
export type OauthIntent = "org" | "giver" | "admin"

export function setOauthIntent(intent: OauthIntent | undefined) {
  document.cookie = intent
    ? `oauth_intent=${intent}; path=/; max-age=600; SameSite=Lax`
    : "oauth_intent=; path=/; max-age=0; SameSite=Lax"
}
