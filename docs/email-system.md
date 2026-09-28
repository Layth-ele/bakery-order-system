# Email System

Customer emails are sent through [Resend](https://resend.com). Cloud Functions send them, not the browser. Every email uses one branded template, and its branding comes from **Admin → System Settings**.

## What gets sent

| Email | When | Sent by |
|---|---|---|
| Order received | Customer places an order (`pending`) | `onOrderLifecycle` (automatic) |
| Order approved + amount due + how to pay | Admin approves (`approved`) | `onOrderLifecycle` (automatic) |
| Order not accepted (with reason) | Admin rejects (`rejected`) | `onOrderLifecycle` (automatic) |
| Order cancelled (with reason) | Order cancelled (`cancelled`) | `onOrderLifecycle` (automatic) |
| Payment received, in production | Admin confirms payment (`in_process`) | `onOrderLifecycle` (automatic) |
| Order complete, invoice ready | Order completed, manually or by the weekly auto-complete (`completed`) | `onOrderLifecycle` (automatic) |
| Payment reminder #N | Admin clicks **Send reminder** (Approved or Unpaid orders) | `sendPaymentReminderEmail` |
| Order updated | Admin edits an order with "notify customer" on | `sendOrderUpdatedEmail` |
| Reset your password | **Forgot password**, or admin sends a reset link | `sendPasswordResetEmail` |
| Test email | Admin → System Settings → **Send test email** | `sendTestEmail` |

The same `onOrderLifecycle` trigger also writes the in-app notifications for each of these events (see `src/functions/src/lib/orderLifecycle.ts` and `orderNotifications.ts`), so every order change produces exactly one notification and one email, whichever screen or function made it.

## Code map

```
src/functions/src/
  lib/emailLayout.ts    the design: header, footer, buttons, tables (pure, tested)
  lib/emailContent.ts   subject + copy for each email above (pure, tested)
  lib/mailer.ts         Resend call, /emailLog audit, /emailQuota rate limits, settings
  emails.ts             the email Cloud Functions listed above
  orderLifecycleTrigger.ts  onOrderLifecycle: order change → notifications + email
src/services/emailService.ts   client wrapper for the callables
src/components/admin/system-settings/EmailTestButton.tsx
```

Tests: `src/functions/src/lib/__tests__/emailTemplates.test.ts`, which runs with `npm test`.

To change wording, edit `emailContent.ts`. To change the look, edit `emailLayout.ts`.

## One-time setup

1. **Verify your domain in Resend:** go to https://resend.com/domains, add the bakery's domain, and add the DNS records it gives you (SPF, DKIM, and optionally DMARC). Wait until it shows *Verified*.
2. **Create an API key** in Resend (Sending access is enough).
3. **Store the key as a Firebase secret:**
   ```bash
   firebase functions:secrets:set RESEND_API_KEY
   ```
4. **Set the sender and app URL.** Copy `src/functions/.env.example` to `src/functions/.env` and fill in:
   ```
   EMAIL_FROM="Your Bakery <orders@yourdomain.com>"
   APP_URL="https://yourdomain.com"
   ```
   The `EMAIL_FROM` domain must be the one you verified in step 1.
5. **Deploy functions and rules:**
   ```bash
   firebase deploy --only functions,firestore:rules
   ```
6. **Fill in branding** under Admin → System Settings:
   - Business name, location, phone, and business number go in the email header and footer.
   - **Order Email** (or Business Email) is the Reply-To address, so customer replies reach you.
   - **Order CC Email** gets a hidden copy (BCC) of every order and reminder email.
   - **Email Logo URL** is optional and must be `https://`. A white or transparent PNG works best on the brown header.
   - **Payment methods** and **payment address** appear in approved and reminder emails.
7. Click **Send test email** in System Settings. It either delivers, or tells you which piece of setup is missing.

The secret is first created with the placeholder value `not-configured`, so the functions can deploy before Resend is set up. Only a real Resend key (it starts with `re_`) turns email on; replace the placeholder in step 3.

If email isn't configured (no real key or no sender), nothing breaks:
- Automatic emails are skipped and logged.
- Reminder and update actions tell the admin that no email went out, and reminder counters don't advance.
- Password reset falls back to Firebase's built-in sender.

## Safety features

- **No duplicate status emails.** Each order+status pair gets one `/emailLog/order_{orderId}_{status}` entry, so function retries skip anything already sent. Resend also receives an `Idempotency-Key`.
- **Audit log.** Every send is recorded in `/emailLog` with its state (`sent` / `failed` / `skipped`), error, recipient, and who triggered it. Admins can read it; nobody can write to it from the browser.
- **Rate limits** (`/emailQuota`):
  - Reminders: 1 per order per minute.
  - Order-updated: 5 per order per 10 minutes.
  - Test email: 5 per admin per 10 minutes.
  - Password reset: 3 per email and 10 per IP address per hour.
- **Password reset can't be used to probe for accounts.** The response and its timing are the same whether or not the address is registered, and the reset link always points at `APP_URL`, never at a URL the caller supplies.
- **Escaping.** Every customer-entered value (store name, notes, reasons) is HTML-escaped. Links only allow `https:`, `mailto:`, and `tel:`.
- **Deliverability.** Every email includes a plain-text version and a Reply-To header, and Resend tags each one by category for its dashboard.
- **Kill switch.** Admin → System Settings → **Send Order Status Emails** turns the automatic emails off. Reminders and the other manual emails still work.

## Troubleshooting

```bash
firebase functions:log --only onOrderLifecycle
firebase functions:log --only sendPaymentReminderEmail
```

| Log / message | Cause | Fix |
|---|---|---|
| `RESEND_API_KEY not set` | Secret missing | Run `firebase functions:secrets:set RESEND_API_KEY`, then redeploy functions |
| `EMAIL_FROM not set` | Sender missing | Set it in `src/functions/.env`, then redeploy |
| `Resend 403` … domain not verified | DNS not verified, or sender on a different domain | Verify the domain in Resend; make sure `EMAIL_FROM` uses it |
| `Resend 401` | Key revoked or wrong | Create a new key and set the secret again |
| `Resend 422` | Invalid address or sender format | Check `EMAIL_FROM` is `Name <addr@domain>` |
| `no customer email for order` | Order and customer profile have no email | Add an email to the customer's profile |
| Emails have no buttons | `APP_URL` not set | Set `APP_URL` and redeploy |
| Customer says they got nothing | Spam folder, or state isn't `sent` | Check `/emailLog`, then the Resend dashboard → Emails |
