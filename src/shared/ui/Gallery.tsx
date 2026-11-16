/**
 * Design-system gallery: every shared component in every state, for checking consistency at a glance and for the
 * browser tests. Opens with ?gallery=1, only in development and demo builds (App.tsx); it is not part of the
 * production bundle. Light/dark follows the system setting; the direction switch shows RTL and LTR.
 */
import React, { useState } from 'react';
import { Plus, Trash2, Star, Quote } from 'lucide-react';
import { Button, IconButton, Dialog, Card, Badge, TextField, TextArea, Select, SegmentedControl, ProgressDots, EmptyState } from '.';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3" data-testid={`gallery-${title.toLowerCase().replace(/\W+/g, '-')}`}>
    <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h2>
    <div className="flex flex-wrap items-start gap-3">{children}</div>
  </section>
);

export default function Gallery() {
  const [dir, setDir] = useState<'rtl' | 'ltr'>('rtl');
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [dialog, setDialog] = useState<null | 'center' | 'sheet'>(null);

  return (
    <div dir={dir} className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Design system</h1>
          <SegmentedControl label="Direction" value={dir} onChange={setDir} options={[{ value: 'rtl', label: 'RTL' }, { value: 'ltr', label: 'LTR' }]} />
        </header>

        <Section title="Buttons">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 className="w-4 h-4" />}>Danger</Button>
          <Button icon={<Plus className="w-4 h-4" />}>With icon</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="sm" variant="secondary">Small secondary</Button>
          <IconButton label="Favourite"><Star className="w-5 h-5" /></IconButton>
          <IconButton label="Delete" variant="danger" size="sm"><Trash2 className="w-4 h-4" /></IconButton>
          <Button block variant="secondary">Full width</Button>
        </Section>

        <Section title="Badges">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
        </Section>

        <Section title="Card">
          <Card className="w-full sm:w-80 space-y-2">
            <h3 className="font-bold">Card title</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Cards use the card radius and the neutral border.</p>
          </Card>
        </Section>

        <Section title="Fields">
          <div className="grid sm:grid-cols-3 gap-4 w-full">
            <TextField label="Title" placeholder="Jeden Tag zehn Minuten" />
            <TextField label="With hint" hint="Shown under the field" />
            <TextField label="With error" error="This field is required" defaultValue="" />
            <Select label="Category" defaultValue="b"><option value="a">Decision</option><option value="b">Motivation</option></Select>
            <TextArea label="Text" className="sm:col-span-2" placeholder="Long text…" />
          </div>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl label="Filter" value={seg} onChange={setSeg} options={[{ value: 'a', label: 'All', count: 12 }, { value: 'b', label: 'Words' }, { value: 'c', label: 'Cards' }]} />
        </Section>

        <Section title="Progress dots">
          <ProgressDots total={6} current={0} label="Page 1 of 6" />
          <ProgressDots total={6} current={3} label="Page 4 of 6" />
        </Section>

        <Section title="Empty state">
          <EmptyState className="w-full" icon={<Quote className="w-6 h-6" />} title="Nothing here yet" body="One sentence on what to do next." action={<Button size="sm">Add the first one</Button>} />
        </Section>

        <Section title="Dialogs">
          <Button variant="secondary" onClick={() => setDialog('center')} data-testid="open-dialog">Open dialog</Button>
          <Button variant="secondary" onClick={() => setDialog('sheet')} data-testid="open-sheet">Open bottom sheet</Button>
        </Section>

        <Section title="Story page">
          <div className="w-full rounded-sheet bg-paper border border-paper-edge p-6 text-ink" dir="ltr">
            <h3 className="font-story-title text-2xl mb-3">Herzlich willkommen!</h3>
            <p lang="de" className="font-story text-xl leading-loose">
              <b>Montag</b>, acht Uhr. <span className="gender-f">Die Annenstraße</span> in Graz ist noch ruhig. Nilufar hat
              heute einen <span className="gender-m">Termin</span>. Sie trinkt <span className="gender-m">Kaffee</span> mit dem
              <span className="gender-n"> Team</span> und kennt schon zwei <span className="gender-pl">Kollegen</span>.
            </p>
            <p className="text-sm text-ink-soft mt-3">Gender underlines: masculine, feminine, neuter, plural.</p>
          </div>
        </Section>

        <Section title="Text sizes">
          <div className="space-y-1">
            <p className="text-caption">Caption 12px: the smallest text in the app</p>
            <p className="text-xs">xs 12px</p>
            <p className="text-sm">sm 14px</p>
            <p className="text-base">base 16px</p>
            <p className="text-lg font-bold">lg 18px bold</p>
          </div>
        </Section>
      </div>

      {dialog && (
        <Dialog
          title="Dialog title"
          description="Esc, a tap outside and × close it. Focus stays inside and returns to the button."
          placement={dialog}
          onClose={() => setDialog(null)}
          testId="gallery-dialog"
          footer={<><Button variant="ghost" onClick={() => setDialog(null)}>Cancel</Button><Button data-autofocus onClick={() => setDialog(null)}>Confirm</Button></>}
        >
          <TextField label="A field inside" />
        </Dialog>
      )}
    </div>
  );
}
