import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Privacy Policy — HelpLift",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-justify text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] dark:bg-slate-950 pt-28 pb-24 px-4 md:px-8">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">Privacy Policy</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Effective 18 September 2026</p>
        </div>

        <Section title="1. Who we are">
          <p>
            HelpLift ("we", "us") operates the HelpLift platform, which connects verified non-profit
            organizations with individuals, businesses, and groups who want to give. This policy explains what
            personal information we collect from givers, organizations, and administrators, why we collect it, and
            what rights you have over it under South Africa's Protection of Personal Information Act, 2013 (POPIA).
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p><strong className="text-slate-800 dark:text-slate-100">Account information.</strong> When you register, we collect:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-slate-800 dark:text-slate-100">Givers</strong> (individual, business, or group): full name, email address, phone number, and account type.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Organizations</strong>: organization name, type, registration number, contact person's name and role, email, phone, physical address, mission statement, and banking details (used to forward verified donations to you).</li>
          </ul>
          <p><strong className="text-slate-800 dark:text-slate-100">Verification documents.</strong> Organizations upload registration certificates, tax exemption letters, founding documents, and proof of banking details so our administrators can verify the organization before it can publish needs or receive donations.</p>
          <p><strong className="text-slate-800 dark:text-slate-100">Donation and payment information.</strong> When you donate — by bank transfer (EFT) or via PayFast — we record the amount, payment method, a reference code, and (for EFT) a proof-of-payment file you upload for admin verification. Card and instant-EFT payments made through PayFast are processed by PayFast directly; we do not see or store your card number.</p>
          <p><strong className="text-slate-800 dark:text-slate-100">Content you post.</strong> Needs, impact stories (including photos and videos you upload), and messages you send to other users (including any file attachments) are stored on the platform. Impact stories and published needs are publicly visible.</p>
          <p><strong className="text-slate-800 dark:text-slate-100">Usage and security information.</strong> We log sign-in timestamps and an approximate device/browser identifier and time zone, used only to help us detect suspicious account activity.</p>
        </Section>

        <Section title="3. How we use your information">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To create and administer your account, and to verify organizations before they can publish needs or receive donations.</li>
            <li>To process and track donations and gift-library pledges, including verifying proof-of-payment and forwarding confirmed funds to the relevant organization's registered bank account.</li>
            <li>To let givers, organizations, and administrators message one another about needs, donations, and fulfillments.</li>
            <li>To send account, verification, and donation-status notifications by email.</li>
            <li>To detect and prevent fraud, abuse, and violations of our Terms of Service.</li>
            <li>To maintain records required for financial and tax purposes (for example, an organization's tax-exemption status).</li>
            <li>To improve the platform and respond to support requests submitted through our contact form.</li>
          </ul>
        </Section>

        <Section title="4. Who we share information with">
          <p>We do not sell your personal information. We share it only:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-slate-800 dark:text-slate-100">With the other party to a transaction.</strong> An organization can see the name, email, phone, and account type of a giver who has expressed interest in a need or made a donation to it, so they can coordinate fulfillment.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Payment processing:</strong> PayFast (Pty) Ltd, for card and instant-EFT donations.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Email delivery:</strong> Brevo, to send account and notification emails.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Hosting and database infrastructure:</strong> Supabase, which stores platform data and enforces per-account access controls on our behalf.</li>
            <li><strong className="text-slate-800 dark:text-slate-100">Where required by law</strong>, such as in response to a valid legal request from a South African regulatory or law enforcement authority.</li>
          </ul>
        </Section>

        <Section title="5. How we protect your information">
          <p>
            Passwords are hashed and never stored in plain text. Access to platform data is restricted by row-level
            security policies, so an account can only read or change data it is authorized to see — for example, an
            organization cannot view another organization's banking details, and a giver cannot see donations they
            didn't make. Administrators can suspend an account suspected of abuse, which immediately blocks that
            account from creating, editing, or viewing most platform data until the suspension is lifted.
          </p>
        </Section>

        <Section title="6. Your rights">
          <p>Under POPIA, you have the right to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Access the personal information we hold about you.</li>
            <li>Correct inaccurate information — most account fields can be edited directly from your dashboard.</li>
            <li>Request deletion of your account. Givers and organizations can permanently delete their own account from Settings at any time (this requires re-entering your password and confirming the action). Records of past donations may be retained after deletion for financial and audit purposes, as described below.</li>
            <li>Object to or request that we restrict certain processing of your information.</li>
            <li>Lodge a complaint with the Information Regulator of South Africa if you believe we have mishandled your information.</li>
          </ul>
        </Section>

        <Section title="7. Data retention">
          <p>
            We keep your account information for as long as your account is active. If you delete your account,
            profile information is removed, but records of donations and financial transactions are retained for
            as long as required for accounting, audit, and legal purposes, since these form part of an
            organization's financial record.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            We use a single essential cookie set by our authentication provider (Supabase) to keep you signed in.
            We do not use third-party advertising or tracking cookies.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            HelpLift is intended for users aged 18 and older. We do not knowingly collect personal information from
            children.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy from time to time to reflect changes to the platform or applicable law. We'll
            update the effective date above when we do.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            Questions about this policy or your personal information? Reach us through the "Partner with us" contact
            form on our home page.
          </p>
        </Section>

        <p className="text-xs text-slate-400 pt-6 border-t border-slate-200 dark:border-slate-800">
          This policy is provided for general transparency about how HelpLift handles personal information and does
          not constitute legal advice.
        </p>
      </div>
    </main>
  )
}
