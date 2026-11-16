/**
 * "New card" dialog: a German word (with meaning, article, plural, Perfekt, forms, example) or one of the user's own
 * cards (decision, motivation, goal, habit, note). Opens from the header's + button; Stories opens it with a word
 * filled in (initialWord) when the learner taps a word that isn't in the word list.
 */
import React, { useState } from 'react';
import { LeitnerCard, CardType, ReflectionCategory } from '../../core/types';
import { soundService } from '../../shared/lib/soundService';
import { BookOpen, Sparkles, Plus } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { Dialog, Button, TextField, TextArea, Select, SegmentedControl } from '../../shared/ui';

interface NewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Partial<LeitnerCard>) => void;
  /** Pre-fills the German word (Stories: "add as a new card") */
  initialWord?: string;
}

const CATEGORIES: ReflectionCategory[] = ['decision', 'motivation', 'goal', 'habit', 'note'];
const WORTARTEN = ['Nomen', 'Verb', 'Adjektiv', 'Adverb', 'Präposition', 'Ausdruck'] as const;

export const NewCardModal: React.FC<NewCardModalProps> = (props) => (props.isOpen ? <NewCardDialog {...props} /> : null);

const NewCardDialog: React.FC<NewCardModalProps> = ({ onClose, onAddCard, initialWord }) => {
  const { t, lang } = useI18n();
  const [cardType, setCardType] = useState<CardType>('vocab');

  // Vocab fields. The required meaning is in the interface language, the other one is optional.
  const [wort, setWort] = useState(initialWord ?? '');
  const [meaningPrimary, setMeaningPrimary] = useState('');
  const [meaningSecondary, setMeaningSecondary] = useState('');
  const [artikel, setArtikel] = useState('–');
  const [plural, setPlural] = useState('');
  const [formen, setFormen] = useState('');
  const [beispiel, setBeispiel] = useState('');
  const [wortart, setWortart] = useState('Nomen');
  const [perfekt, setPerfekt] = useState('');

  // Reflection fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cardType === 'vocab') {
      if (!wort.trim() || !meaningPrimary.trim()) return;
      const persisch = (lang === 'fa' ? meaningPrimary : meaningSecondary).trim();
      const englisch = (lang === 'fa' ? meaningSecondary : meaningPrimary).trim();
      soundService.playSuccess();
      onAddCard({
        type: 'vocab',
        wort: wort.trim(),
        persisch,
        ...(englisch ? { englisch } : {}),
        ...(wortart === 'Verb' && perfekt.trim() ? { perfekt: perfekt.trim() } : {}),
        artikel,
        plural: plural.trim(),
        formen: formen.trim(),
        beispiel: beispiel.trim(),
        wortart,
        // Kept in Persian so older app versions still display custom cards correctly
        lektion: 'سفارشی',
        niveau: 'سفارشی'
      });
    } else {
      if (!title.trim()) return;
      soundService.playSuccess();
      onAddCard({
        type: 'reflection',
        title: title.trim(),
        content: content.trim(),
        category
      });
    }

    onClose();
  };

  const de = { dir: 'ltr' as const, lang: 'de', inputClassName: 'font-de' };

  return (
    <Dialog
      onClose={onClose}
      title={<><span className="w-8 h-8 shrink-0 rounded-control bg-indigo-600 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></span>{t.newCard.title}</>}
      size="md"
      testId="new-card-dialog"
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
        <Button type="submit" form="new-card-form">{t.newCard.submit}</Button>
      </>}
    >
      <SegmentedControl
        label={t.newCard.title}
        className="grid grid-cols-2 w-full"
        value={cardType}
        onChange={setCardType}
        options={[
          { value: 'vocab', label: <><BookOpen className="w-4 h-4" />{t.newCard.typeVocab}</> },
          { value: 'reflection', label: <><Sparkles className="w-4 h-4" />{t.newCard.typeReflection}</> },
        ]}
      />
      <form id="new-card-form" onSubmit={handleSubmit} className="space-y-4">
        {cardType === 'vocab' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Select label={t.newCard.article} value={artikel} onChange={(e) => setArtikel(e.target.value)}>
                <option value="–">{t.newCard.noArticle}</option>
                {(['der', 'die', 'das'] as const).map(a => <option key={a} value={a}>{a} ({t.articles[a]})</option>)}
              </Select>
              <TextField label={t.newCard.word} className="col-span-2" required placeholder="z.B. der Termin, lernen…" value={wort} onChange={(e) => setWort(e.target.value)} {...de} />
            </div>
            <TextField label={t.newCard.meaningPrimary} required placeholder={t.newCard.meaningPrimaryPlaceholder} value={meaningPrimary} onChange={(e) => setMeaningPrimary(e.target.value)} />
            <TextField label={t.newCard.meaningSecondary} dir={lang === 'fa' ? 'ltr' : 'rtl'} lang={lang === 'fa' ? 'en' : 'fa'}
              placeholder={t.newCard.meaningSecondaryPlaceholder} value={meaningSecondary} onChange={(e) => setMeaningSecondary(e.target.value)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField label={t.newCard.plural} placeholder="die Termine" value={plural} onChange={(e) => setPlural(e.target.value)} {...de} />
              <Select label={t.newCard.wortart} value={wortart} onChange={(e) => setWortart(e.target.value)}>
                {WORTARTEN.map(w => <option key={w} value={w}>{w} ({t.newCard.wortarten[w]})</option>)}
              </Select>
            </div>
            {wortart === 'Verb' && (
              <TextField label={t.newCard.perfekt} hint={t.newCard.perfektHint} placeholder="hat gelernt" value={perfekt} onChange={(e) => setPerfekt(e.target.value)}
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} {...de} />
            )}
            <TextField label={t.newCard.formen} placeholder="lernt · lernte · hat gelernt" value={formen} onChange={(e) => setFormen(e.target.value)} {...de} />
            <TextArea label={t.newCard.example} rows={2} placeholder={t.newCard.examplePlaceholder} value={beispiel} onChange={(e) => setBeispiel(e.target.value)} />
          </>
        ) : (
          <>
            <TextField label={t.newCard.reflTitle} required placeholder={t.newCard.reflTitlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select label={t.newCard.reflCategory} value={category} onChange={(e) => setCategory(e.target.value as ReflectionCategory)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{t.categories[c]}</option>)}
            </Select>
            <TextArea label={t.newCard.reflContent} rows={4} placeholder={t.newCard.reflContentPlaceholder} value={content} onChange={(e) => setContent(e.target.value)} />
          </>
        )}
      </form>
    </Dialog>
  );
};
