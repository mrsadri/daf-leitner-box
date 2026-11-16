/** Full-screen spinner with a status line, used while the session and the user's data load. */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { Credit } from './Credit';

export const FullScreenLoader: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-600 dark:text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    <span className="text-sm font-medium px-4 text-center">{text}</span>
    <Credit className="absolute bottom-6 inset-x-0 px-6 max-w-md mx-auto" />
  </div>
);
