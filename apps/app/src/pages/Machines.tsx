import { useEffect, useState } from 'react';
import { Chargement, Erreur } from '../components/Composants';
import { api, Fabricant, MaMachine } from '../lib/api';

export default function Machines() {
  const [mes, setMes] = useState<MaMachine[]>();
  const [catalogue, setCatalogue] = useState<Fabricant[]>([]);
  const [varianteId, setVariante] = useState('');
  const [surnom, setSurnom] = useState('');
  const [err, setErr] = useState<unknown>();

  const charger = () => api<MaMachine[]>('/moi/machines').then(setMes).catch(setErr);
  useEffect(() => {
    charger();
    api<Fabricant[]>('/catalogue').then(setCatalogue).catch(setErr);
  }, []);

  const ajouter = async () => {
    setErr(undefined);
    try {
      await api('/moi/machines', { method: 'POST', json: { varianteId, surnom: surnom || undefined } });
      setVariante('');
      setSurnom('');
      charger();
    } catch (e) {
      setErr(e);
    }
  };

  const retirer = async (m: MaMachine) => {
    if (!confirm(`Retirer « ${m.surnom || m.nom} » ? Les fiches sont conservées.`)) return;
    await api(`/moi/machines/${m.id}`, { method: 'DELETE' }).catch(setErr);
    charger();
  };

  return (
    <div className="page">
      <h1>Mes machines</h1>
      {!mes ? (
        <Chargement />
      ) : (
        <div className="liste">
          {mes.length === 0 && <p className="muted">Aucune machine. Ajoutez la vôtre ci-dessous.</p>}
          {mes.map((m) => (
            <div key={m.id} className="carte ligne-machine">
              <div>
                <b>{m.surnom || m.nom}</b>
                {m.surnom && <div className="muted petit">{m.nom}</div>}
              </div>
              <button type="button" className="btn petit" onClick={() => retirer(m)}>Retirer</button>
            </div>
          ))}
        </div>
      )}

      <h2>Ajouter une machine</h2>
      <div className="form">
        <label>
          Modèle
          <select value={varianteId} onChange={(e) => setVariante(e.target.value)}>
            <option value="">Choisir dans le catalogue…</option>
            {catalogue.flatMap((f) =>
              f.modeles.flatMap((mo) =>
                mo.variantes.map((v) => <option key={v.id} value={v.id}>{`${f.nom} ${mo.nom} ${v.nom}`}</option>),
              ),
            )}
          </select>
        </label>
        <label>
          Surnom (facultatif)
          <input value={surnom} maxLength={60} onChange={(e) => setSurnom(e.target.value)} placeholder="ex. Atelier, Camion 2" />
        </label>
        <button type="button" className="btn prim" disabled={!varianteId} onClick={ajouter}>Ajouter</button>
        <p className="muted petit">Votre machine n'est pas dans la liste ? Contactez-nous pour l'ajouter.</p>
      </div>
      <Erreur e={err} />
    </div>
  );
}
