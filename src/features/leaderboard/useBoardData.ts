import { useEffect, useState } from 'react';

/** A response belongs to its loader (including period/user). Old requests cannot replace a new view. */
export function useBoardData<T>(loader: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{ loader: typeof loader; revision: number; data?: T; error?: boolean }>();
  useEffect(() => {
    let current = true;
    loader().then(data => { if (current) setSnapshot({ loader, revision, data }); })
      .catch(() => { if (current) setSnapshot({ loader, revision, error: true }); });
    return () => { current = false; };
  }, [loader, revision]);
  const active = snapshot?.loader === loader && snapshot.revision === revision;
  return {
    data: active ? snapshot.data : undefined,
    status: !active ? 'loading' as const : snapshot.error ? 'error' as const : 'ready' as const,
    refresh: () => setRevision(value => value + 1),
  };
}
