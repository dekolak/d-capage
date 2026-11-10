import { useEffect, useState } from 'react';
import type { Indicateur } from '@decapage/machine-kit';
import { GroupeTag, PhotoRef, urlPhoto } from '../lib/api';
import { t, tn } from '../lib/i18n';

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
          aria-label={tn('commun.etoiles', n)}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export function NoteResume({ moyenne, nombre }: { moyenne: number | null; nombre: number }) {
  if (!nombre) return <span className="muted">{t('commun.pasNote')}</span>;
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

/** Libellé d'un type de photo. */
export const libellePhoto = (type: PhotoRef['type']) => t(`commun.photo.${type}`);

export function Galerie({ photos, onSupprimer }: { photos: PhotoRef[]; onSupprimer?: (p: PhotoRef) => void }) {
  const [grand, setGrand] = useState<string | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="galerie">
        {photos.map((p) => (
          <figure key={p.id}>
            <ImageProtegee id={p.id} min onClick={() => setGrand(p.id)} />
            <figcaption>{libellePhoto(p.type)}</figcaption>
            {onSupprimer && (
              <button type="button" className="suppr" onClick={() => onSupprimer(p)} aria-label={t('commun.supprimerPhoto')}>×</button>
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
      {liste.some((i) => i.hypothese) && <p className="note-hyp">{t('commun.hypothese')}</p>}
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
        const pris = g.tags.filter((tag) => choisis.includes(tag.id));
        const libres = g.tags.filter((tag) => !choisis.includes(tag.id));
        return (
          <div key={g.id} className="groupe-tags">
            <label className="champ-tag">
              <span>{g.nom}</span>
              <select
                value=""
                onChange={async (e) => {
                  const v = e.target.value;
                  if (v === AUTRE) {
                    const nom = prompt(t('commun.tags.nouveau', { groupe: g.nom }))?.trim();
                    if (nom && nom.length >= 2 && onProposer) await onProposer(g.id, nom);
                  } else if (v) onChange([...choisis, v]);
                }}
              >
                <option value="">{pris.length ? t('commun.tags.ajouter') : t('commun.tags.choisir')}</option>
                {libres.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.nom}</option>
                ))}
                {onProposer && <option value={AUTRE}>{t('commun.tags.autre')}</option>}
              </select>
            </label>
            {pris.length > 0 && (
              <div className="puces">
                {pris.map((tag) => (
                  <button key={tag.id} type="button" className="puce on" onClick={() => onChange(choisis.filter((x) => x !== tag.id))} aria-label={t('commun.tags.retirer', { nom: tag.nom })}>
                    {tag.nom} ×
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

/** Filtres de recherche : une liste déroulante par groupe de tags (« Tous » = pas de filtre). */
export function FiltreTags({ groupes, tags, onChange }: { groupes: GroupeTag[]; tags: string[]; onChange(ids: string[]): void }) {
  return (
    <>
      {groupes.map((g) => {
        const actuel = g.tags.find((tag) => tags.includes(tag.id))?.id ?? '';
        return (
          <label key={g.id} className="champ-tag">
            <span>{g.nom}</span>
            <select
              value={actuel}
              onChange={(e) => {
                const autres = tags.filter((id) => !g.tags.some((tag) => tag.id === id));
                onChange(e.target.value ? [...autres, e.target.value] : autres);
              }}
            >
              <option value="">{t('commun.tags.tous')}</option>
              {g.tags.map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.nom}</option>
              ))}
            </select>
          </label>
        );
      })}
    </>
  );
}

export function Chargement() {
  return <div className="chargement">{t('commun.chargement')}</div>;
}

export function Erreur({ e }: { e: unknown }) {
  if (!e) return null;
  return <div className="alerte">{e instanceof Error ? e.message : String(e)}</div>;
}
