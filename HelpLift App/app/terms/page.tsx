import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Terms of Service — HelpLift",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-justify text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  )
}

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 pt-28 pb-24 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Terms of Service</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Effective 18 September 2026</p>
        </div>

        <Section title="1. Acceptance of these terms">
          <p>
            By creating an account or otherwise using HelpLift, you agree to these Terms of Service and to our{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>. If you don't agree, please don't use the platform.
          </p>
        </Section>

        <Section title="2. Who can use HelpLift">
          <p>HelpLift has three types of accounts:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-slate-800 dark:text-slate-100">Givers</strong> — individuals, businesses, or groups who browse community needs, donate, or offer goods and services through the Gift Library. You must be at least 18 years old to register.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Organizations</strong> — registered non-profits, NGOs, or similar community organizations who post needs and receive support. Organizations must complete our verification process (below) before their needs are made public or they can receive donations.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Administrators</strong> — HelpLift staff who verify organizations, moderate content, and support users.</li>
          </ul>
        </Section>

        <Section title="3. Account registration and accuracy">
          <p>
            You agree to provide accurate, current information when registering and to keep it up to date.
            You're responsible for keeping your login credentials confidential and for all activity under your
            account. Notify us immediately if you suspect unauthorized access.
          </p>
        </Section>

        <Section title="4. Organization verification">
          <p>
            An organization's account starts in a pending state. An administrator reviews the registration details
            and any uploaded documents (such as a registration certificate, tax-exemption letter, or founding
            document) before approving the account. Until approved, an organization can prepare its profile and
            upload documents, but its needs remain unpublished and it cannot claim Gift Library offerings or
            receive donations. An administrator may also request additional information, or decline verification,
            at their discretion. Administrators may also reject an individual need (for example, if it doesn't meet
            our content guidelines) even after the organization itself is verified.
          </p>
        </Section>

        <Section title="5. Donations and payments">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Donations can be made by manual bank transfer (EFT) into HelpLift's bank account, using the reference code shown at checkout and uploading proof of payment for an administrator to verify, or by card / Instant EFT through our payment processor, PayFast.</li>
            <li>HelpLift receives donation funds on behalf of the organization the donation is intended for, and is responsible for forwarding verified donations to that organization's registered bank account.</li>
            <li>A donation is only confirmed once an administrator has verified the corresponding proof of payment (for EFT) or the PayFast transaction has completed successfully.</li>
            <li>Donations made in good faith are generally non-refundable once confirmed, except where required by law or at HelpLift's discretion in cases of error or fraud.</li>
            <li>Gift Library offerings (goods, services, or financial pledges) are subject to the same claim, review, and — for financial pledges — payment-verification process as donations.</li>
          </ul>
        </Section>

        <Section title="6. Content you post">
          <p>
            You retain ownership of the needs, impact stories, photos, videos, and messages you post. By posting
            content that is published to the platform (such as a need or an impact story), you grant HelpLift a
            license to display that content on the platform for as long as your account and that content remain
            active. You're responsible for making sure you have the right to share anything you upload, and that it
            doesn't infringe anyone else's rights.
          </p>
        </Section>

        <Section title="7. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provide false information about yourself or an organization, including fabricated registration or verification documents.</li>
            <li>Use the platform to solicit funds for a need that doesn't genuinely exist, or misuse donated funds or goods for a purpose other than the listed need.</li>
            <li>Harass, threaten, or send unsolicited commercial messages to other users through the platform's messaging system.</li>
            <li>Attempt to circumvent our verification, moderation, or payment-verification processes.</li>
            <li>Upload content that is unlawful, defamatory, or infringes another person's rights.</li>
          </ul>
        </Section>

        <Section title="8. Suspension and termination">
          <p>
            We may suspend or permanently remove an account that violates these terms, is suspected of fraud or
            abuse, or fails verification. A suspended account cannot access most platform features and can only
            message an administrator until the suspension is resolved. You may delete your own giver or
            organization account at any time from Settings; records of confirmed donations may be retained after
            deletion as described in our Privacy Policy.
          </p>
        </Section>

        <Section title="9. Platform role and disclaimer">
          <p>
            HelpLift is a platform that connects organizations and givers and facilitates donations between them.
            We verify organizations to the best of our ability before allowing them to publish needs, but we do not
            guarantee the outcome, impact, or completion of any need, and we are not a party to the underlying
            charitable relationship between a giver and an organization beyond forwarding verified donations. The
            platform is provided "as is," without warranties of any kind, to the fullest extent permitted by law.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the fullest extent permitted by law, HelpLift is not liable for indirect, incidental, or
            consequential damages arising from your use of the platform. Nothing in these terms limits liability
            that cannot be limited under South African law.
          </p>
        </Section>

        <Section title="11. Changes to these terms">
          <p>
            We may update these terms from time to time. Continuing to use HelpLift after an update means you
            accept the revised terms. We'll update the effective date above when we make changes.
          </p>
        </Section>

        <Section title="12. Governing law">
          <p>These terms are governed by the laws of the Republic of South Africa.</p>
        </Section>

        <Section title="13. Contact us">
          <p>Questions about these terms? Reach us through the "Partner with us" contact form on our home page.</p>
        </Section>

        <p className="text-xs text-slate-400 pt-6 border-t border-slate-200 dark:border-slate-800">
          These terms are provided for general transparency about how HelpLift operates and do not constitute legal
          advice.
        </p>
      </div>
    </main>
  )
}
