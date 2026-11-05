import { useEffect, useState } from 'react';
import type { Indicateur } from '@decapage/machine-kit';
import { GroupeTag, PhotoRef, urlPhoto } from '../lib/api';

export function Etoiles({ note, onChange, taille = 26 }: { note: number | null; onChange?: (n: number) => void; taille?: number }) {
  return (
    <span className="etoiles" style={{ fontSize: taille }} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          className={note !== null && n <= Math.round(note) ? 'on' : ''}
          onClick={() => onChange?.(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function NoteResume({ moyenne, nombre }: { moyenne: number | null; nombre: number }) {
  if (!nombre) return <span className="muted">pas encore noté</span>;
  return (
    <span className="note-resume">
      <Etoiles note={moyenne} taille={16} /> {moyenne?.toFixed(1)} <span className="muted">({nombre})</span>
    </span>
  );
}

export function ImageProtegee({ id, min, className, onClick }: { id: string; min?: boolean; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let vivant = true;
    urlPhoto(id, min).then((u) => vivant && setSrc(u)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [id, min]);
  return src ? <img src={src} className={className} onClick={onClick} alt="" /> : <div className={'img-vide ' + (className ?? '')} />;
}

export const LIBELLE_PHOTO = { AVANT: 'Avant', APRES: 'Après', INTERFACE: 'Écran machine', AUTRE: 'Autre' } as const;

export function Galerie({ photos, onSupprimer }: { photos: PhotoRef[]; onSupprimer?: (p: PhotoRef) => void }) {
  const [grand, setGrand] = useState<string | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="galerie">
        {photos.map((p) => (
          <figure key={p.id}>
            <ImageProtegee id={p.id} min onClick={() => setGrand(p.id)} />
            <figcaption>{LIBELLE_PHOTO[p.type]}</figcaption>
            {onSupprimer && (
              <button type="button" className="suppr" onClick={() => onSupprimer(p)} aria-label="Supprimer la photo">×</button>
            )}
          </figure>
        ))}
      </div>
      {grand && (
        <div className="visionneuse" onClick={() => setGrand(null)}>
          <ImageProtegee id={grand} />
        </div>
      )}
    </>
  );
}

export function Indicateurs({ liste }: { liste: Indicateur[] }) {
  if (!liste.length) return null;
  return (
    <div className="indicateurs">
      {liste.map((i) => (
        <div key={i.key}>
          <small>{i.label}{i.hypothese ? ' *' : ''}</small>
          <b>
            {i.valeur} {i.unite}
          </b>
          {i.note && <em>{i.note}</em>}
        </div>
      ))}
      {liste.some((i) => i.hypothese) && <p className="note-hyp">* dépend d'une valeur supposée (taille du spot), à confirmer.</p>}
    </div>
  );
}

/**
 * Choix des tags : une liste déroulante par groupe (Matériau, À enlever, Application).
 * Plusieurs tags possibles par groupe ; « Autre… » permet d'en proposer un nouveau.
 */
export function ChoixTags({
  groupes,
  choisis,
  onChange,
  onProposer,
}: {
  groupes: GroupeTag[];
  choisis: string[];
  onChange(ids: string[]): void;
  onProposer?: (groupeId: string, nom: string) => Promise<void>;
}) {
  const AUTRE = '__autre__';
  return (
    <div className="choix-tags">
      {groupes.map((g) => {
        const pris = g.tags.filter((t) => choisis.includes(t.id));
        const libres = g.tags.filter((t) => !choisis.includes(t.id));
        return (
          <div key={g.id} className="groupe-tags">
            <label className="champ-tag">
              <span>{g.nom}</span>
              <select
                value=""
                onChange={async (e) => {
                  const v = e.target.value;
                  if (v === AUTRE) {
                    const nom = prompt(`Nouveau choix dans « ${g.nom} »`)?.trim();
                    if (nom && nom.length >= 2 && onProposer) await onProposer(g.id, nom);
                  } else if (v) onChange([...choisis, v]);
                }}
              >
                <option value="">{pris.length ? '+ Ajouter…' : 'Choisir…'}</option>
                {libres.map((t) => (
                  <option key={t.id} value={t.id}>{t.nom}</option>
                ))}
                {onProposer && <option value={AUTRE}>Autre…</option>}
              </select>
            </label>
            {pris.length > 0 && (
              <div className="puces">
                {pris.map((t) => (
                  <button key={t.id} type="button" className="puce on" onClick={() => onChange(choisis.filter((x) => x !== t.id))} aria-label={`Retirer ${t.nom}`}>
                    {t.nom} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Chargement() {
  return <div className="chargement">Chargement…</div>;
}

export function Erreur({ e }: { e: unknown }) {
  if (!e) return null;
  return <div className="alerte">{e instanceof Error ? e.message : String(e)}</div>;
}
