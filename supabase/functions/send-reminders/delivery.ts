/** An uncertain network outcome is terminal: automatic retries could notify twice. */
export function deliveryOutcome(status: number | null): 'sent' | 'failed' | 'expired' | 'unknown' {
  if (status === null) return 'unknown';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'expired';
  return 'failed';
}
export async function mapBounded<T,R>(items: T[], limit: number, operation: (item:T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit<1) throw new Error('Invalid concurrency');
  const results = new Array<R>(items.length); let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){const index=next++;results[index]=await operation(items[index]);}
  }));
  return results;
}
