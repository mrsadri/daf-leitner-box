/** Isolate only date-rejected events; never discard valid neighbours in a failed atomic insert. */
export interface ReviewWriteError { code?: string; message: string }
export async function sendReviewBatch<T>(
  events: T[], send: (events: T[]) => Promise<ReviewWriteError | null>,
  reject: (event: T) => void, acknowledge: (events: T[]) => void = () => {},
): Promise<void> {
  if (!events.length) return;
  const error = await send(events);
  if (!error) { acknowledge(events); return; }
  // Legacy database trigger uses P0001. Other failures must remain retryable.
  if (error.code !== 'P0001' || !/^review_day .* is out of range$/.test(error.message)) throw error;
  if (events.length === 1) { reject(events[0]); acknowledge(events); return; }
  const middle = Math.floor(events.length / 2);
  await sendReviewBatch(events.slice(0, middle), send, reject, acknowledge);
  await sendReviewBatch(events.slice(middle), send, reject, acknowledge);
}
