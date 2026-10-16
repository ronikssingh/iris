# Setting up the online side of Iris

You only do this once. It takes about five minutes.

## 1. Create the tables

1. Open your project on [supabase.com](https://supabase.com) and choose **SQL Editor** in the left sidebar.
2. Click **New query**, paste everything in [`setup.sql`](setup.sql), and click **Run**.
3. You should see "Success. No rows returned". Running it again later is harmless, and it's how you upgrade: Iris 1.2 adds Up Next and Discover sync, so run it again if you set things up for 1.1.

## 2. Confirmation emails

Supabase's built-in email service only sends to the people on your Supabase team, so your friends wouldn't get their confirmation emails. Pick one of these:

**Option A, send email through Gmail (keeps confirmation emails on):**

1. Turn on 2-Step Verification for your Google account, then create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
2. In Supabase, go to **Authentication → Emails → SMTP Settings** and turn on **Enable custom SMTP**.
3. Fill in: Sender email = your Gmail address, Sender name = `Iris`, Host = `smtp.gmail.com`, Port = `465`, Username = your Gmail address, Password = the app password. Save.

**Option B, skip confirmation emails:** go to **Authentication → Sign In / Providers → Email** and turn off **Confirm email**. People can sign up and start straight away.

## 3. Make the emails show a code (optional but nicer)

Iris lets people type the code from their email instead of clicking a link. In **Authentication → Emails → Templates**:

- **Confirm signup:** add the line `Your Iris code is {{ .Token }}`
- **Reset password:** add the line `Your Iris code is {{ .Token }}`

Then set **Authentication → URL Configuration → Site URL** to `https://github.com/ronikssingh/iris`, so a clicked link lands somewhere sensible.
