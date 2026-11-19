import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../../shared/ui';
import { De } from '../../shared/ui/Text';
import { imageUrl } from './content';
import { bookTitle, lastReading } from './library';
import type { BookSummary, StoriesIndex, StoryProgress } from './types';

export function BookArt({ book, eager = false }: { book: BookSummary; eager?: boolean }) {
  const cover = book.stories.find(story => story.image)?.image;
  return cover ? <img src={imageUrl(cover, true)} alt="" width={800} height={600}
    className="editorial-cover" loading={eager ? 'eager' : 'lazy'} decoding="async" />
    : <div className="editorial-type-cover" dir="ltr" aria-hidden="true">
      <span className="text-caption tracking-widest">DAF · LESEBIBLIOTHEK</span>
      <De className="editorial-title text-2xl">{bookTitle(book)}</De>
      <span className="text-caption tracking-widest">BAND {book.n.toString().padStart(2, '0')}</span>
    </div>;
}

export function BookProgress({ book, progress }: { book: BookSummary; progress: Record<string, StoryProgress> }) {
  const { t } = useI18n();
  const done = book.stories.filter(story => progress[story.id]?.completedAt).length;
  const label = t.stories.bookProgress(done, book.stories.length);
  return <div className="space-y-2">
    <span className="text-caption text-ink-soft">{label}</span>
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={book.stories.length} aria-valuenow={done}
      className="h-1 rounded-full bg-paper-edge overflow-hidden">
      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${done / book.stories.length * 100}%` }} />
    </div>
  </div>;
}

export function EditorialLibrary({ index, progress, onBook, onResume }: {
  index: StoriesIndex; progress: Record<string, StoryProgress>;
  onBook: (n: number) => void; onResume: (n: number, storyId: string, page: number) => void;
}) {
  const { t, dir } = useI18n();
  const s = t.stories;
  const resume = lastReading(index.books, progress);
  const featured = resume?.book ?? index.books[0];
  if (!featured) return null;
  return <div className="editorial-library space-y-10" data-testid="stories-shelf">
    <div className="space-y-3">
      <p className="text-caption text-ink-soft">{s.title}</p>
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">{s.libraryHeading}</h1>
      <p className="text-sm sm:text-base text-ink-soft max-w-2xl leading-relaxed">{s.libraryIntro}</p>
    </div>
    <section className="editorial-feature" dir="ltr" aria-label={bookTitle(featured)}>
      <button type="button" className="editorial-art-button" onClick={() => onBook(featured.n)} aria-label={`${s.discoverBook}: ${bookTitle(featured)}`}>
        <BookArt book={featured} eager />
      </button>
      <div className="space-y-5 min-w-0" dir={dir}>
        <p className="text-sm text-ink-soft">{resume ? s.continueReading : s.startHere} · {s.lessons(...featured.lessons)}</p>
        <h2 className="editorial-title text-3xl sm:text-4xl"><De className="block text-start">{bookTitle(featured)}</De></h2>
        <p className="text-base leading-8 text-ink-soft">{s.bookTeasers[featured.n - 1]}</p>
        {resume && <De as="p" className="text-sm text-ink-soft">{resume.story.title}</De>}
        <div className="flex flex-wrap items-center gap-3">
          {resume && <Button data-testid="resume-reading" onClick={() => onResume(resume.book.n, resume.story.id, resume.saved.page)}>{s.continueReading}</Button>}
          <Button variant={resume ? 'secondary' : 'primary'} onClick={() => onBook(featured.n)}>{s.discoverBook}</Button>
          <span className="text-caption text-ink-soft">{s.bookFormat}</span>
        </div>
      </div>
    </section>
    <section className="space-y-6 border-t border-paper-edge pt-8" aria-labelledby="library-discover">
      <h2 id="library-discover" className="text-xl font-semibold">{s.discoverBooks}</h2>
      <ul className="editorial-grid" dir="ltr">
        {index.books.map(book => <li key={book.id}>
          <button type="button" data-testid="book-cover" className="editorial-book" onClick={() => onBook(book.n)}>
            <BookArt book={book} />
            <div className="space-y-3 pt-4" dir={dir}>
              <p className="text-caption text-ink-soft">{s.book(book.n)} · {s.lessons(...book.lessons)}</p>
              <De as="h3" className="editorial-title text-xl text-start">{bookTitle(book)}</De>
              <p className="text-sm text-ink-soft leading-7">{s.bookTeasers[book.n - 1]}</p>
              <BookProgress book={book} progress={progress} />
              <span className="inline-flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">{s.discoverBook}<ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden /></span>
            </div>
          </button>
        </li>)}
      </ul>
    </section>
  </div>;
}
