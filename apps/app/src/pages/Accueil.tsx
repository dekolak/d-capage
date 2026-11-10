import { useEffect, useState } from 'react';
import { Erreur } from '../components/Composants';
import { api, Moi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t, tr } from '../lib/i18n';

/**
 * Écran d'accueil à la première ouverture d'un espace (et à chaque nouvelle version de ses conditions).
 * Espace avec communauté (Lazzeko) : partage obligatoire (c'est le principe), réutilisation des photos facultative.
 * Espace sans communauté (Kiavik) : simple acceptation des conditions.
 */
export default function Accueil() {
  const { moi, rafraichir, deconnexion } = useAuth();
  const { espace } = useEspace();
  const communaute = espace.communaute;
  const [cond, setCond] = useState<{ version: number; texte: string }>();
  const [accepte, setAccepte] = useState(false);
  const [marketing, setMarketing] = useState(moi?.accordPhotosMarketing ?? false);
  const [lire, setLire] = useState(false);
  const [err, setErr] = useState<unknown>();
  const deja = !!moi?.conditions[espace.slug]; // nouvelle version après une première acceptation

  useEffect(() => {
    api<{ version: number; texte: string }>(`/conditions?espace=${espace.slug}`).then(setCond).catch(setErr);
  }, [espace.slug]);

  const valider = async () => {
    if (!cond) return;
    try {
      await rafraichir(await api<Moi>('/moi/conditions', { method: 'POST', json: { espace: espace.slug, version: cond.version, ...(communaute ? { accordPhotosMarketing: marketing } : {}) } }));
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <div className="accueil">
      <img src={`${espace.icones}icone.svg`} alt="" width={64} height={64} />
      <h1>{deja ? t('accueil.titreMaj') : moi?.nom ? t('accueil.bienvenueNom', { nom: moi.nom }) : t('accueil.bienvenue')}</h1>
      <p className="muted">
        {deja ? t('accueil.texteMaj') : communaute ? t('accueil.texteCommunaute') : t('accueil.texte')}
      </p>

      {communaute && <>
      <div className="echange">
        <div><b>📸</b><span>{t('accueil.partage')}</span><small>{t('accueil.partageDetail')}</small></div>
        <div className="fleche">⇄</div>
        <div><b>🤝</b><span>{t('accueil.acces')}</span><small>{t('accueil.accesDetail')}</small></div>
      </div>
      <p className="petit">
        {t('accueil.principe', { societe: espace.nom })}
      </p>
      </>}

      <button type="button" className="btn-lien petit" onClick={() => setLire(!lire)}>
        {lire ? t('accueil.masquerConditions') : t('accueil.lireConditions')}
      </button>
      {lire && cond && <div className="texte-conditions">{cond.texte}</div>}

      <label className="interrupteur choix-accord obligatoire">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        <span>
          {tr('accueil.accepte', { suite: communaute ? tr('accueil.accepteSuite', { gras: <b>{t('accueil.accepteGras')}</b> }) : '' })}
        </span>
      </label>
      {communaute && <label className="interrupteur choix-accord">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>
          <b>{t('accueil.facultatif')}</b> {t('accueil.accordPhotos', { societe: espace.nom })}
          <small className="muted">{t('accueil.modifiable')}</small>
        </span>
      </label>}
      <Erreur e={err} />
      <button type="button" className="btn prim large" disabled={!accepte || !cond} onClick={valider}>
        {deja ? t('accueil.accepterContinuer') : t('accueil.commencer')}
      </button>
      <button type="button" className="btn-lien petit" style={{ marginTop: 14 }} onClick={deconnexion}>{t('commun.deconnexion')}</button>
    </div>
  );
}
