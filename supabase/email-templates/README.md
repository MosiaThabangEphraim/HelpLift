# Supabase Email Templates

## Troubleshooting: "the reset link isn't clickable, it's just a sentence"

The app itself does not send this email or control its HTML — `api/password-change/route.ts`
only calls `supabase.auth.resetPasswordForEmail()`; Supabase's Auth service
generates and sends the actual email using whichever template is currently
configured for the project. This means the fix always lives in the Supabase
Dashboard or your SMTP provider's settings, never in this codebase.

### If your live template still has no `<a href>` at all
Apply the template in Step 3 below, pasting into the Dashboard's raw HTML
editor (there is no separate WYSIWYG mode in the current Supabase dashboard,
but older versions had one that escaped `<a href="...">` into visible text —
if you're on an older project, make sure you're in the HTML/source box).

### If your live template already has a valid `<a href="{{ .ConfirmationURL }}">` and it's STILL not clickable
This is the more unusual case — a template like this is already enough to
render a real link in virtually every email client:
```html
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
```
If that's what's configured and the received email still shows plain,
non-linked text, the template isn't the problem anymore — something between
Supabase and your inbox is stripping the HTML down to plain text. To find out
which:

1. **View the raw source of the actual received email**, not just how your
   mail app renders it — Gmail: open the email → ⋮ menu → "Show original";
   Outlook: File → Properties → "Internet headers", or the "..." → "View
   message source" in Outlook on the web. Look for a `Content-Type:
   multipart/alternative` (or `text/html`) part, and check whether the
   `<a href="...">` tag is literally present in it, or whether you only see a
   `text/plain` part (or the tag rendered as escaped `&lt;a href...&gt;` text).
2. **If there's no HTML part at all** (plain text only): your SMTP provider or
   its plan/settings is converting the message to plain text before delivery.
   Check the provider's dashboard/activity log for the reset email and see how
   it was actually sent. As a quick isolation test, temporarily switch back to
   Supabase's **default built-in SMTP** (Dashboard → Project Settings → Auth →
   turn off "Enable Custom SMTP") and trigger another reset email — if the
   link is clickable with Supabase's own SMTP, the problem is specific to your
   custom SMTP provider/relay, not the template or this app.
3. **Allow-list the redirect URL.** Go to
   `Authentication > URL Configuration` in the Supabase Dashboard and add your
   app's reset-password URL (e.g. `http://localhost:3000/reset-password` for
   local dev, and your production domain's `/reset-password` once deployed) to
   **Redirect URLs**. This affects whether the link *works* when clicked, not
   whether it renders as clickable, but it's worth confirming while you're in
   there.

## Step 1 - Navigate to your Supabase dashboard:
1. Go to https://supabase.com/dashboard/project/_/auth/email-templates
   (replace the project ID in the URL)
2. Select the "Reset Password" template tab.

## Step 2 - Subject (copy-paste:
```
Reset Your HelpLift Password
```

## Step 3 - HTML body (copy-paste ENTIRE block below into the HTML editor, replacing the existing content):
```html
<h2 style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; font-weight: 800; font-size: 24px; line-height: 1.2; margin: 0 0 8px 0;">
  Reset your HelpLift password
</h2>
<p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #334155; font-size: 15px; line-height: 1.5; margin: 0 0 24px 0;">
  Hi there,
  <br />
  We received a request to reset the password for your HelpLift account. Click the button below to choose a new password. This link is valid for 1 hour.
</p>
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
  <tr>
    <td align="center">
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;text-decoration:none;color:#ffffff;background-color:#2563eb;border:1px solid #1d4ed8;border-radius:9999px;padding:14px 32px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:700;font-size:15px;line-height:1;">
        Reset Your Password
      </a>
    </td>
  </tr>
</table>
<p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #475569; font-size: 13px; line-height: 1.5; margin: 0 0 24px 0;">
  If the button above doesn't work, copy and paste this link into your browser:
  <br />
  <a href="{{ .ConfirmationURL }}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">
    {{ .ConfirmationURL }}
  </a>
</p>
<p style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
  If you didn't request a password reset, you can safely ignore this email — your password will not change.
  <br />
  The HelpLift Team
</p>
```

## Step 4 - Save the template (click the blue "Save" button at the bottom.
```
