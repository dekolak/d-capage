import { useState } from 'react';
import { Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Ecran, Ensemble, Guide, mettreAJourGuide } from './guides';

/** Groupe en cours de création / modification (admin) : les boutons se cochent en les touchant sur l'écran. */
export interface EditionEnsemble { id?: string; nom: string; texte: string; mots: string; pastilles: string[] }

export const nouvelEnsemble = (): EditionEnsemble => ({ nom: '', texte: '', mots: '', pastilles: [] });
export const editionDe = (en: Ensemble): EditionEnsemble => ({
  id: en.id, nom: en.nom, texte: en.texte ?? '', mots: (en.mots_cles ?? []).join(', '), pastilles: [...en.pastilles],
});

/** Fiche d'un groupe de boutons : nom, explication, ses boutons (toucher = ouvrir la fiche du bouton). */
export function FicheEnsemble({ e, en, onBouton, onModifier, onSupprimer }: {
  e: Ecran; en: Ensemble; onBouton(id: string): void; onModifier(): void; onSupprimer(): void;
}) {
  const { moi } = useAuth();
  return (
    <>
      {moi?.role === 'ADMIN' && (
        <div className="cx-actions" style={{ marginBottom: 6 }}>
          <button type="button" className="btn petit" onClick={onModifier}>✏️ Modifier le groupe</button>
          <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer le groupe « ${en.nom} » ? (les boutons restent)`) && onSupprimer()}>🗑</button>
        </div>
      )}
      <span className="gx-ref">{e.code} · {t('kiavik.recherche.groupe', { n: en.pastilles.length })}</span>
      <h3>▦ {en.nom}</h3>
      {en.texte && <p>{en.texte}</p>}
      <div className="gx-ens-boutons">
        {en.pastilles.map((id) => {
          const p = e.pastilles.find((x) => x.id === id);
          return p ? (
            <button key={id} type="button" className="gx-item" onClick={() => onBouton(id)}>
              <b>{p.id}</b>{p.titre}
            </button>
          ) : null;
        })}
      </div>
    </>
  );
}

/** Panneau admin : nom, explication, mots-clés du groupe ; les boutons se choisissent en les touchant sur l'écran. */
export function EditeurEnsemble({ guide, e, v, onChange, onFini }: {
  guide: Guide; e: Ecran; v: EditionEnsemble; onChange(v: EditionEnsemble): void; onFini(id?: string): void;
}) {
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState(false);
  const enregistrer = async () => {
    setErr(undefined);
    setEnvoi(true);
    try {
      const base = v.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'groupe';
      const id = v.id ?? `${base}-${Date.now().toString(36)}`;
      const g = await api<Guide>(`/admin/guides/${guide.slug}/ensembles/${e.id}/${id}`, {
        method: 'PUT',
        json: { nom: v.nom, texte: v.texte || null, mots_cles: v.mots.split(',').map((m) => m.trim()).filter(Boolean), pastilles: v.pastilles },
      });
      mettreAJourGuide(g);
      onFini(id);
    } catch (x) {
      setErr(x);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="gx-ens-edition carte form">
      <b>▦ {v.id ? 'Modifier le groupe' : 'Nouveau groupe de boutons'}</b>
      <small className="muted">Touchez les boutons du groupe sur l'écran ({v.pastilles.length} choisi{v.pastilles.length > 1 ? 's' : ''} : {v.pastilles.join(', ') || '—'}).</small>
      <input value={v.nom} maxLength={60} placeholder="Nom (ex. Flèches de direction)" onChange={(x) => onChange({ ...v, nom: x.target.value })} />
      <textarea value={v.texte} maxLength={1000} rows={2} placeholder="Explication (facultatif) : à quoi sert ce groupe" onChange={(x) => onChange({ ...v, texte: x.target.value })} />
      <input value={v.mots} placeholder="🔎 Mots pour la recherche, invisibles (ex. flèches, bouger la tête)" onChange={(x) => onChange({ ...v, mots: x.target.value })} />
      <Erreur e={err} />
      <div className="cx-actions">
        <button type="button" className="btn prim" disabled={envoi || v.nom.trim().length < 2 || v.pastilles.length < 2} onClick={enregistrer}>Enregistrer</button>
        <button type="button" className="btn" onClick={() => onFini(v.id)}>Annuler</button>
      </div>
    </div>
  );
}

/** Supprimer un groupe (admin). */
export async function supprimerEnsemble(guide: Guide, e: Ecran, id: string) {
  mettreAJourGuide(await api<Guide>(`/admin/guides/${guide.slug}/ensembles/${e.id}/${id}`, { method: 'DELETE' }));
}
