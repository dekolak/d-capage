import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ImageApi, lienGuide, Procedure } from './donneesProcedures';
import './guides.css';
import { t } from '../../lib/i18n';

/** « Partie — texte » : l'étape se range sous le titre « Partie » (ex. « Montage — Vérifier la courroie »). */
export function decouperEtape(texte: string): { partie: string | null; texte: string } {
  const m = /^(.{2,40}?)\s+—\s+([\s\S]+)$/.exec(texte);
  return m ? { partie: m[1].trim(), texte: m[2] } : { partie: null, texte };
}

/** Une procédure : étapes à cocher (gardées sur le téléphone), photos agrandissables, « Voir le bouton ». */
export default function ProcedureDetail() {
  const { id = '' } = useParams();
  const { moi } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<Procedure>();
  const [erreur, setErreur] = useState<unknown>();
  const [grand, setGrand] = useState<string | null>(null);
  const cle = `kiavik.etapes.${id}`;
  const [faites, setFaites] = useState<string[]>(() => JSON.parse(localStorage.getItem(cle) ?? '[]'));

  useEffect(() => {
    api<Procedure>(`/procedures/${id}`).then(setP).catch(setErreur);
  }, [id]);
  useEffect(() => {
    localStorage.setItem(cle, JSON.stringify(faites));
  }, [cle, faites]);

  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/procedures">{t('kiavik.procedures.retourListe')}</Link></div>;
  if (!p) return <Chargement />;
  const basculer = (e: string) => setFaites((f) => (f.includes(e) ? f.filter((x) => x !== e) : [...f, e]));
  const fait = p.etapes.filter((e) => faites.includes(e.id)).length;

  return (
    <div className="page gx">
      <button type="button" className="btn-lien" onClick={() => nav(-1)}>{t('kiavik.procedures.retour')}</button>
      <h1 className="gx-proc-titre">{p.titre}</h1>
      <p className="muted petit">
        {p.categorie}
        {!p.publiee && <span className="gx-brouillon">{t('kiavik.procedures.brouillon')}</span>}
        {moi?.role === 'ADMIN' && <> · <Link to={`/admin/procedures/${p.id}`}>{t('kiavik.procedures.modifier')}</Link></>}
      </p>
      {p.resume && <p>{p.resume}</p>}
      {p.etapes.length > 0 && (
        <div className="gx-progres" aria-label={t('kiavik.procedures.progression', { fait, n: p.etapes.length })}>
          <i style={{ width: `${(fait / p.etapes.length) * 100}%` }} />
        </div>
      )}
      <ol className="gx-etapes">
        {p.etapes.map((e, i) => {
          const lien = lienGuide(e);
          const ok = faites.includes(e.id);
          const { partie, texte } = decouperEtape(e.texte);
          const precedente = i > 0 ? decouperEtape(p.etapes[i - 1].texte).partie : null;
          return (
            <Fragment key={e.id}>
            {partie && partie !== precedente && <li className="gx-partie" aria-hidden="true"><h4>{partie}</h4></li>}
            <li className={`carte gx-etape-carte ${ok ? 'fait' : ''}`}>
              <button type="button" className="gx-coche" aria-pressed={ok} aria-label={t('kiavik.procedures.etapeFaite', { n: i + 1 })} onClick={() => basculer(e.id)}>
                {ok ? '✓' : i + 1}
              </button>
              <div className="gx-etape-corps">
                <p>{texte}</p>
                {e.avertissement && <div className="gx-warn">⚠️ {e.avertissement}</div>}
                {e.photo && <ImageApi chemin={e.photo} className="gx-etape-photo" onClick={() => setGrand(e.photo)} />}
                {lien && (
                  <Link to={lien} className="btn petit gx-voir">
                    {e.pastille ? t('kiavik.procedures.voirBoutonId', { id: e.pastille }) : t('kiavik.procedures.voirBouton')}
                  </Link>
                )}
              </div>
            </li>
            </Fragment>
          );
        })}
      </ol>
      {fait > 0 && (
        <button type="button" className="btn petit" onClick={() => setFaites([])}>{t('kiavik.procedures.recommencer')}</button>
      )}
      {grand && (
        <div className="gx-plein" onClick={() => setGrand(null)}>
          <ImageApi chemin={grand} />
        </div>
      )}
    </div>
  );
}
