import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LeitnerCard, ReflectionCategory, BOX_CONFIGS, MASTERED_BOX, UserProfile } from '../types/leitner';
import { soundService } from '../services/soundService';
import { Plus, Trash2, Edit3, Calendar, Quote, Compass, Globe, Lock, Users, EyeOff, Share2, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Auto } from './ui/Text';
import { Dialog, CATEGORY_COLORS } from './insights/Dialog';
import { PublicInsightsList } from './insights/PublicInsightsList';
import { MyPublications, QuotaBox } from './insights/MyPublications';
import { fetchQuota, publishInsight, reloadMyInsights, useMyInsights, useSharedAuthors } from '../services/sharedInsights';
import { ShareQuota, isSharedCopy, publishBlock, scoreOf, shareErrorCode, shareQuota } from '../services/shareLogic';

interface ReflectionManagerProps {
  cards: LeitnerCard[];
  profile: UserProfile;
  onAddCard: (card: Partial<LeitnerCard>) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<LeitnerCard>) => void;
  /** A card was added from outside the engine's usual calls (public cards) */
  onCardsChanged: () => void;
  onStartReview: () => void;
}

type Tab = 'mine' | 'public' | 'published';

const CATEGORIES = Object.keys(CATEGORY_COLORS) as ReflectionCategory[];

const field = 'w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none';

export const ReflectionManager: React.FC<ReflectionManagerProps> = ({
  cards,
  profile,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onCardsChanged
}) => {
  const { t, date, num } = useI18n();
  const s = t.shared;
  const [tab, setTab] = useState<Tab>('mine');
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [publishCard, setPublishCard] = useState<LeitnerCard | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [serverQuota, setServerQuota] = useState<ShareQuota | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reflectionCards = cards.filter(c => c.type === 'reflection');
  const { items: publications, liveBySource } = useMyInsights();
  const authors = useSharedAuthors(reflectionCards);
  // Until the server answers (or when offline), estimate from this device's cards
  const quota = serverQuota ?? shareQuota(scoreOf(cards), publications.length);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const loadQuota = useCallback(async () => {
    try {
      setServerQuota(await fetchQuota());
    } catch (e) {
      console.error('Could not load the publishing quota', e);
    }
  }, []);
  useEffect(() => { void loadQuota(); }, [loadQuota]);

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundService.playSuccess();
    onAddCard({
      type: 'reflection',
      title: title.trim(),
      content: content.trim(),
      category,
      box: 0
    });

    setTitle('');
    setContent('');
    setIsAdding(false);
  };

  const startEdit = (card: LeitnerCard) => {
    setEditingId(card.id);
    setEditTitle(card.title || '');
    setEditContent(card.content || '');
  };

  const saveEdit = (id: string) => {
    onUpdateCard(id, {
      title: editTitle.trim(),
      content: editContent.trim()
    });
    setEditingId(null);
  };

  const publish = async () => {
    if (!publishCard) return;
    setPublishing(true);
    try {
      await publishInsight(publishCard.id);
      await Promise.all([reloadMyInsights(), loadQuota()]);
      soundService.playSuccess();
      toast(s.published);
      setPublishCard(null);
    } catch (e) {
      const code = shareErrorCode(e);
      toast(s.errors[code]);
      if (code === 'quota' || code === 'already_public') void Promise.all([reloadMyInsights(), loadQuota()]);
    } finally {
      setPublishing(false);
    }
  };

  const publishReason = publishCard ? publishBlock(publishCard, quota, liveBySource.has(publishCard.id)) : null;
  const liveCount = publications.filter(p => !p.unpublishedAt && !p.removedAt).length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'mine', label: s.tabMine, count: reflectionCards.length },
    { id: 'public', label: s.tabPublic },
    { id: 'published', label: s.tabPublished, count: liveCount || undefined }
  ];

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Compass className="w-4 h-4 shrink-0" />
              <span>{t.reflections.badge}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.reflections.title}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">{t.reflections.subtitle}</p>
          </div>

          {tab === 'mine' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-colors"
            >
              <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
              <span>{isAdding ? t.reflections.closeForm : t.reflections.newCard}</span>
            </button>
          )}
        </div>

        <div role="tablist" className="grid grid-cols-3 sm:inline-flex w-full sm:w-fit p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          {tabs.map(x => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              data-testid={`insights-tab-${x.id}`}
              onClick={() => setTab(x.id)}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-4 py-1.5 rounded-lg text-center leading-tight transition-colors ${
                tab === x.id
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {x.id === 'public' && <Globe className="w-3.5 h-3.5 shrink-0 max-sm:hidden" />}
              <span>{x.label}</span>
              {x.count !== undefined && <span className="font-mono-num text-[10px] opacity-70">{num(x.count)}</span>}
            </button>
          ))}
        </div>

        {tab === 'mine' && isAdding && (
          <form onSubmit={handleSubmitNew} className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t.reflections.formTitle}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="refl-title" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.titleLabel}</label>
                <input
                  id="refl-title"
                  type="text"
                  dir="auto"
                  required
                  placeholder={t.reflections.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={field}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="refl-category" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.categoryLabel}</label>
                <select
                  id="refl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReflectionCategory)}
                  className={field}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{t.categories[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="refl-content" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.contentLabel}</label>
              <textarea
                id="refl-content"
                dir="auto"
                rows={3}
                placeholder={t.reflections.contentPlaceholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${field} leading-relaxed`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {t.common.cancel}
              </button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs">
                {t.reflections.add}
              </button>
            </div>
          </form>
        )}
      </div>

      {tab === 'public' && <PublicInsightsList onCardAdded={onCardsChanged} toast={toast} />}

      {tab === 'published' && <MyPublications cards={cards} quota={serverQuota ?? quota} onChanged={() => { void loadQuota(); onCardsChanged(); }} toast={toast} />}

      {tab === 'mine' && (reflectionCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Quote className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{t.reflections.emptyTitle}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{t.reflections.emptyBody}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">
              {t.reflections.emptyCta}
            </button>
            <button onClick={() => setTab('public')} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold">
              <Globe className="w-4 h-4" />{s.tabPublic}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reflectionCards.map((card) => {
            const isEditing = editingId === card.id;
            const cat = card.category || 'decision';
            const boxConfig = BOX_CONFIGS[card.box];
            const isMastered = card.box >= MASTERED_BOX || !boxConfig;
            const publication = liveBySource.get(card.id);
            const copy = isSharedCopy(card);
            const author = authors.get(card.id);

            return (
              <div
                key={card.id}
                data-testid="insight-card"
                data-state={publication ? 'public' : copy ? 'copy' : 'own'}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4 ${
                  publication ? 'border-indigo-200 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${CATEGORY_COLORS[cat]}`}>
                        {t.categories[cat]}
                      </span>
                      {publication && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-600 text-white">
                          <Globe className="w-3 h-3" />{s.publicBadge}
                        </span>
                      )}
                      {copy && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          <Share2 className="w-3 h-3" />{s.copyBadge}
                        </span>
                      )}
                    </div>

                    <div className="dot-list flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <span>{isMastered ? t.reflections.mastered : t.boxes.name(card.box)}</span>
                      {!isMastered && (
                        <>
                          <span>{t.reflections.interval(boxConfig.intervalDays)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        dir="auto"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                      />
                      <textarea
                        dir="auto"
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs text-slate-500">{t.common.cancel}</button>
                        <button onClick={() => saveEdit(card.id)} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold">
                          {t.common.save}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Auto as="h3" className="block font-bold text-base text-slate-900 dark:text-white mb-1.5 break-words [overflow-wrap:anywhere] text-start">{card.title}</Auto>
                      <Auto as="p" className="block text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-4 [overflow-wrap:anywhere] text-start">
                        {card.content}
                      </Auto>
                      {copy && author && (
                        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400" data-testid="copy-author">
                          <Auto>{s.byAuthor(author)}</Auto>
                        </p>
                      )}
                    </div>
                  )}

                  {publication && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-indigo-900 dark:text-indigo-200">
                      <span className="flex items-center gap-1.5">
                        {publication.hidden ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Users className="w-3.5 h-3.5 shrink-0" />}
                        {publication.hidden ? s.pendingReview : s.inBoxes(publication.adopters.length)}
                      </span>
                      <span className="flex items-center gap-1.5 text-indigo-800/80 dark:text-indigo-300/80">
                        <Lock className="w-3.5 h-3.5 shrink-0" />{s.lockedNote}
                      </span>
                    </div>
                  )}
                </div>

                {confirmingDeleteId === card.id ? (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {copy ? s.confirmRemoveCopy(card.title || '') : t.reflections.confirmDelete(card.title || '')}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmingDeleteId(null)} className="px-2.5 py-1 text-slate-500">{t.common.cancel}</button>
                      <button
                        onClick={() => {
                          setConfirmingDeleteId(null);
                          onDeleteCard(card.id);
                        }}
                        data-testid="confirm-delete"
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold"
                      >
                        {t.reflections.confirmYes}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {!isMastered && <span>{t.reflections.nextDue(date(`${card.nextReviewDate}T12:00:00`))}</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      {publication ? (
                        <button
                          onClick={() => setTab('published')}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                        >
                          {s.manage}
                        </button>
                      ) : copy ? (
                        <button
                          onClick={() => setConfirmingDeleteId(card.id)}
                          data-testid="remove-copy"
                          className="flex items-center gap-1 px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg text-[11px] text-slate-500 hover:text-red-600"
                          title={s.copyNote}
                        >
                          <Trash2 className="w-3.5 h-3.5" />{s.removeCopy}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setPublishCard(card)}
                            data-testid="publish"
                            className="flex items-center gap-1 px-2 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
                          >
                            <Globe className="w-3.5 h-3.5" />{s.publish}
                          </button>
                          <button
                            onClick={() => startEdit(card)}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title={t.common.edit}
                            aria-label={t.common.edit}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(card.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 rounded text-slate-400 hover:text-red-500"
                            title={t.reflections.deleteTitle}
                            aria-label={t.reflections.deleteTitle}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {publishCard && (
        <Dialog
          title={<><Globe className="w-5 h-5 text-indigo-600 shrink-0" />{s.publishTitle}</>}
          testId="publish-dialog"
          busy={publishing}
          confirmDisabled={publishReason !== null}
          confirmLabel={publishing ? s.publishing : s.publishConfirm}
          onClose={() => setPublishCard(null)}
          onConfirm={() => void publish()}
        >
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
            <Auto as="p" className="block font-bold text-slate-900 dark:text-white [overflow-wrap:anywhere] text-start">{publishCard.title}</Auto>
            {publishCard.content && (
              <Auto as="p" className="block text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-4 [overflow-wrap:anywhere] text-start">{publishCard.content}</Auto>
            )}
            <p className="text-[11px] font-semibold text-slate-500"><Auto>{s.byAuthor(profile.displayName)}</Auto></p>
          </div>

          {publishReason ? (
            <div data-testid="publish-block" className="space-y-3">
              <p className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{publishReason === 'quota' ? s.block.quota(quota.pointsToNext) : s.block[publishReason]}</span>
              </p>
              {publishReason === 'quota' && <QuotaBox quota={quota} />}
            </div>
          ) : (
            <ul className="space-y-2 list-disc ps-5 marker:text-indigo-500">
              <li className="font-semibold text-slate-900 dark:text-white">{s.publishName(profile.displayName)}</li>
              {s.publishPoints.map(p => <li key={p}>{p}</li>)}
              <li className="font-semibold text-slate-900 dark:text-white">{s.publishSlot(quota.used, quota.allowed)}</li>
            </ul>
          )}
        </Dialog>
      )}

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          data-testid="share-toast"
          className="fixed z-[70] inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:bottom-6 mx-auto w-fit max-w-md px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-lg text-center"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
};
