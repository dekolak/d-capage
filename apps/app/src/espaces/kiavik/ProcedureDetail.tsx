import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CaptureBouton } from './CaptureBouton';
import { useAvancement } from './avancement';
import { AideNon, OuiNon } from './Controle';
import { FinDiagnostic } from './FinDiagnostic';
import { Galerie } from './Galerie';
import { estDiagnostic, Etape, lienGuide, Procedure, useSolutions } from './donneesProcedures';
import { ParcoursGuide } from './ParcoursGuide';
import './guides.css';
import { t } from '../../lib/i18n';

/** « Partie — texte » : l'étape se range sous le titre « Partie » (ex. « Montage — Vérifier la courroie »). */
export function decouperEtape(texte: string): { partie: string | null; texte: string } {
  const m = /^(.{2,40}?)\s+—\s+([\s\S]+)$/.exec(texte);
  return m ? { partie: m[1].trim(), texte: m[2] } : { partie: null, texte };
}

/** Une procédure : étapes à cocher (gardées sur le téléphone), questions et détours (diagnostic), photos, « Voir le bouton ». */
export default function ProcedureDetail() {
  const { id = '' } = useParams();
  const { moi } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<Procedure>();
  const [erreur, setErreur] = useState<unknown>();
  const [vue, setVue] = useState<Etape | null>(null); // « Voir le bouton » sans quitter la liste
  const [parcours, setParcours] = useState(false);
  const av = useAvancement(p, id);

  useEffect(() => {
    api<Procedure>(`/procedures/${id}`).then(setP).catch(setErreur);
  }, [id]);

  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/procedures">{t('kiavik.procedures.retourListe')}</Link></div>;
  if (!p) return <Chargement />;
  const diagnostic = estDiagnostic(p);
  const { pas, fin } = av.chemin;
  const fait = av.nbFaites;
  const total = diagnostic ? Math.max(pas.length, 1) : p.etapes.length;
  const commence = fait > 0 || Object.keys(av.reponses).length > 0;

  return (
    <div className="page gx">
      <button type="button" className="btn-lien" onClick={() => nav(-1)}>{t('kiavik.procedures.retour')}</button>
      <h1 className="gx-proc-titre">{p.titre}</h1>
      <p className="muted petit">
        {diagnostic && p.categorie !== 'Diagnostic' && <span className="dg-badge">{t('kiavik.diagnostic.badge')}</span>}
        {p.categorie}
        {!p.publiee && <span className="gx-brouillon">{t('kiavik.procedures.brouillon')}</span>}
        {moi?.role === 'ADMIN' && <> · <Link to={`/admin/procedures/${p.id}`}>{t('kiavik.procedures.modifier')}</Link></>}
      </p>
      {p.resume && <p>{p.resume}</p>}
      {p.etapes.length > 0 && (
        <button type="button" className="btn prim large pg-lancer" onClick={() => setParcours(true)}>
          {commence && !(fin && fin.type !== 'termine') && fait < total
            ? t('kiavik.parcours.reprendre')
            : diagnostic ? t('kiavik.diagnostic.demarrer') : t('kiavik.parcours.demarrer')}
        </button>
      )}
      {p.etapes.length > 0 && !diagnostic && (
        <div className="gx-progres" aria-label={t('kiavik.procedures.progression', { fait, n: total })}>
          <i style={{ width: `${(fait / total) * 100}%` }} />
        </div>
      )}
      <ol className="gx-etapes">
        {pas.map(({ e, profondeur, principal }, i) => {
          const lien = lienGuide(e);
          const question = e.choix.length > 0;
          const reponse = question ? e.choix.find((c) => c.id === av.reponses[e.id]) : undefined;
          const ok = av.faites.includes(e.id) || !!reponse;
          const estNon = e.controle && av.non.includes(e.id);
          const { partie, texte } = decouperEtape(e.texte);
          const precedente = i > 0 && pas[i - 1].profondeur === 0 ? decouperEtape(pas[i - 1].e.texte).partie : null;
          const astuceChoix = reponse?.solutionId;
          return (
            <Fragment key={`${e.id}-${i}`}>
            {profondeur === 0 && partie && partie !== precedente && <li className="gx-partie" aria-hidden="true"><h4>{partie}</h4></li>}
            <li
              className={`carte gx-etape-carte ${ok ? 'fait' : ''} ${estNon ? 'non' : ''} ${question ? 'dg-question' : ''} ${profondeur ? 'dg-detour' : ''}`}
              style={profondeur ? { marginLeft: `${Math.min(profondeur, 3) * 16}px` } : undefined}
            >
              {question ? (
                <span className="gx-coche dg-coche" aria-hidden="true">{reponse ? '✓' : '?'}</span>
              ) : (
                <button type="button" className="gx-coche" aria-pressed={ok} aria-label={t('kiavik.procedures.etapeFaite', { n: principal + 1 })}
                  onClick={() => (e.controle ? av.controler(e.id, !ok) : av.basculer(e.id))}>
                  {ok ? '✓' : estNon ? '✕' : profondeur ? '•' : principal + 1}
                </button>
              )}
              <div className="gx-etape-corps">
                {profondeur > 0 && <small className="dg-etiquette">{t('kiavik.diagnostic.verification')}</small>}
                <p className={e.controle || question ? 'gx-question' : undefined}>{texte}</p>
                {e.avertissement && <div className="gx-warn">⚠️ {e.avertissement}</div>}
                {e.controle && <OuiNon oui={ok} non={estNon} onOui={() => av.controler(e.id, true)} onNon={() => av.controler(e.id, false)} />}
                {estNon && <AideNon e={e} />}
                {question && (
                  <div className="dg-choix">
                    {e.choix.map((c) => (
                      <button key={c.id} type="button" className={`btn ${reponse?.id === c.id ? 'choisi' : ''}`} aria-pressed={reponse?.id === c.id} onClick={() => av.repondre(e.id, c.id)}>
                        {c.libelle}
                      </button>
                    ))}
                  </div>
                )}
                {astuceChoix && <LienAstuce id={astuceChoix} />}
                <Galerie photos={e.photos} />
                {lien && (
                  <button type="button" className="btn petit gx-voir" onClick={() => setVue(e)}>
                    {e.pastille ? t('kiavik.procedures.voirBoutonId', { id: e.pastille }) : t('kiavik.procedures.voirBouton')}
                  </button>
                )}
              </div>
            </li>
            </Fragment>
          );
        })}
      </ol>
      {diagnostic && !fin && <p className="muted petit dg-attente">{t('kiavik.diagnostic.repondre')}</p>}
      {diagnostic && fin && <FinDiagnostic p={p} av={av} />}
      {commence && (
        <button type="button" className="btn petit" onClick={av.recommencer}>{t('kiavik.procedures.recommencer')}</button>
      )}
      {vue && vue.guide && vue.ecran && (
        <div className="pv-fond" onClick={() => setVue(null)}>
          <div className="pv-fiche" role="dialog" aria-modal="true" onClick={(x) => x.stopPropagation()}>
            <button type="button" className="gx-fermer" aria-label={t('commun.fermer')} onClick={() => setVue(null)}>✕</button>
            <h3>{decouperEtape(vue.texte).texte}</h3>
            <CaptureBouton guide={vue.guide} ecran={vue.ecran} pastille={vue.pastille} />
          </div>
        </div>
      )}
      {parcours && <ParcoursGuide p={p} av={av} onFermer={() => setParcours(false)} />}
    </div>
  );
}

/** Astuce liée à la réponse choisie. */
function LienAstuce({ id }: { id: string }) {
  const { liste } = useSolutions();
  const s = liste?.find((x) => x.id === id);
  return s ? <Link to={`/solutions/${s.id}`} className="btn petit">💡 {s.titre}</Link> : null;
}
