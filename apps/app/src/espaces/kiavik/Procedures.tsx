import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { useAuth } from '../../lib/auth';
import { ResumeProcedure, useProcedures } from './donneesProcedures';
import { normaliser } from './recherche';
import './guides.css';
import { t, tn } from '../../lib/i18n';

/** Liste des procédures par catégorie, avec un filtre. */
export default function Procedures() {
  const { moi } = useAuth();
  const { liste, erreur, acces } = useProcedures();
  const [q, setQ] = useState('');
  const groupes = useMemo(() => {
    const mots = normaliser(q).split(' ').filter(Boolean);
    const m = new Map<string, ResumeProcedure[]>();
    for (const p of liste ?? []) {
      const t = normaliser(`${p.titre} ${p.categorie} ${p.resume ?? ''} ${p.textes.join(' ')}`);
      if (mots.every((w) => t.includes(w))) m.set(p.categorie, [...(m.get(p.categorie) ?? []), p]);
    }
    return [...m];
  }, [liste, q]);

  if (!acces) return <div className="page"><h1>{t('kiavik.procedures.titre')}</h1><p className="muted">{t('kiavik.procedures.nonActivees')}</p></div>;
  if (erreur) return <div className="page"><Erreur e={erreur} /></div>;
  if (!liste) return <Chargement />;
  return (
    <div className="page gx">
      <h1>{t('kiavik.procedures.titre')}</h1>
      {moi?.role === 'ADMIN' && <Link to="/admin/procedures" className="btn petit gx-admin-lien">{t('kiavik.procedures.gerer')}</Link>}
      <Link to="/solutions" className="bandeau lien-bandeau">
        <span><b>{t('kiavik.solutions.titre')}</b>{t('kiavik.solutions.bandeau')}</span>
        <span>›</span>
      </Link>
      {liste.length > 4 && (
        <div className="gx-recherche">
          <input type="search" placeholder={t('kiavik.procedures.filtrer')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('kiavik.procedures.filtrerChamp')} />
        </div>
      )}
      {!groupes.length && <p className="muted">{liste.length ? t('kiavik.procedures.aucuneCorrespond') : t('kiavik.accueil.aucuneProcedure')}</p>}
      {groupes.map(([cat, l]) => (
        <section key={cat}>
          <h4>{cat}</h4>
          <ListeProcedures liste={l} />
        </section>
      ))}
    </div>
  );
}

export function ListeProcedures({ liste }: { liste: ResumeProcedure[] }) {
  return (
    <div className="gx-resultats">
      {liste.map((p) => (
        <Link key={p.id} to={`/procedures/${p.id}`} className="carte gx-resultat">
          <b>📋 {p.titre}</b>
          {p.resume && <span className="muted petit">{p.resume}</span>}
          <span className="petit muted">
            {tn('kiavik.procedures.etapes', p.nbEtapes)}
            {!p.publiee && <span className="gx-brouillon">{t('kiavik.procedures.brouillon')}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}
