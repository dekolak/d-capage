import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ImageApi, lienGuide, Procedure } from './donneesProcedures';
import './guides.css';

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

  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/procedures">← Procédures</Link></div>;
  if (!p) return <Chargement />;
  const basculer = (e: string) => setFaites((f) => (f.includes(e) ? f.filter((x) => x !== e) : [...f, e]));
  const fait = p.etapes.filter((e) => faites.includes(e.id)).length;

  return (
    <div className="page gx">
      <button type="button" className="btn-lien" onClick={() => nav(-1)}>← Retour</button>
      <h1 className="gx-proc-titre">{p.titre}</h1>
      <p className="muted petit">
        {p.categorie}
        {!p.publiee && <span className="gx-brouillon">brouillon</span>}
        {moi?.role === 'ADMIN' && <> · <Link to={`/admin/procedures/${p.id}`}>Modifier</Link></>}
      </p>
      {p.resume && <p>{p.resume}</p>}
      {p.etapes.length > 0 && (
        <div className="gx-progres" aria-label={`${fait} étapes faites sur ${p.etapes.length}`}>
          <i style={{ width: `${(fait / p.etapes.length) * 100}%` }} />
        </div>
      )}
      <ol className="gx-etapes">
        {p.etapes.map((e, i) => {
          const lien = lienGuide(e);
          const ok = faites.includes(e.id);
          return (
            <li key={e.id} className={`carte gx-etape-carte ${ok ? 'fait' : ''}`}>
              <button type="button" className="gx-coche" aria-pressed={ok} aria-label={`Étape ${i + 1} faite`} onClick={() => basculer(e.id)}>
                {ok ? '✓' : i + 1}
              </button>
              <div className="gx-etape-corps">
                <p>{e.texte}</p>
                {e.avertissement && <div className="gx-warn">⚠️ {e.avertissement}</div>}
                {e.photo && <ImageApi chemin={e.photo} className="gx-etape-photo" onClick={() => setGrand(e.photo)} />}
                {lien && (
                  <Link to={lien} className="btn petit gx-voir">
                    👆 Voir le bouton{e.pastille ? ` ${e.pastille}` : ''}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {fait > 0 && (
        <button type="button" className="btn petit" onClick={() => setFaites([])}>Recommencer (tout décocher)</button>
      )}
      {grand && (
        <div className="gx-plein" onClick={() => setGrand(null)}>
          <ImageApi chemin={grand} />
        </div>
      )}
    </div>
  );
}
