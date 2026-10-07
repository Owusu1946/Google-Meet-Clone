export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, 'Request origin is not allowed.');
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length') || 0) > 32_000) throw new HttpError(413, 'Request is too large.');
  const text = await request.text();
  if (text.length > 32_000) throw new HttpError(413, 'Request is too large.');
  try {
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new HttpError(400, 'Invalid request.'); }
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  const serviceError = error as { status?: number; metadata?: { responseCode?: number } };
  const status = serviceError?.status || serviceError?.metadata?.responseCode;
  if (status === 404) return Response.json({ error: 'This meeting does not exist. Check the code or ask the host for a new link.' }, { status: 404 });
  console.error('Meeting service request failed', error instanceof Error ? error.name : 'UnknownError');
  return Response.json({ error: 'The meeting service is unavailable. Please try again.' }, { status: 503 });
}
export function json(data: unknown) { return Response.json(data, { headers: { 'Cache-Control': 'no-store' } }); }
