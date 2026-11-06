import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chargement, Erreur, Etoiles } from '../components/Composants';
import { api, StatutAvis } from '../lib/api';
import { date } from '../lib/util';

interface LigneAvis {
  id: string; note: number; avis: string | null; statut: StatutAvis; moderationRaison: string | null; moderePar: string | null;
  date: string; auteur: { identifiant: string; nom: string | null }; fiche: { id: string; titre: string }; estAuteurFiche: boolean;
}

/** Admin : tous les avis, masquer ceux qui ne conviennent pas (ou valider ceux en attente). */
export default function AdminAvis() {
  const [statut, setStatut] = useState<'' | StatutAvis>('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<{ total: number; avis: LigneAvis[] }>();
  const [err, setErr] = useState<unknown>();

  const charger = () => {
    const p = new URLSearchParams({ parPage: '100', avecTexte: 'true' });
    if (statut) p.set('statut', statut);
    if (q.trim()) p.set('q', q.trim());
    return api<{ total: number; avis: LigneAvis[] }>(`/admin/avis?${p}`).then(setData).catch(setErr);
  };
  useEffect(() => {
    const h = setTimeout(charger, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut, q]);

  const changer = async (a: LigneAvis, nouveau: StatutAvis) => {
    let raison: string | null = null;
    if (nouveau === 'MASQUE') {
      raison = prompt('Raison du masquage (facultatif, visible par l\'auteur de l\'avis)');
      if (raison === null) return;
    }
    await api(`/admin/avis/${a.id}`, { method: 'PATCH', json: { statut: nouveau, raison: raison || undefined } }).catch(setErr);
    charger();
  };

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Avis</h1>
      <div className="filtres">
        <input className="recherche" placeholder="Rechercher dans les avis…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="seg">
          {([['', 'Tous'], ['VISIBLE', 'Visibles'], ['EN_ATTENTE', 'En attente'], ['MASQUE', 'Masqués']] as const).map(([v, l]) => (
            <button key={v} type="button" className={statut === v ? 'on' : ''} onClick={() => setStatut(v)}>{l}</button>
          ))}
        </div>
      </div>
      <Erreur e={err} />
      {!data ? (
        <Chargement />
      ) : (
        <>
          <p className="muted petit">{data.total} avis avec commentaire</p>
          <div className="liste">
            {data.avis.map((a) => (
              <div key={a.id} className={'carte' + (a.statut === 'MASQUE' ? ' avis-masque' : '')}>
                <div className="avis-h">
                  <span>
                    <Etoiles note={a.note} taille={14} /> <b>{a.auteur.nom || a.auteur.identifiant}</b>{' '}
                    <span className="muted petit">({a.auteur.identifiant}) · {date(a.date)}</span>
                  </span>
                  <span className="actions-avis">
                    {a.statut !== 'VISIBLE' && <button type="button" className="btn petit prim" onClick={() => changer(a, 'VISIBLE')}>{a.statut === 'EN_ATTENTE' ? 'Valider' : 'Réafficher'}</button>}
                    {a.statut !== 'MASQUE' && <button type="button" className="btn petit" onClick={() => changer(a, 'MASQUE')}>Masquer</button>}
                  </span>
                </div>
                <p className="mon-texte" style={{ margin: '6px 0' }}>{a.avis}</p>
                <div className="muted petit">
                  Sur <Link to={`/fiches/${a.fiche.id}`}>{a.fiche.titre}</Link>
                  {a.estAuteurFiche ? ' (son propre réglage)' : ''}
                </div>
                {a.statut !== 'VISIBLE' && (
                  <p className={'statut-avis ' + a.statut.toLowerCase()}>
                    {a.statut === 'EN_ATTENTE' ? 'En attente de validation' : `Masqué${a.moderePar === 'auto' ? ' automatiquement' : ''}`}
                    {a.moderationRaison ? ` : ${a.moderationRaison}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
