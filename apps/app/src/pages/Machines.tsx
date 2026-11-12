import { useEffect, useState } from 'react';
import { Chargement, Erreur } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { api, MaMachine } from '../lib/api';
import { t } from '../lib/i18n';

/** Mes machines : ajoutées par l'admin (n° de série, mise en service) ; le client peut leur donner un surnom. */
export default function Machines() {
  const [mes, setMes] = useState<MaMachine[]>();
  const [edition, setEdition] = useState<string | null>(null);
  const [surnom, setSurnom] = useState('');
  const [err, setErr] = useState<unknown>();

  const charger = () => api<MaMachine[]>('/moi/machines').then(setMes).catch(setErr);
  useEffect(() => {
    charger();
  }, []);

  const renommer = async (m: MaMachine) => {
    setErr(undefined);
    try {
      await api(`/moi/machines/${m.id}`, { method: 'PATCH', json: { surnom } });
      setEdition(null);
      charger();
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <div className="page">
      <h1>{t('lazzeko.machines.titre')}</h1>
      {!mes ? (
        <Chargement />
      ) : (
        <div className="liste">
          {mes.length === 0 && <p className="muted">{t('lazzeko.machines.aucune')}</p>}
          {mes.map((m) => (
            <div key={m.id} className="carte ligne-machine">
              <MiniatureMachine url={m.imageUrl} badge={m.varianteNom} taille={56} />
              <div style={{ flex: 1 }}>
                {edition === m.id ? (
                  <div className="ba-libre">
                    <input autoFocus value={surnom} maxLength={60} onChange={(e) => setSurnom(e.target.value)} placeholder={t('lazzeko.machines.surnomExemple')} />
                    <button type="button" className="btn petit prim" onClick={() => renommer(m)}>OK</button>
                  </div>
                ) : (
                  <>
                    <b>{m.surnom || m.nom}</b>
                    {m.surnom && <div className="muted petit">{m.nom}</div>}
                    {m.numeroSerie && <div className="muted petit">{t('machines.numeroSerie', { n: m.numeroSerie })}</div>}
                  </>
                )}
              </div>
              {edition !== m.id && (
                <button type="button" className="btn petit" onClick={() => { setSurnom(m.surnom ?? ''); setEdition(m.id); }}>{t('machines.renommer')}</button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="muted petit">{t('machines.ajouteesPar')}</p>
      <Erreur e={err} />
    </div>
  );
}
