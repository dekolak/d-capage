import { useEffect, useState } from 'react';
import { Erreur } from '../components/Composants';
import { api, Moi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';

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
      <h1>{deja ? 'Nos conditions évoluent' : `Bienvenue${moi?.nom ? ', ' + moi.nom : ''} 👋`}</h1>
      <p className="muted">
        {deja ? 'Merci de les lire et de les accepter pour continuer.' : communaute ? 'Avant de commencer, le principe de l\'application en deux mots.' : 'Avant de commencer, merci de lire et d\'accepter les conditions d\'utilisation.'}
      </p>

      {communaute && <>
      <div className="echange">
        <div><b>📸</b><span>Vous partagez</span><small>vos réglages et vos photos</small></div>
        <div className="fleche">⇄</div>
        <div><b>🤝</b><span>Vous accédez</span><small>à ceux de toute la communauté</small></div>
      </div>
      <p className="petit">
        La communauté fonctionne sur l'échange : vos fiches (réglages, photos, notes et commentaires) sont visibles par les autres
        utilisateurs {espace.nom}. C'est ce qui vous donne accès aux leurs.
      </p>
      </>}

      <button type="button" className="btn-lien petit" onClick={() => setLire(!lire)}>
        {lire ? 'Masquer les conditions' : 'Lire les conditions d\'utilisation'}
      </button>
      {lire && cond && <div className="texte-conditions">{cond.texte}</div>}

      <label className="interrupteur choix-accord obligatoire">
        <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
        <span>
          J'accepte les conditions d'utilisation{communaute && <>, dont <b>le partage de mes réglages et de mes photos avec la communauté</b></>}.
        </span>
      </label>
      {communaute && <label className="interrupteur choix-accord">
        <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
        <span>
          <b>Facultatif :</b> j'accepte aussi que {espace.nom} réutilise mes photos (site, réseaux sociaux, documentation).
          <small className="muted"> Modifiable à tout moment dans votre compte.</small>
        </span>
      </label>}
      <Erreur e={err} />
      <button type="button" className="btn prim large" disabled={!accepte || !cond} onClick={valider}>
        {deja ? 'Accepter et continuer' : 'Commencer'}
      </button>
      <button type="button" className="btn-lien petit" style={{ marginTop: 14 }} onClick={deconnexion}>Se déconnecter</button>
    </div>
  );
}
