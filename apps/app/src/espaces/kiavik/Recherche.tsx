import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { chargerGuide, Guide, ResumeGuide } from './guides';
import { useProcedures } from './donneesProcedures';
import { normaliser, rechercher } from './recherche';
import './guides.css';

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
      <h1>Rechercher</h1>
      <div className="gx-recherche">
        <input
          ref={champ}
          type="search"
          enterKeyHint="search"
          placeholder="Ex. blanc, pause, résolution…"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          aria-label="Rechercher dans les guides"
        />
      </div>
      {erreur ? (
        <Erreur e={erreur} />
      ) : !guides ? (
        <Chargement />
      ) : !q.trim() ? (
        <p className="muted">Tapez un mot : nom d'un bouton, d'un réglage ou un problème. Les résultats ouvrent l'écran sur le bon repère, ou la procédure.</p>
      ) : !resultats.length && !procs.length && !anims.length ? (
        <p className="muted">Aucun résultat pour « {q} ».</p>
      ) : (
        <>
          {procs.length > 0 && (
            <>
              <h4>Procédures · {procs.length}</h4>
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
              <h4>Animations · {anims.length}</h4>
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
          {resultats.length > 0 && <h4>Boutons et réglages · {resultats.length}{resultats.length === 50 ? '+' : ''}</h4>}
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
