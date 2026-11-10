import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';

export default function Compte() {
  const { moi, deconnexion, rafraichir } = useAuth();
  const { espace, espaces, choisir } = useEspace();
  const mesEspaces = espaces.filter((e) => moi?.espaces.some((x) => x.slug === e.slug));
  const reglages = espace.modules.some((m) => m.slug === 'reglages-decapage');
  const [accord, setAccord] = useState(!!moi?.accordPhotosMarketing);
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<unknown>();

  const changer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    setOk(false);
    try {
      await api('/moi/mot-de-passe', { method: 'POST', json: { ancien, nouveau } });
      setOk(true);
      setAncien('');
      setNouveau('');
    } catch (x) {
      setErr(x);
    }
  };

  return (
    <div className="page">
      <h1>Compte</h1>
      <p>
        <b>{moi?.nom || moi?.identifiant}</b> <span className="muted">({moi?.identifiant})</span>
      </p>
      <div className="actions">
        {reglages && <Link to="/machines" className="btn">Mes machines</Link>}
        {moi?.role === 'ADMIN' && <Link to="/admin" className="btn">Administration</Link>}
      </div>

      {mesEspaces.length > 1 && (
        <>
          <h2>Mes espaces</h2>
          <div className="espaces-choix">
            {mesEspaces.map((e) => (
              <button
                key={e.slug}
                type="button"
                className={'espace-choix' + (e.slug === espace.slug ? ' actif' : '')}
                style={{ ['--c' as string]: e.couleur }}
                onClick={() => choisir(e.slug)}
              >
                <img src={`${e.icones}icone.svg`} alt="" width={36} height={36} />
                <span><b>{e.nomApp}</b><small>{e.slug === espace.slug ? 'Ouvert' : 'Ouvrir'}</small></span>
              </button>
            ))}
          </div>
        </>
      )}

      {espace.communaute && <>
      <h2>Mes photos</h2>
      <div className="carte">
        <label className="interrupteur choix-accord" style={{ boxShadow: 'none', padding: 0 }}>
          <input
            type="checkbox"
            checked={accord}
            onChange={async (e) => {
              const v = e.target.checked;
              setAccord(v); // affichage immédiat
              try {
                await rafraichir(await api('/moi/preferences', { method: 'PATCH', json: { accordPhotosMarketing: v } }));
              } catch (x) {
                setAccord(!v);
                setErr(x);
              }
            }}
          />
          <span>
            J'accepte que {espace.nom} réutilise mes photos (site, réseaux sociaux, documentation).
            <small className="muted"> Facultatif. Vos photos restent partagées avec la communauté dans tous les cas.</small>
          </span>
        </label>
        <Link to="/conditions" className="lien petit">Lire les conditions d'utilisation ›</Link>
      </div>
      </>}
      {!espace.communaute && <p><Link to="/conditions" className="lien petit">Lire les conditions d'utilisation ›</Link></p>}

      <h2>Changer de mot de passe</h2>
      <form className="form" onSubmit={changer}>
        <label>
          Mot de passe actuel
          <input type="password" autoComplete="current-password" value={ancien} onChange={(e) => setAncien(e.target.value)} required />
        </label>
        <label>
          Nouveau (8 caractères min.)
          <input type="password" autoComplete="new-password" minLength={8} value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
        </label>
        {ok && <div className="succes">Mot de passe modifié.</div>}
        <Erreur e={err} />
        <button className="btn prim">Modifier</button>
      </form>

      <button type="button" className="btn danger large" onClick={deconnexion}>Se déconnecter</button>
    </div>
  );
}
