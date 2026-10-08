/* eslint-disable react/no-unescaped-entities */
// Builds the HelpLift User Manual: public/helplift-user-manual.pdf, which
// everyone can download from Settings -> User manual.
//
// Edit the text below, then run (from the helplift-app folder):
//   npx tsx scripts/generate-user-manual.tsx
// and commit the updated PDF.
//
// Style rules for the text: no em or en dashes, and hyphens only where a word
// needs one. Body text is justified.

import fs from "node:fs"
import path from "node:path"
import React from "react"
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToFile } from "@react-pdf/renderer"

// Justified text without hyphenation: never break a word across lines.
Font.registerHyphenationCallback(word => [word])

type Block =
  | { p: string }
  | { list: string[] }
  | { steps: string[] }
  | { note: string }
  | { h: string }

type Chapter = { title: string; intro?: string; blocks: Block[] }

const BLUE = "#2563eb"
const INK = "#0f172a"
const BODY = "#334155"
const MUTED = "#64748b"

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, fontFamily: "Helvetica", color: BODY, lineHeight: 1.55 },
  header: { position: "absolute", top: 24, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED },
  chapterNumber: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLUE, letterSpacing: 1, marginBottom: 4 },
  chapterTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 10 },
  intro: { fontSize: 11.5, color: MUTED, textAlign: "justify", marginBottom: 14 },
  h: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, marginTop: 14, marginBottom: 6 },
  p: { textAlign: "justify", marginBottom: 8 },
  listItem: { flexDirection: "row", marginBottom: 4, paddingLeft: 6 },
  bullet: { width: 14, color: BLUE, fontFamily: "Helvetica-Bold" },
  itemText: { flex: 1, textAlign: "justify" },
  note: { backgroundColor: "#eff6ff", color: "#1e3a8a", padding: 10, borderRadius: 4, marginVertical: 8, textAlign: "justify" },
  coverPage: { padding: 0, fontFamily: "Helvetica" },
  cover: { flex: 1, backgroundColor: BLUE, paddingHorizontal: 64, paddingVertical: 96, justifyContent: "space-between" },
  coverLogo: { width: 72, height: 72, marginBottom: 28 },
  coverTitle: { fontSize: 38, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 10 },
  coverSub: { fontSize: 15, color: "#dbeafe", marginBottom: 6 },
  coverSmall: { fontSize: 10, color: "#bfdbfe", textAlign: "justify" },
  tocTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 18 },
  tocRow: { flexDirection: "row", marginBottom: 8 },
  tocNumber: { width: 28, fontFamily: "Helvetica-Bold", color: BLUE },
  tocText: { flex: 1, color: INK },
})

const chapters: Chapter[] = [
  {
    title: "Welcome to HelpLift",
    intro: "HelpLift connects verified organizations that have community needs with givers who want to help. This manual explains how to use every part of the platform.",
    blocks: [
      { p: "HelpLift is a South African giving platform. Verified organizations, such as schools, charities, non-profit organizations and community groups, post the needs they have. Individuals, businesses and groups help them by offering goods or services, by donating money, or by pledging gifts to the Gift Library. HelpLift administrators review activity on the platform so that everything you see can be trusted." },
      { h: "Who uses HelpLift" },
      { list: [
        "Givers: individuals, businesses or groups that give. Givers must be 18 or older.",
        "Organizations: schools, charities and community groups that receive support. An organization can have a team of people with different roles.",
        "Administrators: the HelpLift team, who verify organizations, review needs and payments, and keep the platform safe.",
      ] },
      { h: "How to use this manual" },
      { p: "Chapters 2 to 4 cover what everyone needs: creating an account, signing in and finding your way around. Chapter 5 is for givers and chapter 6 is for organizations. Later chapters explain settings, accessibility, safety and where to get help." },
      { note: "HelpLift is free to use. Organizations and givers never pay a fee to use the platform." },
    ],
  },
  {
    title: "Creating an account and signing in",
    blocks: [
      { h: "Registering" },
      { steps: [
        "Open the HelpLift website and choose Join the Platform, or go to the Register page.",
        "Choose I want to give to register as a giver, or I'm an organization to register an organization.",
        "Agree to the Terms of Service and the Privacy Policy. Givers also confirm that they are 18 or older.",
        "Fill in the form and choose a password. The checklist under the password shows the rules it must meet.",
        "Select Create Account. HelpLift sends a verification email to the address you entered.",
        "Open the email and select the link to verify your address. You can then sign in.",
      ] },
      { p: "Givers enter their name, email address, phone number, account type (individual, business or group) and, optionally, the categories and locations they care about. These preferences are used to recommend needs to you. You can also add a display picture." },
      { p: "Organizations enter the organization's name, registration number, type, address, province and city, a contact person, an email address and, optionally, a mission statement, banking details and a logo. Organizations can also attach verification documents such as a registration certificate, tax exemption certificate or proof of banking. Documents can be PDF, PNG or JPG files, up to 10 files of 10 MB each." },
      { note: "Pictures and logos can be PNG, JPG or WebP images of up to 2 MB. You can add or change them later from your dashboard." },
      { h: "Verifying your email with a code" },
      { p: "If your verification email contains a code, you can also enter it on the Verification page, together with your email address. This is useful when the link opens on a different device." },
      { h: "Signing in" },
      { list: [
        "Email and password: enter them on the Sign In page.",
        "Google, LinkedIn or Microsoft: once you have registered, you can sign in with one of these accounts if it uses the same email address. They cannot be used to create a new account.",
        "Passkey: sign in with your fingerprint, face or device PIN. Add a passkey first in Settings while you are signed in.",
      ] },
      { h: "Two-factor sign-in" },
      { p: "If you turn on two-factor sign-in in Settings, HelpLift emails you a code each time you sign in with your password. Enter the code to finish signing in. You can ask for a new code if it does not arrive." },
      { h: "Locked account" },
      { p: "After five wrong password attempts your account is locked to protect it. HelpLift emails you an unlock code. Enter the code to unlock the account, then sign in again." },
      { h: "Forgotten password" },
      { p: "Select Forgot password on the Sign In page and enter your email address. Follow the link in the email to choose a new password." },
      { h: "Organization verification" },
      { p: "A new organization is reviewed by an administrator before it can use the platform. Until then, signing in shows the Pending Verification page with the current status: pending, approved, rejected or more information requested. If more information is requested, the organization's owner can upload extra documents on that page and submit them for review." },
    ],
  },
  {
    title: "Finding your way around",
    blocks: [
      { h: "The homepage" },
      { list: [
        "Platform numbers: verified organizations, givers, open and fulfilled needs, money donated and impact stories.",
        "How it works: a short overview of the Gift Library, verification, dashboards and matching.",
        "Urgent needs: a few community requests that need support now.",
        "Needs map: every pin is an open need. Select a pin to see the need on the Needs board.",
        "Live activity: recent, anonymous activity on the platform.",
        "Spotlight: the Giver of the Month and the Organization of the Month.",
        "Impact stories: real results shared by organizations. Use the arrows to move between stories, or select Read full story.",
        "Questions and contact: frequently asked questions, a search box, and a contact form.",
      ] },
      { p: "On a phone, the menu button at the top right opens the page links and the Sign In or Register buttons." },
      { h: "The Needs board" },
      { p: "The Needs board lists open needs from verified organizations. You can search by keyword, filter by category, urgency or location, and sort the results. Turn on Needs near me to see needs close to you. Each need shows its organization, category, location, quantity, due date and urgency. You can listen to a need being read aloud, share it, or show its QR code. Select Support this Need to offer help or donate." },
      { h: "Organizations" },
      { p: "The Organizations directory lists verified organizations. Filter by province or by organizations near you, and sort by open needs or newest. An organization's public profile shows its details, mission, open needs and impact stories. Signed-in users can send the organization a message." },
      { h: "The Gift Library" },
      { p: "The Gift Library lists goods, services and funds that givers have pledged before a specific need exists. Organizations can claim offerings that would help them. Each offering is approved by an administrator before it appears." },
      { h: "Developers page" },
      { p: "The Developers page explains how HelpLift is built and has a form for reporting a bug, suggesting an improvement or reporting a security issue. Reports can be anonymous. Leave a contact email if you would like a reply." },
    ],
  },
  {
    title: "Your dashboard",
    intro: "Givers, organizations and administrators each have a dashboard. The parts described in this chapter are the same on all of them.",
    blocks: [
      { h: "The top of the dashboard" },
      { list: [
        "Greeting and clock: a greeting for the time of day, with the time and date. The clock can be turned off in Settings.",
        "Refresh: loads the latest information without losing your filters.",
        "Home: returns to the HelpLift homepage.",
        "Theme: switches between light, dark, high contrast and grayscale.",
        "Notifications (the bell): opens the Notifications window.",
        "Badges, Feedback, Settings and Sign out, plus buttons that depend on your role.",
      ] },
      { p: "On a phone, the buttons at the top sit in one row that you can swipe sideways, and the numbers below them form a strip you can swipe as well." },
      { h: "Tabs" },
      { p: "Each dashboard is divided into tabs, such as Needs, Messages and Analytics. Select a tab to open it. On a phone you can swipe the row of tabs sideways." },
      { h: "Notifications" },
      { p: "The Notifications window lists new messages, offers, donations, approvals and announcements. Unread items are highlighted. Switch between All and Unread, select a notification to open it, or select Mark all as read. Notifications are also emailed to you unless you turn email notifications off in Settings." },
      { p: "You are also told when a need changes. Organizations are notified when an administrator approves, rejects, reopens, marks fulfilled or removes one of their needs, and when a need closes after its due date. Givers who offered to help with a need, or donated to it, are notified when it is fulfilled, closed or removed. Administrators are notified when an organization closes a need, marks it fulfilled or asks to reopen it." },
      { h: "Messages" },
      { p: "The Messages tab holds your conversations with givers, organizations and the HelpLift team. Open a message to read it and reply. You can attach files and switch between your inbox and sent messages. Coordinators can message givers the organization works with and the HelpLift team, and reply to anyone, but only owners and managers can message other organizations." },
      { h: "Windows" },
      { p: "Many actions open in a window. The button next to the close button maximizes a window to fill the screen, and selecting it again restores the normal size. When one window was opened from another, a Back link at the top returns you to the first one." },
      { h: "Badges" },
      { p: "Badges celebrate milestones, such as your first donation or a number of needs fulfilled. The Badges window shows the badges you have earned, your progress towards the next one, and leaderboards of top givers and organizations. You can share a badge you have earned." },
      { h: "Feedback and Support The Platform" },
      { p: "Feedback lets you rate HelpLift and suggest improvements. Support The Platform lets you make a donation to HelpLift itself, which keeps the platform free. These donations do not go to any organization." },
      { h: "The welcome tour" },
      { p: "The first time you open your dashboard, a short tour points out the most important parts. You can skip it at any time." },
    ],
  },
  {
    title: "For givers",
    blocks: [
      { h: "Finding needs" },
      { p: "The Browse Needs tab recommends needs that match the categories and locations you chose. You can also switch on needs near you, or open the full Needs board." },
      { h: "Offering to help" },
      { steps: [
        "Open a need and select Support this Need.",
        "Choose Submit Expression of Interest and write a short message to the organization.",
        "The organization accepts or declines your offer. You are notified either way.",
        "Track your offers in the My Interests tab.",
      ] },
      { p: "When an offer is accepted it becomes a fulfillment. The Fulfillments tab shows each delivery from in progress to completed, including any proof photos the organization uploads." },
      { h: "Donating money" },
      { p: "You can donate to a specific need, to an organization, or to HelpLift itself. Choose how to pay:" },
      { list: [
        "EFT (bank transfer): transfer the money to the bank account shown, then upload your proof of payment. An administrator confirms the donation.",
        "PayFast: pay by card or instant EFT. The donation is confirmed automatically.",
        "PayPal: the option for international payments. PayPal charges in US dollars, converted from the Rand amount at the day's exchange rate. The donation is confirmed automatically.",
      ] },
      { p: "The smallest and largest amounts you can donate are shown in the form. When a donation is confirmed, a PDF receipt is emailed to you. The My Donations tab shows every donation with its status, your proof of payment and your receipts, and lets you add more proof." },
      { h: "Pledging to the Gift Library" },
      { steps: [
        "Open the Gift Library tab and select Pledge an Offering.",
        "Describe what you are offering: goods, a service or funds, with the quantity or value, your location and any conditions.",
        "Or select Snap to pledge and take or choose a photo of the items. The photo is analysed by AI and the form is filled in for you to check.",
        "Submit the pledge. It appears in the Gift Library once an administrator approves it.",
      ] },
      { p: "When an organization claims your offering and the claim is approved, you are notified and the delivery is tracked under Fulfillments." },
      { p: "If you set an expiry date, the offering is listed up to and including that date. After it, the offering comes off the Gift Library, can no longer be claimed, and you are notified. You can pledge it again at any time. Money never expires: donations and financial pledges have no expiry date." },
      { h: "Your profile" },
      { p: "Select your profile picture to upload a new one or remove it. Use Settings to edit your details. If you are chosen as Giver of the Month, your name and picture appear on the homepage. You can opt out of this in Settings." },
      { h: "Analytics" },
      { p: "The Analytics tab charts your giving over time. Charts can be exported." },
    ],
  },
  {
    title: "For organizations",
    blocks: [
      { h: "Team roles" },
      { list: [
        "Owner: full access, including the team, the organization's profile, banking details and withdrawals.",
        "Manager: creates, edits and closes needs, accepts or declines offers, claims from the Gift Library, handles deliveries, impact stories and messages, and can see donations and the wallet.",
        "Coordinator: handles the day-to-day work with givers. Updates deliveries and uploads proof, sends and replies to messages, and creates and edits impact stories, which an administrator still approves. Coordinators can see needs and offers but cannot change them, and never see donations, the wallet or banking details.",
      ] },
      { p: "Owners invite teammates by email from the Team tab and choose their role." },
      { h: "Posting a need" },
      { steps: [
        "Open the Needs tab and fill in the Create a need form: title, description, category, location, quantity, due date and urgency.",
        "To save time, select Let Lifty write it, describe the need in a sentence (typed or spoken), and select Write it for me. Check and edit everything before you submit.",
        "Add attachments or images if they help.",
        "Submit the need. An administrator reviews it before it is published.",
      ] },
      { p: "HelpLift warns you if a new need looks like one you have already posted. A need can be edited while it is active, but not once it is fulfilled or closed. You can mark a need as fulfilled or close it. To reopen a closed need, request a reopen with a reason, and an administrator decides." },
      { h: "Due dates" },
      { p: "A need stays on the Needs board up to and including its due date. From the next day it is no longer listed and cannot receive offers or donations. If the need is still open, it is closed automatically and you are notified. To carry on, request a reopen and choose a new due date. Needs that are already in progress are not closed, so deliveries under way can finish. Donations you have already received are not affected." },
      { h: "Offers and deliveries" },
      { p: "Offers from givers appear in the Interests tab, where you accept or decline them. Accepted offers and approved Gift Library claims become fulfillments. In the Fulfillments tab, track each delivery and upload proof, such as photos, receipts or documents, once items arrive. The giver is notified." },
      { h: "Donations and the wallet" },
      { p: "The Donations tab lists donations received. The Wallet tab shows your available balance and withdrawal history. Only the owner can add banking details and request a withdrawal. Each withdrawal is reviewed by an administrator, within the limits shown, and proof of payment is attached once the money is paid." },
      { h: "Impact stories" },
      { p: "Share what your organization has achieved in the Impact Stories tab, with photos or videos. Stories are published on your public profile and on the homepage after an administrator approves them, and they can be shared." },
      { h: "Claiming from the Gift Library" },
      { p: "In the Gift Library tab, browse offerings from givers and select Claim Offering for those that would help you. You can have one pending claim per offering. An administrator approves one claim per offering." },
      { h: "Profile, documents and sharing" },
      { p: "The buttons at the top of your dashboard open your Public Profile, your verification documents and a QR code for your profile that you can share or print. Verified organizations can download a compliance certificate as proof of verification for funders and partners." },
      { h: "Analytics" },
      { p: "The Analytics tab shows your needs, donations and engagement. Charts can be exported as CSV files or images." },
    ],
  },
  {
    title: "For administrators",
    intro: "Administrator accounts are created by invitation only. This chapter summarizes the administrator dashboard.",
    blocks: [
      { list: [
        "Users: verify new organizations and their documents, view givers and administrators, edit account details, suspend accounts and invite administrators.",
        "Needs, Gift Library, Donations, Fulfillments and Withdrawals: review and approve activity, confirm EFT donations and attach proof of payouts.",
        "Stories: approve impact stories before they are published.",
        "Messages, Feedback and Dev reports: answer users, read ratings and handle reports sent from the Developers page.",
        "Inquiries: anonymous tip-offs about organizations, with evidence, an investigation status and private notes, and messages sent with the homepage contact form.",
        "Live activity and Security: see who is online, what signed-in users are doing, and every sign-in attempt.",
        "Reports: totals, site visits and charts, with exports.",
        "Announcements: send messages in-app and by email, or as a login page banner or homepage notice.",
        "Platform settings: maintenance mode, HelpLift's bank accounts, need categories, donation and withdrawal limits, and badge thresholds.",
      ] },
      { note: "Financial records such as donations and withdrawals can never be deleted, and administrators cannot change an organization's banking details." },
    ],
  },
  {
    title: "Settings",
    intro: "Open Settings from the gear button at the top of your dashboard.",
    blocks: [
      { list: [
        "Edit profile: your details, contact information, login email and password.",
        "Passkeys: add or remove passkeys for signing in with your fingerprint, face or device PIN.",
        "Two-factor sign-in: an emailed code each time you sign in with your password.",
        "Notification sounds: turn them on or off and choose a sound.",
        "Email notifications: when off, notifications still appear in HelpLift but are not emailed. Account emails, such as verification and password reset, are always sent.",
        "Lifty: turn the assistant on or off.",
        "Clock and date: show or hide the clock on your dashboard.",
        "Click sounds: soft sounds when you select buttons, tabs and switches.",
        "Reduce motion: turns off animations.",
        "Font size: makes text larger across the site.",
        "Giver of the Month (givers): opt in or out of being featured.",
        "User manual: download this manual.",
        "Delete account: permanently deletes your account. This cannot be undone.",
      ] },
      { p: "Font size, Lifty, clock, click sounds and reduce motion are saved on the device you are using. The theme is changed with the theme button at the top of the page." },
    ],
  },
  {
    title: "Lifty, your assistant",
    blocks: [
      { p: "Lifty is HelpLift's AI assistant. Select the chat button in the corner of any page to open it. Ask how anything on HelpLift works, or ask about open needs, organizations, gift offerings and impact stories." },
      { list: [
        "Type a question, or select the microphone to speak it.",
        "Select the speaker button on a reply to hear it read aloud.",
        "Select the headphones to start a hands-free voice chat. Lifty listens, answers out loud, then listens again.",
        "Hide Lifty with the eye button, or turn it off and on again in Settings.",
      ] },
      { p: "Lifty can only see public information. It cannot see your donations, messages or account details, and it will never ask for your password or banking details." },
    ],
  },
  {
    title: "Accessibility",
    blocks: [
      { list: [
        "Themes: light, dark, high contrast and grayscale.",
        "Font size: larger text across the site.",
        "Speech to text: a microphone button on text boxes lets you speak instead of typing.",
        "Read aloud: listen to needs, gift offerings, stories, announcements and Lifty's replies.",
        "Grammar check: checks longer text before you submit it.",
        "Reduce motion and click sounds, in Settings.",
        "Install HelpLift as an app on your phone or computer from your browser's menu. HelpLift shows when you are offline.",
        "Tooltips: hover over or focus on a button to see what it does.",
      ] },
    ],
  },
  {
    title: "Safety and privacy",
    blocks: [
      { h: "HelpLift will never ask you to pay" },
      { list: [
        "No fees: you never pay a fee to receive a donation, claim a gift, verify your account or unlock funds.",
        "No passwords or codes: HelpLift never asks for your password, PIN or a one-time code.",
        "No side payments: every payment happens through HelpLift's own donation flow, never by a bank transfer to an individual, a WhatsApp payment or a processing fee.",
      ] },
      { p: "If anyone claiming to be from HelpLift asks you to pay upfront or share your login details, it is a scam. Report it using the contact form on the homepage with the topic Report a scam or safety concern." },
      { h: "Anonymous tip-offs" },
      { p: "If you suspect a registered organization of fraud, misuse of donations, abuse, corruption or any other illegal or suspicious activity, select Anonymous tip-off in the safety section of the homepage." },
      { steps: [
        "Start typing the organization's name and pick it from the list, or type the name in full.",
        "Choose what the concern is about and describe what happened, with as much detail as you safely can.",
        "Optionally, say when it happened and attach evidence such as photos, documents or videos.",
        "Leave a contact email only if you are happy for the HelpLift team to follow up, then send the tip-off.",
      ] },
      { p: "Tip-offs are anonymous. HelpLift does not save your name, account, IP address or device, and the organization is never told that it was reported or by whom. The HelpLift team investigates every tip-off. If someone is in immediate danger, contact the police on 10111 first." },
      { h: "Your privacy" },
      { p: "HelpLift follows the Protection of Personal Information Act (POPIA). Public profiles never show donations or donors, and your contact details are not shared. HelpLift records sign-ins and activity on the platform for security, and keeps these records for a limited time. Read the Privacy Policy on the website for full details." },
      { h: "Keeping your account secure" },
      { list: [
        "Use a strong password and do not share it.",
        "Turn on two-factor sign-in, or add a passkey.",
        "Sign out on shared devices.",
      ] },
    ],
  },
  {
    title: "Getting help",
    blocks: [
      { list: [
        "Ask Lifty: the chat button in the corner of every page.",
        "Frequently asked questions: on the homepage, with a search box and a full list.",
        "Anonymous tip-off: on the homepage, to report a registered organization for illegal or suspicious activity.",
        "Contact form: on the homepage. Choose a topic so your message reaches the right person.",
        "Message Admin: on your dashboard, to message the HelpLift team.",
        "Developers page: report a bug or suggest an improvement.",
        "Feedback: rate HelpLift from your dashboard.",
      ] },
      { note: "Email: helplift_platform@yahoo.com" },
    ],
  },
]

function BlockView({ block }: { block: Block }) {
  if ("h" in block) return <Text style={styles.h}>{block.h}</Text>
  if ("p" in block) return <Text style={styles.p}>{block.p}</Text>
  if ("note" in block) return <Text style={styles.note}>{block.note}</Text>
  const numbered = "steps" in block
  const items = numbered ? block.steps : block.list
  return (
    <View style={{ marginBottom: 8 }}>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem} wrap={false}>
          <Text style={styles.bullet}>{numbered ? `${index + 1}.` : "•"}</Text>
          <Text style={styles.itemText}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

function Manual() {
  const logo = { data: fs.readFileSync(path.join(process.cwd(), "public", "logo.png")), format: "png" as const }
  const year = new Date().getFullYear()
  return (
    <Document title="HelpLift User Manual" author="HelpLift" subject="How to use HelpLift">
      <Page size="A4" style={styles.coverPage}>
        <View style={styles.cover}>
          <View>
            <Image src={logo} style={styles.coverLogo} />
            <Text style={styles.coverTitle}>HelpLift</Text>
            <Text style={styles.coverSub}>User Manual</Text>
            <Text style={styles.coverSub}>Giving made transparent. Impact made real.</Text>
          </View>
          <Text style={styles.coverSmall}>
            A guide for givers, organizations and administrators. For quick answers at any time, ask Lifty, the assistant in the corner of every HelpLift page. Version {year}.
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.tocTitle}>Contents</Text>
        {chapters.map((chapter, index) => (
          <View key={chapter.title} style={styles.tocRow}>
            <Text style={styles.tocNumber}>{index + 1}</Text>
            <Text style={styles.tocText}>{chapter.title}</Text>
          </View>
        ))}
      </Page>

      {chapters.map((chapter, index) => (
        <Page key={chapter.title} size="A4" style={styles.page} wrap>
          <View style={styles.header} fixed>
            <Text>HelpLift User Manual</Text>
            <Text>{chapter.title}</Text>
          </View>
          <Text style={styles.chapterNumber}>CHAPTER {index + 1}</Text>
          <Text style={styles.chapterTitle}>{chapter.title}</Text>
          {chapter.intro && <Text style={styles.intro}>{chapter.intro}</Text>}
          {chapter.blocks.map((block, blockIndex) => <BlockView key={blockIndex} block={block} />)}
          <View style={styles.footer} fixed>
            <Text>helplift.vercel.app</Text>
            <Text render={({ pageNumber }) => `Page ${pageNumber}`} />
          </View>
        </Page>
      ))}
    </Document>
  )
}

const out = path.join(process.cwd(), "public", "helplift-user-manual.pdf")
renderToFile(<Manual />, out).then(() => console.log("Wrote", out))
