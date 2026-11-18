/** Only known browser push services may receive requests from the privileged worker. */
export function validPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host.endsWith('.push.services.mozilla.com') || host === 'web.push.apple.com'
      || host.endsWith('.notify.windows.com');
  } catch { return false; }
}

/** Keep the privileged request policy in the same tested boundary as destination validation. */
export async function sendPushRequest(
  request: { endpoint:string; method:string; headers:HeadersInit; body?:BodyInit|null },
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (!validPushEndpoint(request.endpoint)) throw new Error('Unsupported push destination');
  const response = await fetcher(request.endpoint, {
    method:request.method, headers:request.headers, body:request.body,
    redirect:'error', signal:AbortSignal.timeout(10000),
  });
  if (response.redirected || (response.status >= 300 && response.status < 400)) throw new Error('Push redirects are forbidden');
  return response;
}
