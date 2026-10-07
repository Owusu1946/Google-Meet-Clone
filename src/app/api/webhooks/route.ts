import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { stream } from '@/lib/server/stream';

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook is not configured.' }, { status: 503 });
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return Response.json({ error: 'Missing signature.' }, { status: 400 });
  let event: WebhookEvent;
  try { event = new Webhook(secret).verify(await request.text(), { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature }) as WebhookEvent; }
  catch { return Response.json({ error: 'Invalid signature.' }, { status: 400 }); }
  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const user = event.data;
      await stream().upsertUsers([{ id: user.id, name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Participant', image: user.has_image ? user.image_url : undefined }]);
    } else if (event.type === 'user.deleted' && event.data.id) {
      await stream().updateUsersPartial({ users: [{ id: event.data.id, set: { name: 'Deleted user', image: '' } }] });
    }
    return Response.json({ success: true });
  } catch { return Response.json({ error: 'Profile synchronization failed. Retry delivery.' }, { status: 503 }); }
}
