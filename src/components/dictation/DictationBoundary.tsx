import React from 'react';
import { getMessages } from '../../i18n/I18nProvider';

/** A crash inside the dictation chunk (or a failed chunk download) must not take the rest of the app down. */
export class DictationBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const t = getMessages().dictation;
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3" role="alert">
        <p className="text-slate-700 dark:text-slate-200">{t.loadError}</p>
        <button type="button" onClick={() => this.setState({ failed: false })} className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white font-semibold">{t.retry}</button>
      </div>
    );
  }
}
