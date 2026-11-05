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
  const basculer = (id: string) => onChange(choisis.includes(id) ? choisis.filter((x) => x !== id) : [...choisis, id]);
  return (
    <div className="choix-tags">
      {groupes.map((g) => (
        <div key={g.id} className="groupe-tags">
          <h4>{g.nom}</h4>
          <div className="puces">
            {g.tags.map((t) => (
              <button key={t.id} type="button" className={'puce' + (choisis.includes(t.id) ? ' on' : '')} onClick={() => basculer(t.id)}>
                {t.nom}
              </button>
            ))}
            {onProposer && (
              <button
                type="button"
                className="puce ajout"
                onClick={async () => {
                  const nom = prompt(`Nouveau tag dans « ${g.nom} »`)?.trim();
                  if (nom && nom.length >= 2) await onProposer(g.id, nom);
                }}
              >
                + autre
              </button>
            )}
          </div>
        </div>
      ))}
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
