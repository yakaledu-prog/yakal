import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Initialize services (keys are loaded via dotenv in local-api.ts)
  const resend = new Resend(process.env.RESEND_API_KEY);
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { firstName, lastName, email, phone, subject, message } = req.body;

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
      subject: `New Contact Form Submission: ${subject || 'No Subject'}`,
      html: `
        <h2>New Contact Form Message</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
        <br/>
        <h3>Message:</h3>
        <p style="white-space: pre-wrap;">${message}</p>
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
