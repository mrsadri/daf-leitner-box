/**
 * The three adjective-ending tables (after a definite article, after ein / kein, with no article) shown on the drill's start screen and anywhere else a learner wants to check an ending.
 */
import React from 'react';
import { Card } from '../../shared/ui';
import { De } from '../../shared/ui/Text';
import { useI18n } from '../../i18n/I18nProvider';
import {
  CASES, type GCase, type Gender,
  DEFINITE_ARTICLE_ENDING, INDEFINITE_ARTICLE_ENDING, NEGATIVE_PLURAL_ARTICLE_ENDING,
  WEAK_ADJECTIVE_ENDING, MIXED_ADJECTIVE_ENDING, STRONG_ADJECTIVE_ENDING,
  GENDER_LABEL, CASE_LABEL, ARTICLE_TYPE_LABEL
} from './grammar';

const GENDER_TEXT_CLASS: Record<Gender | 'pl', string> = {
  m: 'text-gender-m', f: 'text-gender-f', n: 'text-gender-n', pl: 'text-gender-pl'
};

function ending(e: string): string {
  return e === '' ? '–' : `-${e}`;
}

interface Column {
  key: Gender | 'pl';
  article: (c: GCase) => string;
}

function Table({ title, columns, adjectiveEndings }: {
  title: string;
  columns: Column[];
  adjectiveEndings: Record<GCase, Record<string, string>>;
}) {
  return (
    <div className="space-y-2">
      <De as="h3" className="font-bold text-sm text-slate-900 dark:text-white">{title}</De>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th scope="col" className="text-start py-1.5 pe-3 font-semibold text-slate-500 dark:text-slate-400">
                <De>Fall</De>
              </th>
              {columns.map(col => (
                <th key={col.key} scope="col" className={`text-start py-1.5 pe-2 font-semibold ${GENDER_TEXT_CLASS[col.key]}`}>
                  <De>{GENDER_LABEL[col.key]}</De>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map(c => (
              <tr key={c} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="text-start py-1.5 pe-3 font-semibold text-slate-700 dark:text-slate-300">
                  <De>{CASE_LABEL[c]}</De>
                </th>
                {columns.map(col => {
                  const art = col.article(c);
                  return (
                    <td key={col.key} className="py-1.5 pe-2">
                      {/* one LTR run, so a Persian page can't reorder "der -e" into "-eder" */}
                      <De>
                        {art && <span className="text-slate-800 dark:text-slate-200">{art} </span>}
                        <span className="text-ink-soft whitespace-nowrap">{ending(adjectiveEndings[c][col.key])}</span>
                      </De>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReferenceTables() {
  const { t } = useI18n();
  return (
    <Card className="space-y-6">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.adjective.referenceTitle}</p>

      <Table
        title={ARTICLE_TYPE_LABEL.definite}
        columns={[
          { key: 'm', article: c => `d${DEFINITE_ARTICLE_ENDING[c].m}` },
          { key: 'f', article: c => `d${DEFINITE_ARTICLE_ENDING[c].f}` },
          { key: 'n', article: c => `d${DEFINITE_ARTICLE_ENDING[c].n}` },
          { key: 'pl', article: c => `d${DEFINITE_ARTICLE_ENDING[c].pl}` }
        ]}
        adjectiveEndings={WEAK_ADJECTIVE_ENDING}
      />

      <Table
        title={`${ARTICLE_TYPE_LABEL.indefinite} / ${ARTICLE_TYPE_LABEL.negative} (kein)`}
        columns={[
          { key: 'm', article: c => `(k)ein${INDEFINITE_ARTICLE_ENDING[c].m}` },
          { key: 'f', article: c => `(k)ein${INDEFINITE_ARTICLE_ENDING[c].f}` },
          { key: 'n', article: c => `(k)ein${INDEFINITE_ARTICLE_ENDING[c].n}` },
          { key: 'pl', article: c => `kein${NEGATIVE_PLURAL_ARTICLE_ENDING[c]}` }
        ]}
        adjectiveEndings={MIXED_ADJECTIVE_ENDING}
      />

      <Table
        title={ARTICLE_TYPE_LABEL.none}
        columns={[
          { key: 'm', article: () => '' },
          { key: 'f', article: () => '' },
          { key: 'n', article: () => '' },
          { key: 'pl', article: () => '' }
        ]}
        adjectiveEndings={STRONG_ADJECTIVE_ENDING}
      />
    </Card>
  );
}
