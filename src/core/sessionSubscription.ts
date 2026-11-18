/** Auth events take precedence over the initial read; disposed subscriptions cannot update the UI. */
export function subscribeSession<T>({ load, listen, onSession, onError }: {
  load: () => Promise<T | null>;
  listen: (callback: (session: T | null) => void) => () => void;
  onSession: (session: T | null) => void;
  onError: (error: unknown) => void;
}): () => void {
  let live = true;
  let revision = 0;
  const initialRevision = revision;
  const unsubscribe = listen(session => {
    if (!live) return;
    revision++;
    onSession(session);
  });
  void Promise.resolve().then(load).then(session => {
    if (live && revision === initialRevision) onSession(session);
  }).catch(error => {
    if (live && revision === initialRevision) onError(error);
  });
  return () => {
    if (!live) return;
    live = false;
    unsubscribe();
  };
}
