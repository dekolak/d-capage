import { FormEvent, useState } from 'react';
import { Erreur } from '../components/Composants';
import { api, jeton } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useEspace } from '../lib/espace';
import { t } from '../lib/i18n';

/**
 * Première connexion avec un code provisoire (compte importé ou créé par l'admin) :
 * le client choisit son mot de passe avant tout le reste.
 */
export default function PremierMotDePasse() {
  const { moi, rafraichir, deconnexion } = useAuth();
  const { espace } = useEspace();
  const [nouveau, setNouveau] = useState('');
  const [confirme, setConfirme] = useState('');
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState(false);
  const pareil = nouveau === confirme;
  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (!pareil) return;
    setErr(undefined);
    setEnvoi(true);
    try {
      const r = await api<{ jeton: string }>('/moi/premier-mot-de-passe', { method: 'POST', json: { nouveau } });
      jeton.set(r.jeton);
      await rafraichir();
    } catch (x) {
      setErr(x);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="connexion">
      <img src={`${espace.icones}icone.svg`} alt="" width={72} height={72} />
      <h1>{t('premierMdp.titre')}</h1>
      <p className="muted">{t('premierMdp.texte', { nom: moi?.nom || moi?.identifiant || '' })}</p>
      <form onSubmit={valider} className="form">
        <label>
          {t('premierMdp.nouveau')}
          <input type="password" autoComplete="new-password" minLength={8} value={nouveau} onChange={(e) => setNouveau(e.target.value)} required />
        </label>
        <label>
          {t('premierMdp.confirmer')}
          <input type="password" autoComplete="new-password" minLength={8} value={confirme} onChange={(e) => setConfirme(e.target.value)} required />
        </label>
        {!pareil && confirme && <div className="alerte">{t('premierMdp.different')}</div>}
        <Erreur e={err} />
        <button className="btn prim large" disabled={envoi || nouveau.length < 8 || !pareil}>{t('premierMdp.valider')}</button>
        <button type="button" className="btn-lien petit" onClick={deconnexion}>{t('commun.deconnexion')}</button>
      </form>
    </div>
  );
}
