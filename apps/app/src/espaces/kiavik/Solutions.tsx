import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { ImageApi, lienGuide, Solution, useProcedures, useSolutions } from './donneesProcedures';
import { Animation, chargerGuide } from './guides';
import { normaliser } from './recherche';
import './guides.css';

/** Liste des fiches « Astuces & solutions », par catégorie, avec un filtre. */
export default function Solutions() {
  const { moi } = useAuth();
  const { liste, erreur, acces } = useSolutions();
  const [q, setQ] = useState('');
  const groupes = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    const m = new Map<string, Solution[]>();
    for (const s of liste ?? []) {
      const txt = normaliser(`${s.titre} ${s.categorie} ${s.cause ?? ''} ${s.texte} ${s.motsCles.join(' ')}`);
      if (mots.every((w) => txt.includes(w))) m.set(s.categorie, [...(m.get(s.categorie) ?? []), s]);
    }
    return [...m];
  }, [liste, q]);

  if (!acces) return <div className="page"><h1>{t('kiavik.solutions.titre')}</h1><p className="muted">{t('kiavik.procedures.nonActivees')}</p></div>;
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!liste) return <Chargement />;
  return (
    <div className="page gx">
      <h1>{t('kiavik.solutions.titre')}</h1>
      <p className="muted">{t('kiavik.solutions.intro')}</p>
      {moi?.role === 'ADMIN' && <Link to="/admin/solutions" className="btn petit gx-admin-lien">{t('kiavik.solutions.gerer')}</Link>}
      {liste.length > 4 && (
        <div className="gx-recherche">
          <input type="search" placeholder={t('kiavik.procedures.filtrer')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('kiavik.solutions.filtrer')} />
        </div>
      )}
      {!groupes.length && <p className="muted">{liste.length ? t('kiavik.solutions.aucuneCorrespond') : t('kiavik.solutions.aucune')}</p>}
      {groupes.map(([cat, l]) => (
        <section key={cat}>
          <h4>{cat}</h4>
          <ListeSolutions liste={l} />
        </section>
      ))}
    </div>
  );
}

export function ListeSolutions({ liste }: { liste: Solution[] }) {
  return (
    <div className="gx-resultats">
      {liste.map((s) => (
        <Link key={s.id} to={`/solutions/${s.id}`} className="carte gx-resultat">
          <b>💡 {s.titre}</b>
          {s.cause && <span className="muted petit">{s.cause}</span>}
          {!s.publiee && <span className="petit"><span className="gx-brouillon">{t('kiavik.procedures.brouillon')}</span></span>}
        </Link>
      ))}
    </div>
  );
}

/** Une fiche : le problème, pourquoi, que faire, précaution, photo, liens vers le bouton et la procédure. */
export function SolutionDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { moi } = useAuth();
  const [s, setS] = useState<Solution>();
  const [erreur, setErreur] = useState<unknown>();
  const [grand, setGrand] = useState(false);
  const { liste: procedures } = useProcedures();
  const [anims, setAnims] = useState<Animation[]>([]);
  useEffect(() => {
    api<Solution>(`/solutions/${id}`).then(setS).catch(setErreur);
  }, [id]);
  // animations liées au même bouton du guide
  useEffect(() => {
    if (!s?.guide || !s.ecran) return;
    chargerGuide(s.guide)
      .then((g) => setAnims((g.animations ?? []).filter((a) => a.liens?.some(([ec, p]) => ec === s.ecran && (!s.pastille || p === s.pastille)))))
      .catch(() => {}); // guide non accessible : pas de lien
  }, [s]);
  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/solutions">{t('kiavik.solutions.retourListe')}</Link></div>;
  if (!s) return <Chargement />;
  const lien = lienGuide(s);
  const proc = procedures?.find((p) => p.id === s.procedureId);
  return (
    <div className="page gx">
      <button type="button" className="btn-lien" onClick={() => nav(-1)}>{t('kiavik.procedures.retour')}</button>
      <h1 className="gx-proc-titre">💡 {s.titre}</h1>
      <p className="muted petit">
        {s.categorie}
        {!s.publiee && <span className="gx-brouillon">{t('kiavik.procedures.brouillon')}</span>}
        {moi?.role === 'ADMIN' && <> · <Link to={`/admin/solutions/${s.id}`}>{t('kiavik.procedures.modifier')}</Link></>}
      </p>
      {s.cause && (
        <div className="carte sx-bloc">
          <h4>{t('kiavik.solutions.pourquoi')}</h4>
          <p>{s.cause}</p>
        </div>
      )}
      <div className="carte sx-bloc">
        <h4>{t('kiavik.solutions.queFaire')}</h4>
        <p>{s.texte}</p>
        {s.avertissement && <div className="gx-warn">⚠️ {s.avertissement}</div>}
        {s.photo && <ImageApi chemin={s.photo} className="gx-etape-photo" onClick={() => setGrand(true)} />}
      </div>
      <div className="gx-proc-lies">
        {lien && <Link to={lien} className="btn petit">{s.pastille ? t('kiavik.procedures.voirBoutonId', { id: s.pastille }) : t('kiavik.procedures.voirBouton')}</Link>}
        {anims.map((a) => (
          <Link key={a.id} to={`/guides/${s.guide}/animation/${a.id}`} className="btn petit">{t('kiavik.guide.voirAnimation', { titre: a.titre })}</Link>
        ))}
        {proc && <Link to={`/procedures/${proc.id}`} className="btn petit">{t('kiavik.guide.voirProcedure', { titre: proc.titre })}</Link>}
      </div>
      {grand && s.photo && (
        <div className="gx-plein" onClick={() => setGrand(false)}>
          <ImageApi chemin={s.photo} />
        </div>
      )}
    </div>
  );
}
