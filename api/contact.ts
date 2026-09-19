import { Resend } from 'resend';
import { getServiceClient } from './_utils/supabase.js';
import { escapeHtml } from './_utils/email.js';

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize services (keys are loaded via dotenv in local-api.ts)
  const resend = new Resend(process.env.RESEND_API_KEY);
  // The service client, not the anon key. The inbox holds visitors' names,
  // emails and phone numbers, so the browser roles can no longer insert into
  // it or read it; this endpoint is the only way in, and admins the only
  // readers.
  const supabase = getServiceClient();

  try {
    const { firstName, lastName, email, phone, subject, message } = req.body ?? {};
    if (!email || !message) {
      return res.status(400).json({ error: 'An email address and a message are required.' });
    }
    // Everything below lands in an HTML email to Yakal's own inbox. Unescaped,
    // a visitor could put a link or a fake form in front of whoever reads it.
    const e = (v: unknown) => escapeHtml(String(v ?? ''));

    // 1. Insert into Supabase `contact_messages` table for Admin Dashboard notifications
    const { error: dbError } = await supabase
      .from('contact_messages')
      .insert([
        {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          subject,
          message,
        }
      ]);

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      // We log it but don't strictly fail the request if we still want to send the email
      // However, it's usually best to fail early if DB is critical
      // throw new Error(`Database error: ${dbError.message}`);
    }

    // 2. Send Email via Resend
    // The settings row first, so an admin can redirect the form on their own
    // page, then the environment variable it used to be.
    const { data: setting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'contact_form_email')
      .maybeSingle();

    const destinationEmail =
      (setting?.value ?? '').trim() || process.env.VITE_CONTACT_DESTINATION_EMAIL;

    if (!destinationEmail) {
      throw new Error('No contact form inbox is set, in settings or the environment.');
    }

    const { error: emailError } = await resend.emails.send({
      from: 'Yakal Contact Form <onboarding@resend.dev>', // resend.dev is the default for free testing
      to: [destinationEmail],
      subject: `New Contact Form Submission: ${String(subject || 'No Subject').replace(/[\r\n]+/g, ' ')}`,
      html: `
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${e(firstName)} ${e(lastName)}</p>
        <p><strong>Email:</strong> ${e(email)}</p>
        <p><strong>Phone:</strong> ${e(phone || 'N/A')}</p>
        <p><strong>Subject:</strong> ${e(subject || 'N/A')}</p>
        <br/>
        <h3>Message:</h3>
        <p style="white-space: pre-wrap;">${e(message)}</p>
      `,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      throw new Error(`Email delivery error: ${emailError.message}`);
    }

    return res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error: any) {
    console.error('Contact API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
