import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { chargerGuide, Guide, ResumeGuide } from './guides';
import { useProcedures, useSolutions } from './donneesProcedures';
import { normaliser, rechercher } from './recherche';
import { ListeSolutions } from './Solutions';
import './guides.css';
import { t } from '../../lib/i18n';

/** Recherche par mot-clé dans les guides du compte : un résultat ouvre l'écran sur le bon repère. */
export default function Recherche() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [guides, setGuides] = useState<Guide[]>();
  const [erreur, setErreur] = useState<unknown>();
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<ResumeGuide[]>('/guides')
      .then((l) => Promise.all(l.map((g) => chargerGuide(g.slug))))
      .then(setGuides)
      .catch(setErreur);
    champ.current?.focus();
  }, []);

  const resultats = useMemo(() => (guides ? rechercher(guides, q) : []), [guides, q]);
  const anims = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    if (!mots.length || !guides) return [];
    return guides.flatMap((g) =>
      (g.animations ?? [])
        .filter((a) => {
          const caps = a.scenes.map((s) => ('cap' in s ? s.cap : s.etapes.map((e) => e.cap ?? '').join(' ')));
          const t = normaliser(`${a.titre} ${a.resume ?? ''} ${a.scenes.map((s) => s.titre).join(' ')} ${caps.join(' ')}`).split(' ');
          return mots.every((m) => t.some((w) => w.startsWith(m)));
        })
        .map((a) => ({ ...a, slug: g.slug })),
    );
  }, [guides, q]);
  const { liste: procedures } = useProcedures();
  const { liste: solutions } = useSolutions();
  const astuces = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    return (solutions ?? []).filter((s) => {
      const txt = normaliser(`${s.titre} ${s.categorie} ${s.cause ?? ''} ${s.texte} ${s.motsCles.join(' ')}`).split(' ');
      return mots.every((m) => txt.some((w) => w.startsWith(m)));
    });
  }, [solutions, q]);
  const procs = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    return (procedures ?? []).filter((p) => {
      const t = normaliser(`${p.titre} ${p.categorie} ${p.resume ?? ''} ${p.textes.join(' ')}`).split(' ');
      return mots.every((m) => t.some((w) => w.startsWith(m)));
    });
  }, [procedures, q]);
  const plusieurs = (guides?.length ?? 0) > 1;

  return (
    <div className="page gx">
      <h1>{t('kiavik.recherche.titre')}</h1>
      <div className="gx-recherche">
        <input
          ref={champ}
          type="search"
          enterKeyHint="search"
          placeholder={t('kiavik.recherche.exemple')}
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          aria-label={t('kiavik.recherche.champ')}
        />
      </div>
      {erreur ? (
        <Erreur e={erreur} />
      ) : !guides ? (
        <Chargement />
      ) : !q.trim() ? (
        <p className="muted">{t('kiavik.recherche.aide')}</p>
      ) : !resultats.length && !procs.length && !anims.length && !astuces.length ? (
        <p className="muted">{t('kiavik.recherche.aucun', { q })}</p>
      ) : (
        <>
          {astuces.length > 0 && (
            <>
              <h4>{t('kiavik.recherche.solutions', { n: astuces.length })}</h4>
              <ListeSolutions liste={astuces} />
            </>
          )}
          {procs.length > 0 && (
            <>
              <h4>{t('kiavik.recherche.procedures', { n: procs.length })}</h4>
              <div className="gx-resultats">
                {procs.map((p) => (
                  <Link key={p.id} className="carte gx-resultat" to={`/procedures/${p.id}`}>
                    <b>📋 {p.titre}</b>
                    {p.resume && <span className="muted petit">{p.resume}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
          {anims.length > 0 && (
            <>
              <h4>{t('kiavik.recherche.animations', { n: anims.length })}</h4>
              <div className="gx-resultats">
                {anims.map((a) => (
                  <Link key={a.id} className="carte gx-resultat" to={`/guides/${a.slug}/animation/${a.id}`}>
                    <b>🎬 {a.titre}</b>
                    {a.resume && <span className="muted petit">{a.resume}</span>}
                  </Link>
                ))}
              </div>
            </>
          )}
          {resultats.length > 0 && <h4>{t('kiavik.recherche.boutons', { n: `${resultats.length}${resultats.length === 50 ? '+' : ''}` })}</h4>}
          <div className="gx-resultats">
            {resultats.map((r) => (
              <Link key={`${r.guide}/${r.ecran}/${r.pastille}`} className="carte gx-resultat" to={`/guides/${r.guide}/${r.ecran}?p=${encodeURIComponent(r.pastille)}`}>
                <span className="gx-ref">{plusieurs ? `${r.nomGuide.split(' ')[0]} · ` : ''}{r.codeEcran} · {r.pastille}</span>
                <b>{r.titre}</b>
                <span className="muted petit">{r.titreEcran}</span>
                <span className="petit gx-extrait">{r.extrait}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
