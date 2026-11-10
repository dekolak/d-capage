import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { chargerGuide, Guide, ResumeGuide } from './guides';
import { rechercher } from './recherche';
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
        <p className="muted">Tapez un mot : nom d'un bouton, d'un réglage ou un problème. Les résultats ouvrent l'écran sur le bon repère.</p>
      ) : !resultats.length ? (
        <p className="muted">Aucun résultat pour « {q} ».</p>
      ) : (
        <>
          <h4>Boutons et réglages · {resultats.length}{resultats.length === 50 ? '+' : ''}</h4>
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
