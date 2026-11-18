import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from './Button';

function downloadRecovery() {
  const data: Record<string,string> = {};
  for (let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i);
    if (key?.startsWith('daf_')) data[key]=localStorage.getItem(key) ?? '';
  }
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,rawLocalData:data},null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='daf-local-recovery.json'; a.click(); URL.revokeObjectURL(url);
}
export function RecoveryMessage({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return <div role="alert" className="max-w-md mx-auto p-6 space-y-4 text-center">
    <p>{t.common.recoveryError}</p><Button variant="secondary" onClick={downloadRecovery}>{t.common.recoveryDownload}</Button><Button onClick={onRetry}>{t.common.retry}</Button>
  </div>;
}
export class RecoveryBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <RecoveryMessage onRetry={() => window.location.reload()} /> : this.props.children;
  }
}
