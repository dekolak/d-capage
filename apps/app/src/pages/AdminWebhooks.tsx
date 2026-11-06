import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { api } from '../lib/api';
import { date } from '../lib/util';

interface Webhook { id: string; nom: string; url: string; evenements: string[]; actif: boolean; createdAt: string }
interface Livraison { id: string; evenement: string; statut: string; tentatives: number; dernierCode: number | null; derniereErreur: string | null; createdAt: string }

const NOMS: Record<string, string> = {
  'fiche.creee': 'Nouvelle fiche', 'fiche.modifiee': 'Fiche modifiée', 'avis.publie': 'Nouvel avis', 'avis.modifie': 'Avis modifié', 'aide.demandee': 'Demande d\'aide',
};

/**
 * Envoi automatique des publications vers un service externe (ex. modération par IA).
 * Le service reçoit un POST JSON signé et peut masquer un avis ou une fiche via l'API avec une clé API.
 */
export default function AdminWebhooks() {
  const [liste, setListe] = useState<Webhook[]>([]);
  const [evts, setEvts] = useState<string[]>([]);
  const [f, setF] = useState({ nom: '', url: '', evenements: [] as string[] });
  const [secret, setSecret] = useState('');
  const [journal, setJournal] = useState<{ id: string; l: Livraison[] } | null>(null);
  const [err, setErr] = useState<unknown>();

  const charger = () => api<Webhook[]>('/admin/webhooks').then(setListe).catch(setErr);
  useEffect(() => {
    charger();
    api<string[]>('/admin/webhooks/evenements').then(setEvts).catch(setErr);
  }, []);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    setErr(undefined);
    try {
      const r = await api<{ secret: string }>('/admin/webhooks', { method: 'POST', json: f });
      setSecret(r.secret);
      setF({ nom: '', url: '', evenements: [] });
      charger();
    } catch (x) {
      setErr(x);
    }
  };

  const voir = async (id: string, tester = false) => {
    const l = await api<Livraison[]>(`/admin/webhooks/${id}/${tester ? 'test' : 'livraisons'}`, { method: tester ? 'POST' : 'GET' }).catch((x) => {
      setErr(x);
      return null;
    });
    if (l) setJournal({ id, l });
  };

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Envoi vers une API</h1>
      <p className="muted petit">
        Chaque nouvelle fiche ou nouvel avis peut être envoyé automatiquement à un service externe (par exemple une IA de modération).
        Ce service peut ensuite masquer un contenu avec une clé API : <code>PATCH /api/admin/avis/:id</code> ou <code>PATCH /api/admin/fiches/:id</code>.
      </p>
      <Erreur e={err} />

      <h2>Ajouter un envoi</h2>
      <form className="form" onSubmit={creer}>
        <label>Nom<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="ex. Modération IA" required /></label>
        <label>Adresse (URL)<input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" required /></label>
        <div>
          <b className="petit">Événements</b> <span className="muted petit">(aucun coché = tous)</span>
          <div className="puces">
            {evts.map((x) => (
              <button key={x} type="button" className={'puce' + (f.evenements.includes(x) ? ' on' : '')}
                onClick={() => setF({ ...f, evenements: f.evenements.includes(x) ? f.evenements.filter((y) => y !== x) : [...f.evenements, x] })}>
                {NOMS[x] ?? x}
              </button>
            ))}
          </div>
        </div>
        <button className="btn prim">Ajouter</button>
      </form>
      {secret && (
        <div className="succes">
          Secret de signature (copiez-le maintenant) : <code className="cle">{secret}</code>
          Chaque envoi porte l'en-tête <code>X-Decapage-Signature: sha256=…</code> (HMAC du corps avec ce secret).
        </div>
      )}

      <h2>Envois configurés</h2>
      <div className="liste">
        {liste.length === 0 && <p className="muted">Aucun pour l'instant.</p>}
        {liste.map((w) => (
          <div key={w.id} className={'carte' + (w.actif ? '' : ' inactif')}>
            <div className="avis-h">
              <span><b>{w.nom}</b> <span className="muted petit">{w.url}</span></span>
              <span className="actions-avis">
                <button type="button" className="btn petit" onClick={() => voir(w.id, true)}>Tester</button>
                <button type="button" className="btn petit" onClick={() => voir(w.id)}>Journal</button>
                <button type="button" className="btn petit" onClick={async () => { await api(`/admin/webhooks/${w.id}`, { method: 'PATCH', json: { actif: !w.actif } }); charger(); }}>
                  {w.actif ? 'Désactiver' : 'Activer'}
                </button>
                <button type="button" className="btn petit danger" onClick={async () => { if (confirm('Supprimer cet envoi ?')) { await api(`/admin/webhooks/${w.id}`, { method: 'DELETE' }); charger(); } }}>
                  Supprimer
                </button>
              </span>
            </div>
            <div className="muted petit">{w.evenements.length ? w.evenements.map((x) => NOMS[x] ?? x).join(' · ') : 'Tous les événements'}</div>
            {journal?.id === w.id && (
              <div className="sous-bloc">
                {journal.l.length === 0 && <p className="muted petit">Aucun envoi.</p>}
                {journal.l.map((l) => (
                  <div key={l.id} className="petit">
                    <b className={l.statut === 'ENVOYE' ? 'ok' : l.statut === 'ECHEC' ? 'ko' : ''}>{l.statut === 'ENVOYE' ? '✓' : l.statut === 'ECHEC' ? '✗' : '…'}</b>{' '}
                    {NOMS[l.evenement] ?? l.evenement} · {date(l.createdAt)} · {l.tentatives} essai{l.tentatives > 1 ? 's' : ''}
                    {l.derniereErreur ? ` · ${l.derniereErreur}` : l.dernierCode ? ` · HTTP ${l.dernierCode}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
