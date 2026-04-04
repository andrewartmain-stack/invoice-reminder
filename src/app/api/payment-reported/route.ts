import { createClient } from '@supabase/supabase-js';
import { buildThankYouPage } from '@/lib/build-thank-you-page';
import { resolveThankYouPage } from '@/types/thank-you-page';
import { resolveDesign } from '@/types/email-design';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const invoice_id = searchParams.get('invoice_id');

  if (!invoice_id) {
    return new Response('Invalid link.', { status: 400 });
  }

  // Try to update status (only if not already confirmed/paid/cancelled)
  const { data: updated, error } = await supabase
    .from('invoices')
    .update({ status: 'payment_reported' })
    .eq('id', invoice_id)
    .in('status', ['pending', 'notified', 'payment_reported'])
    .select('user_id, client_name, invoice_number')
    .single();

  if (error && error.code !== 'PGRST116') {
    return new Response('Something went wrong.', { status: 500 });
  }

  // If already paid/cancelled, still fetch invoice for the page render
  const invoiceData = updated ?? await supabase
    .from('invoices')
    .select('user_id, client_name, invoice_number')
    .eq('id', invoice_id)
    .single()
    .then(r => r.data);

  // Broadcast to the owner's app on every click (fires sound + notification regardless of status)
  if (invoiceData?.user_id) {
    const broadcastUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
    fetch(broadcastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        messages: [{
          topic: 'realtime:payment-events',
          event: 'payment_reported',
          payload: {
            invoice_id: invoice_id,
            user_id: invoiceData.user_id,
            client_name: invoiceData.client_name,
            invoice_number: invoiceData.invoice_number,
          },
        }],
      }),
    }).catch(() => {}); // best-effort, don't block the response
  }

  // Fetch profile customisation (always fresh — never use cached version)
  let pageConfig = resolveThankYouPage(null);
  let logoUrl: string | null = null;

  if (invoiceData?.user_id) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('thank_you_page, email_design, sender_name')
      .eq('id', invoiceData.user_id)
      .single();

    if (profileError) {
      console.error('[payment-reported] profile fetch error:', profileError.code, profileError.message);
    }

    console.log('[payment-reported] user_id:', invoiceData.user_id, '| profile found:', !!profile, '| thank_you_page:', profile?.thank_you_page);

    if (profile) {
      // thank_you_page is a JSONB column; guard against it being returned as a JSON string
      let raw = profile.thank_you_page as Record<string, unknown> | null;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw) } catch { raw = null }
      }
      pageConfig = resolveThankYouPage(raw as Partial<import('@/types/thank-you-page').ThankYouPage> | null);
      const design = resolveDesign(profile.email_design as Partial<import('@/types/email-design').EmailDesign> | null);
      logoUrl = design.logo_url || null;
    }
  } else {
    console.error('[payment-reported] invoiceData missing or no user_id:', invoiceData);
  }

  const html = buildThankYouPage(pageConfig, logoUrl);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
