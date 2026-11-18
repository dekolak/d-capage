import { useEffect, useState } from 'react';
import { Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { date } from '../../lib/util';

/* Admin (en français) : envoyer un pas-à-pas à un client par le n° court de sa machine (621, L621…). */

interface MachineTrouvee { id: string; numero: number; nom: string; surnom: string | null; numeroSerie: string | null; client: { nom: string | null; identifiant: string } }
interface Envoi { id: string; client: string; machine: { numero: number | null; nom: string }; message: string | null; creeLe: string; ouvertLe: string | null; termineLe: string | null }

/** Bloc « 📤 Envoyer à un client » : n° → vérification du client → petit mot → envoyer ; liste des envois (ouvert, terminé). */
export function EnvoyerPasAPas({ procedureId, publiee }: { procedureId: string; publiee?: boolean }) {
  const [numero, setNumero] = useState('');
  const [machine, setMachine] = useState<MachineTrouvee | null>(null);
  const [message, setMessage] = useState('');
  const [err, setErr] = useState<unknown>();
  const [ok, setOk] = useState('');
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const charger = () => api<Envoi[]>(`/admin/procedures/${procedureId}/envois`).then(setEnvois).catch(() => {});
  useEffect(() => {
    charger();
  }, [procedureId]);
  // client du n° tapé (vérification avant d'envoyer)
  useEffect(() => {
    setMachine(null);
    setErr(undefined);
    const n = numero.replace(/\D/g, '');
    if (n.length < 3) return;
    const h = setTimeout(() => api<MachineTrouvee>(`/admin/machines/numero/${n}`).then(setMachine).catch(setErr), 300);
    return () => clearTimeout(h);
  }, [numero]);
  const envoyer = async () => {
    if (!machine) return;
    try {
      await api(`/admin/procedures/${procedureId}/envoyer`, { method: 'POST', json: { numero: String(machine.numero), message: message.trim() || undefined } });
      setOk(`✓ Envoyé à ${machine.client.nom || machine.client.identifiant} (n° ${machine.numero})`);
      setNumero('');
      setMessage('');
      charger();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="carte form env">
      <b>📤 Envoyer à un client</b>
      <small className="muted">Tapez le n° de sa machine (affiché dans son app, « Ma machine »). Il reçoit ce pas-à-pas à l'ouverture de l'app{publiee === false ? ', même non publié' : ''}.</small>
      <input value={numero} inputMode="numeric" placeholder="N° de la machine, ex. 621" onChange={(e) => { setNumero(e.target.value); setOk(''); }} />
      {machine && (
        <div className="succes env-client">
          👤 <b>{machine.client.nom || machine.client.identifiant}</b> · {machine.surnom || machine.nom}{machine.numeroSerie ? ` · n° de série ${machine.numeroSerie}` : ''}
        </div>
      )}
      {machine && <input value={message} maxLength={500} placeholder="Petit mot (facultatif), ex. Voilà pour les filtres" onChange={(e) => setMessage(e.target.value)} />}
      <Erreur e={err} />
      {ok && <p className="succes">{ok}</p>}
      <button type="button" className="btn prim" disabled={!machine} onClick={envoyer}>📤 Envoyer</button>
      {envois.length > 0 && (
        <details>
          <summary className="petit">Déjà envoyé à {envois.length} client{envois.length > 1 ? 's' : ''}</summary>
          <ul className="env-liste">
            {envois.map((e) => (
              <li key={e.id} className="petit">
                {date(e.creeLe)} · <b>{e.client}</b> (n° {e.machine.numero}) · {e.termineLe ? '✅ terminé' : e.ouvertLe ? '👁 ouvert' : '⏳ pas encore ouvert'}
                {e.message && <span className="muted"> · « {e.message} »</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
