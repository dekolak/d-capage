import { useState } from 'react';
import { Erreur } from '../../components/Composants';
import { api } from '../../lib/api';
import { compresser } from '../../lib/image';
import { CATEGORIES } from './donneesProcedures';
import { Animation, Ecran, EtapeAnim, Guide, mettreAJourGuide, Pastille, SceneBlanc, SceneEcrans } from './guides';

/*
 * Corrections des guides depuis le téléphone (admin seulement ; écrans d'administration en français).
 * Elles sont enregistrées à part : « Revenir à l'original » efface la correction.
 */

const base = (g: Guide) => `/admin/guides/${encodeURIComponent(g.slug)}`;
const enc = encodeURIComponent;

async function envoyer(chemin: string, opts: RequestInit & { json?: unknown }) {
  mettreAJourGuide(await api<Guide>(chemin, opts));
}

/** Formulaire de la fiche d'un bouton : titre, texte, conseil, type de conseil, mots-clés. */
export function EditeurPastille({ guide, e, p, onFermer }: { guide: Guide; e: Ecran; p: Pastille; onFermer(): void }) {
  const [f, setF] = useState({
    titre: p.titre, texte: p.texte, conseil: p.conseil ?? '', niveau: p.niveau ?? '', mots: (p.mots_cles ?? []).join(', '),
  });
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState(false);
  const url = `${base(guide)}/pastilles/${enc(e.id)}/${enc(p.id)}`;
  const faire = async (opts: RequestInit & { json?: unknown }) => {
    setEnvoi(true);
    setErr(undefined);
    try {
      await envoyer(url, opts);
      onFermer();
    } catch (x) {
      setErr(x);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="form cx-form">
      <b>✏️ Modifier la fiche {e.code} · {p.id}</b>
      <label>Titre<input type="text" value={f.titre} maxLength={120} onChange={(x) => setF({ ...f, titre: x.target.value })} /></label>
      <label>Texte<textarea rows={4} value={f.texte} maxLength={2000} onChange={(x) => setF({ ...f, texte: x.target.value })} /></label>
      <label>
        Conseil (facultatif)
        <textarea rows={3} value={f.conseil} maxLength={1000} onChange={(x) => setF({ ...f, conseil: x.target.value })} />
      </label>
      <label>
        Type de conseil
        <select value={f.niveau} onChange={(x) => setF({ ...f, niveau: x.target.value })}>
          <option value="">💡 Astuce (par défaut)</option>
          <option value="astuce">💡 Astuce</option>
          <option value="avertissement">⚠️ Avertissement (encadré rouge)</option>
          <option value="a_completer">À compléter (visible par l'admin seulement)</option>
        </select>
      </label>
      <label>
        Mots-clés pour la recherche (séparés par des virgules)
        <input type="text" value={f.mots} placeholder="ex. alignement, décalage, mire" onChange={(x) => setF({ ...f, mots: x.target.value })} />
      </label>
      <Erreur e={err} />
      <div className="cx-actions">
        <button
          type="button"
          className="btn prim"
          disabled={envoi || f.titre.trim().length < 2 || !f.texte.trim()}
          onClick={() =>
            faire({
              method: 'PUT',
              json: { titre: f.titre, texte: f.texte, conseil: f.conseil || null, niveau: f.niveau || null, mots_cles: f.mots.split(',').map((m) => m.trim()).filter(Boolean) },
            })
          }
        >
          Enregistrer
        </button>
        <button type="button" className="btn" onClick={onFermer}>Annuler</button>
      </div>
      {p.corrige && (
        <button type="button" className="btn-lien" disabled={envoi} onClick={() => confirm('Revenir au texte d\'origine de ce bouton ?') && faire({ method: 'DELETE' })}>
          ↺ Revenir à l'original
        </button>
      )}
    </div>
  );
}

/** Sous-titres et photos de la scène affichée d'une animation. */
export function EditeurScene({ guide, a, scene }: { guide: Guide; a: Animation; scene: number }) {
  const [err, setErr] = useState<unknown>();
  const s = a.scenes[scene];
  const etapes: { i: number; e: EtapeAnim | SceneBlanc }[] =
    'etapes' in s ? s.etapes.map((e, i) => ({ i, e })).filter((x) => x.e.cap !== undefined) : [{ i: 0, e: s as SceneBlanc }];
  // photos utilisées par la scène (écran de départ et écrans atteints par un clic)
  const photos = 'etapes' in s ? [...new Set([s.ecran, ...(s as SceneEcrans).etapes.map((x) => x.go)].filter((x): x is string => !!x?.startsWith('photo:')).map((x) => x.slice(6)))] : [];
  const url = `${base(guide)}/animations/${enc(a.id)}`;
  const faire = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErr(undefined);
    try {
      await envoyer(chemin, opts);
      return true;
    } catch (x) {
      setErr(x);
      return false;
    }
  };
  return (
    <div className="carte form cx-form">
      <b>✏️ Modifier la scène « {s.titre} »</b>
      <span className="muted petit">Le sous-titre est aussi la phrase lue par la voix off.</span>
      {etapes.map(({ i, e }) => (
        <SousTitre
          key={`${scene}-${i}-${e.cap}`}
          e={e}
          onEnregistrer={(cap) => faire(`${url}/etapes/${scene}/${i}`, { method: 'PUT', json: { cap } })}
          onOriginal={() => faire(`${url}/etapes/${scene}/${i}`, { method: 'DELETE' })}
        />
      ))}
      {photos.map((cle) => (
        <PhotoScene
          key={cle}
          image={a.photos?.[cle]?.image}
          corrige={!!a.photos?.[cle]?.corrige}
          onRemplacer={async (f) => {
            const { fichier } = await compresser(f);
            const fd = new FormData();
            fd.append('photo', fichier, 'photo.jpg');
            return faire(`${url}/photos/${enc(cle)}`, { method: 'POST', body: fd });
          }}
          onOriginal={() => faire(`${url}/photos/${enc(cle)}`, { method: 'DELETE' })}
        />
      ))}
      <Erreur e={err} />
    </div>
  );
}

function SousTitre({ e, onEnregistrer, onOriginal }: { e: { cap?: string; corrige?: boolean }; onEnregistrer(cap: string): Promise<boolean>; onOriginal(): Promise<boolean> }) {
  const [cap, setCap] = useState(e.cap ?? '');
  const [envoi, setEnvoi] = useState(false);
  const modifie = cap.trim() !== (e.cap ?? '').trim();
  return (
    <div className="cx-ligne">
      <textarea rows={3} value={cap} maxLength={500} onChange={(x) => setCap(x.target.value)} aria-label="Sous-titre" />
      <div className="cx-actions">
        {modifie && (
          <button type="button" className="btn prim petit" disabled={envoi || cap.trim().length < 2} onClick={async () => { setEnvoi(true); await onEnregistrer(cap); setEnvoi(false); }}>
            Enregistrer
          </button>
        )}
        {e.corrige && !modifie && (
          <button type="button" className="btn-lien petit" disabled={envoi} onClick={async () => { setEnvoi(true); await onOriginal(); setEnvoi(false); }}>
            ↺ Revenir à l'original
          </button>
        )}
      </div>
    </div>
  );
}

function PhotoScene({ image, corrige, onRemplacer, onOriginal }: { image?: string; corrige: boolean; onRemplacer(f: File): Promise<boolean>; onOriginal(): Promise<boolean> }) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <div className="cx-photo">
      {image && <img src={image} alt="" />}
      <div className="cx-actions">
        <label className="btn petit">
          {envoi ? 'Envoi…' : '📷 Remplacer la photo'}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (x) => {
              const f = x.target.files?.[0];
              if (!f) return;
              setEnvoi(true);
              await onRemplacer(f);
              setEnvoi(false);
            }}
          />
        </label>
        {corrige && (
          <button type="button" className="btn-lien petit" disabled={envoi} onClick={async () => { setEnvoi(true); await onOriginal(); setEnvoi(false); }}>
            ↺ Photo d'origine
          </button>
        )}
      </div>
    </div>
  );
}

/** Catégorie d'une animation sur l'accueil (admin). */
export function CategorieAnimation({ guide, a }: { guide: Guide; a: Animation }) {
  const [v, setV] = useState(a.categorie ?? '');
  const [err, setErr] = useState<unknown>();
  const url = `${base(guide)}/animations/${enc(a.id)}/categorie`;
  const faire = (opts: RequestInit & { json?: unknown }) => envoyer(url, opts).catch(setErr);
  return (
    <div className="cx-categorie">
      <label>
        Catégorie sur l'accueil
        <input type="text" list="categories-accueil" value={v} onChange={(e) => setV(e.target.value)} />
        <datalist id="categories-accueil">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <span>
        {v.trim() !== (a.categorie ?? '') && <button type="button" className="btn prim petit" disabled={v.trim().length < 2} onClick={() => faire({ method: 'PUT', json: { categorie: v.trim() } })}>Enregistrer</button>}
        {a.categorieCorrigee && <button type="button" className="btn petit" onClick={() => faire({ method: 'DELETE' })}>Revenir à l'original</button>}
      </span>
      <Erreur e={err} />
    </div>
  );
}
