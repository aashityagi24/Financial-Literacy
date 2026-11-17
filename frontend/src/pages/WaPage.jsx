/**
 * /wa and /wa/:content — WhatsApp short-link redirect.
 *
 * Immediately redirects to the homepage with UTM parameters so the visit is
 * attributed to the WhatsApp chat campaign.
 *
 * /wa            → /?utm_source=whatsapp&utm_medium=chat&utm_campaign=ctwa
 * /wa/ladder     → /?...&utm_content=ladder
 * /wa/anything   → /?...&utm_content=anything
 */
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function WaPage() {
  const navigate = useNavigate();
  const { content } = useParams();

  useEffect(() => {
    const params = new URLSearchParams({
      utm_source: 'whatsapp',
      utm_medium: 'chat',
      utm_campaign: 'ctwa',
    });
    if (content) params.set('utm_content', content);
    // Replace history so the user can't "back" into /wa
    navigate(`/?${params.toString()}`, { replace: true });
  }, [navigate, content]);

  return null;
}
