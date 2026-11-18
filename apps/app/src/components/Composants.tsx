import { useEffect, useState } from 'react';
import type { Indicateur } from '@decapage/machine-kit';
import { api, GroupeTag, PhotoRef, Tag, urlPhoto } from '../lib/api';
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
 * Choix des familles (puces) par groupe : Matériau et Application = un seul choix, À enlever = plusieurs.
 * Sous chaque groupe choisi, une précision libre facultative (ex. Aluminium → « 6082 brossé »),
 * avec les précisions déjà utilisées par d'autres en suggestion. « Autre » : la précision dit quoi.
 */
export function ChoixTags({
  groupes,
  choisis,
  onChange,
  precisions,
  onPrecisions,
}: {
  groupes: GroupeTag[];
  choisis: string[];
  onChange(ids: string[]): void;
  precisions: Record<string, string>;
  onPrecisions(p: Record<string, string>): void;
}) {
  const basculer = (g: GroupeTag, id: string) => {
    const autresGroupes = choisis.filter((x) => !g.tags.some((tag) => tag.id === x));
    const ici = choisis.filter((x) => g.tags.some((tag) => tag.id === x));
    if (ici.includes(id)) return onChange([...autresGroupes, ...ici.filter((x) => x !== id)]);
    onChange(g.choixUnique ? [...autresGroupes, id] : [...choisis, id]);
  };
  return (
    <div className="choix-tags">
      {groupes.map((g) => {
        const pris = g.tags.filter((tag) => choisis.includes(tag.id));
        return (
          <div key={g.id} className="groupe-tags">
            <b className="gt-titre">
              {g.nom} <small className="muted">{g.choixUnique ? t('commun.tags.unSeul') : t('commun.tags.plusieurs')}</small>
            </b>
            <div className="puces">
              {g.tags.map((tag) => (
                <button key={tag.id} type="button" className={`puce ${choisis.includes(tag.id) ? 'on' : ''}`} aria-pressed={choisis.includes(tag.id)} onClick={() => basculer(g, tag.id)}>
                  {tag.nom}
                </button>
              ))}
            </div>
            {pris.length > 0 && (
              <ChampPrecision
                groupe={g}
                tagId={pris[0].id}
                autre={pris.some((tag) => tag.slug === 'autre')}
                valeur={precisions[g.id] ?? ''}
                onChange={(v) => onPrecisions({ ...precisions, [g.id]: v })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Précision libre d'un groupe, avec les précisions déjà utilisées en suggestion. */
function ChampPrecision({ groupe, tagId, autre, valeur, onChange }: { groupe: GroupeTag; tagId: string; autre: boolean; valeur: string; onChange(v: string): void }) {
  const [suggestions, setSuggestions] = useState<{ texte: string; nb: number }[]>([]);
  const [actif, setActif] = useState(false);
  useEffect(() => {
    if (!actif) return;
    const h = setTimeout(() => {
      const p = new URLSearchParams({ groupeId: groupe.id, q: valeur.trim(), tagId });
      api<{ texte: string; nb: number }[]>(`/tags/precisions?${p}`).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(h);
  }, [actif, valeur, groupe.id, tagId]);
  const liste = suggestions.filter((x) => x.texte.toLowerCase() !== valeur.trim().toLowerCase());
  return (
    <div className="precision">
      <input
        value={valeur}
        maxLength={80}
        placeholder={autre ? t('commun.tags.precisezAutre') : t('commun.tags.precision')}
        aria-label={t('commun.tags.precisionDe', { groupe: groupe.nom })}
        onFocus={() => setActif(true)}
        onBlur={() => setTimeout(() => setActif(false), 200)}
        onChange={(e) => onChange(e.target.value)}
      />
      {actif && liste.length > 0 && (
        <div className="puces mini-choix">
          {liste.map((x) => (
            <button key={x.texte} type="button" className="puce" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(x.texte)}>
              {x.texte} <small className="muted">({x.nb})</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Familles d'une fiche avec leur précision : « Aluminium · 6082 brossé » (« Autre » est remplacé par la précision).
 * Une seule précision par groupe, même avec plusieurs familles (À enlever) : jointe à la première.
 */
export function libellesTags(f: { tags: Tag[]; precisions?: { groupe: string; texte: string }[] }) {
  const vus = new Set<string>();
  const l = f.tags.map((tag) => {
    const p = f.precisions?.find((x) => x.groupe === tag.groupe);
    if (!p || vus.has(p.groupe)) return { id: tag.id, nom: tag.nom };
    vus.add(p.groupe);
    return { id: tag.id, nom: tag.slug === 'autre' ? p.texte : `${tag.nom} · ${p.texte}` };
  });
  for (const p of f.precisions ?? []) if (!vus.has(p.groupe)) l.push({ id: `p-${p.groupe}`, nom: p.texte });
  return l;
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
