import { useEffect, useState } from 'react';
import { Erreur } from '../components/Composants';
import { api } from '../lib/api';
import { date } from '../lib/util';

/* Admin (en français) : envoyer un pas-à-pas à un client par son n° client court (621, L621…), affiché en haut à droite de son app. */

interface ClientTrouve { id: string; numero: number; nom: string | null; identifiant: string; numeroOdoo: string | null; machines: string[] }
interface Envoi { id: string; client: string; numero: number | null; message: string | null; creeLe: string; ouvertLe: string | null; termineLe: string | null }

/** Bloc « 📤 Envoyer à un client » : n° → vérification du client → petit mot → envoyer ; liste des envois (ouvert, terminé). */
export function EnvoyerPasAPas({ procedureId, publiee }: { procedureId: string; publiee?: boolean }) {
  const [numero, setNumero] = useState('');
  const [client, setClient] = useState<ClientTrouve | null>(null);
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
    setClient(null);
    setErr(undefined);
    const n = numero.replace(/\D/g, '');
    if (n.length < 3) return;
    const h = setTimeout(() => api<ClientTrouve>(`/admin/clients/numero/${n}`).then(setClient).catch(setErr), 300);
    return () => clearTimeout(h);
  }, [numero]);
  const envoyer = async () => {
    if (!client) return;
    try {
      await api(`/admin/procedures/${procedureId}/envoyer`, { method: 'POST', json: { numero: String(client.numero), message: message.trim() || undefined } });
      setOk(`✓ Envoyé à ${client.nom || client.identifiant} (n° ${client.numero})`);
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
      <small className="muted">Tapez son n° client (en haut à droite de son app). Il reçoit ce pas-à-pas à l'ouverture de l'app{publiee === false ? ', même non publié' : ''}.</small>
      <input value={numero} inputMode="numeric" placeholder="N° client, ex. 621" onChange={(e) => { setNumero(e.target.value); setOk(''); }} />
      {client && (
        <div className="succes env-client">
          👤 <b>{client.nom || client.identifiant}</b>{client.numeroOdoo ? ` · Odoo ${client.numeroOdoo}` : ''}
          {client.machines.length > 0 && <><br /><small>🔧 {client.machines.join(', ')}</small></>}
        </div>
      )}
      {client && <input value={message} maxLength={500} placeholder="Petit mot (facultatif), ex. Voilà pour les filtres" onChange={(e) => setMessage(e.target.value)} />}
      <Erreur e={err} />
      {ok && <p className="succes">{ok}</p>}
      <button type="button" className="btn prim" disabled={!client} onClick={envoyer}>📤 Envoyer</button>
      {envois.length > 0 && (
        <details>
          <summary className="petit">Déjà envoyé à {envois.length} client{envois.length > 1 ? 's' : ''}</summary>
          <ul className="env-liste">
            {envois.map((e) => (
              <li key={e.id} className="petit">
                {date(e.creeLe)} · <b>{e.client}</b>{e.numero ? ` (n° ${e.numero})` : ''} · {e.termineLe ? '✅ terminé' : e.ouvertLe ? '👁 ouvert' : '⏳ pas encore ouvert'}
                {e.message && <span className="muted"> · « {e.message} »</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
