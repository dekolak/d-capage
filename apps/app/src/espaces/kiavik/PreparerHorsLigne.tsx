import { useState } from 'react';
import { api } from '../../lib/api';
import { t } from '../../lib/i18n';
import { Procedure, Solution } from './donneesProcedures';
import { ResumeGuide } from './guides';

const CLE_DATE = 'kiavik.horsLigne.date';

/** Toutes les images d'un guide (captures, miniatures, scènes d'animation, photos corrigées). */
function imagesDuGuide(v: unknown, l = new Set<string>()): Set<string> {
  if (typeof v === 'string') {
    if (/^\/api\/guides\/(images|corrections)\//.test(v)) l.add(v);
  } else if (Array.isArray(v)) v.forEach((x) => imagesDuGuide(x, l));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => imagesDuGuide(x, l));
  return l;
}

/**
 * Charge à l'avance, sur ce téléphone, tout ce qu'il faut pour travailler sans réseau :
 * procédures (avec photos), astuces, guides (avec captures), historique des diagnostics.
 */
async function preparer(progres: (fait: number, total: number) => void) {
  const taches: (() => Promise<unknown>)[] = [];
  const [procedures, solutions, guides] = await Promise.all([
    api<{ id: string }[]>('/procedures'),
    api<Solution[]>('/solutions').catch(() => [] as Solution[]),
    api<ResumeGuide[]>('/guides').catch(() => [] as ResumeGuide[]),
    api('/procedures/diagnostics/miens').catch(() => null),
    api('/categories').catch(() => null),
  ]);
  for (const p of procedures)
    taches.push(async () => {
      const d = await api<Procedure>(`/procedures/${p.id}`);
      await Promise.all(d.etapes.flatMap((e) => e.photos.map((ph) => api(ph.url).catch(() => null))));
    });
  for (const s of solutions) if (s.photo) taches.push(() => api(s.photo!));
  for (const g of guides)
    taches.push(async () => {
      const d = await api<unknown>(`/guides/${g.slug}`);
      // les images des guides sont gardées par le service worker (adresses publiques)
      await Promise.all([...imagesDuGuide(d), ...imagesDuGuide(g)].map((u) => fetch(u).catch(() => null)));
    });
  let fait = 0;
  progres(0, taches.length);
  for (const tache of taches) {
    await tache().catch(() => null);
    progres(++fait, taches.length);
  }
}

/** « 📥 Préparer pour l'atelier sans réseau ». */
export function PreparerHorsLigne() {
  const [etat, setEtat] = useState<{ fait: number; total: number } | null>(null);
  const [date, setDate] = useState(() => localStorage.getItem(CLE_DATE));
  const [erreur, setErreur] = useState(false);
  const lancer = async () => {
    setErreur(false);
    try {
      await preparer((fait, total) => setEtat({ fait, total }));
      const d = new Date().toISOString();
      localStorage.setItem(CLE_DATE, d);
      setDate(d);
    } catch {
      setErreur(true);
    } finally {
      setEtat(null);
    }
  };
  return (
    <div className="carte hl-carte">
      <b>{t('kiavik.horsLigne.titre')}</b>
      <span className="muted petit">{t('kiavik.horsLigne.texte')}</span>
      {date && !etat && <span className="petit">{t('kiavik.horsLigne.pret', { date: new Date(date).toLocaleDateString() })}</span>}
      {erreur && <span className="petit ko">{t('erreur.reseau')}</span>}
      <button type="button" className="btn" disabled={!!etat} onClick={lancer}>
        {etat ? t('kiavik.horsLigne.enCours', { fait: etat.fait, total: etat.total }) : date ? t('kiavik.horsLigne.mettreAJour') : t('kiavik.horsLigne.bouton')}
      </button>
    </div>
  );
}
