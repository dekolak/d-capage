import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { BadgeZone } from './Admin';

/** Catalogue complet (administration) : Lazzeko et Kiavik. */
export interface VarianteAdmin { id: string; nom: string; actif: boolean; imageUrl: string | null; imagePropre: boolean; reglages: boolean; machines: number }
export interface ModeleAdmin { id: string; nom: string; espaces: string[]; technologie: string | null; imageUrl: string | null; variantes: VarianteAdmin[] }
export interface FabricantAdmin { id: string; nom: string; modeles: ModeleAdmin[] }

/**
 * Administration → Machines : créer les fabricants, modèles et variantes (Lazzeko ou Kiavik), choisir dans quel
 * espace un modèle est visible, et l'image de chaque machine (PNG conseillé, fond transparent ou clair, ~800 px).
 * Les machines des clients s'ajoutent ensuite dans Utilisateurs (avec n° de série et mise en service).
 */
export default function AdminCatalogue() {
  const [cat, setCat] = useState<FabricantAdmin[]>([]);
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState('');
  const [fCat, setFCat] = useState('');
  const [nouveau, setNouveau] = useState({ fabricantId: '', fabricant: '', modele: '', espaces: ['kiavik'] as string[] });
  const { espaces } = useEspace();

  useEffect(() => {
    api<FabricantAdmin[]>('/admin/catalogue').then(setCat).catch(setErr);
  }, []);
  /** Action qui renvoie le catalogue à jour. */
  const faire = async (chemin: string, opts: RequestInit & { json?: unknown }) => {
    setErr(undefined);
    try {
      setCat(await api<FabricantAdmin[]>(chemin, opts));
      return true;
    } catch (e) {
      setErr(e);
      return false;
    }
  };

  const envoyer = async (cible: 'modeles' | 'variantes', id: string, f?: File) => {
    if (!f) return;
    setEnvoi(id);
    const fd = new FormData();
    fd.append('image', f);
    await faire(`/catalogue/${cible}/${id}/image`, { method: 'POST', body: fd });
    setEnvoi('');
  };
  const retirerImage = (cible: 'modeles' | 'variantes', id: string) => confirm('Retirer cette image ?') && faire(`/catalogue/${cible}/${id}/image`, { method: 'DELETE' });

  const BoutonImage = ({ cible, id, a }: { cible: 'modeles' | 'variantes'; id: string; a: boolean }) => (
    <span className="actions-avis">
      <label className="btn petit">
        {envoi === id ? 'Envoi…' : a ? '🖼 Remplacer' : '🖼 Image'}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => envoyer(cible, id, e.target.files?.[0])} />
      </label>
      {a && <button type="button" className="btn petit" onClick={() => retirerImage(cible, id)}>Retirer</button>}
    </span>
  );

  const creer = async () => {
    let fabricantId = nouveau.fabricantId;
    if (!fabricantId) {
      // nouveau fabricant, puis le modèle
      const nom = nouveau.fabricant.trim();
      if (!(await faire('/admin/catalogue/fabricants', { method: 'POST', json: { nom } }))) return;
      const l = await api<FabricantAdmin[]>('/admin/catalogue');
      fabricantId = l.find((f) => f.nom === nom)?.id ?? '';
    }
    if (await faire('/admin/catalogue/modeles', { method: 'POST', json: { fabricantId, nom: nouveau.modele.trim(), espaces: nouveau.espaces } }))
      setNouveau({ ...nouveau, fabricantId, fabricant: '', modele: '' });
  };
  const nomEspace = (s: string) => espaces.find((e) => e.slug === s)?.nom ?? s;
  const visibles = cat.map((f) => ({ ...f, modeles: f.modeles.filter((m) => !fCat || m.espaces.includes(fCat)) })).filter((f) => f.modeles.length);

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Machines <BadgeZone zone="commun" /></h1>
      <p className="muted petit">
        Créez les modèles de machines (Lazzeko ou Kiavik) et choisissez où le client les voit. Les machines d'un client
        (n° de série, mise en service) s'ajoutent dans <Link to="/admin/utilisateurs">Utilisateurs</Link>.
        Image : PNG conseillé, machine entière sur fond transparent ou clair, ~800 × 800 px, 5 Mo maximum.
      </p>
      <Erreur e={err} />

      <details className="carte adm-creer">
        <summary><b>+ Nouveau modèle</b></summary>
        <div className="form">
          <label>Fabricant
            <select value={nouveau.fabricantId} onChange={(e) => setNouveau({ ...nouveau, fabricantId: e.target.value })}>
              <option value="">+ Nouveau fabricant…</option>
              {cat.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
          {!nouveau.fabricantId && <label>Nom du fabricant<input value={nouveau.fabricant} maxLength={60} placeholder="ex. DXonJet" onChange={(e) => setNouveau({ ...nouveau, fabricant: e.target.value })} /></label>}
          <label>Nom du modèle<input value={nouveau.modele} maxLength={60} placeholder="ex. i3200" onChange={(e) => setNouveau({ ...nouveau, modele: e.target.value })} /></label>
          <div>
            <b className="petit">Visible dans</b>
            <div className="seg">
              {espaces.map((e) => (
                <button key={e.slug} type="button" className={nouveau.espaces.includes(e.slug) ? 'on' : ''}
                  onClick={() => setNouveau({ ...nouveau, espaces: nouveau.espaces.includes(e.slug) ? nouveau.espaces.filter((x) => x !== e.slug) : [...nouveau.espaces, e.slug] })}>
                  {e.nom}
                </button>
              ))}
            </div>
          </div>
          <small className="muted">Une variante « Standard » est créée avec le modèle ; ajoutez-en d'autres ensuite (ex. largeur, nombre de têtes).</small>
          <button type="button" className="btn prim" disabled={nouveau.modele.trim().length < 1 || (!nouveau.fabricantId && nouveau.fabricant.trim().length < 1) || !nouveau.espaces.length} onClick={creer}>
            Créer le modèle
          </button>
        </div>
      </details>

      <div className="seg" style={{ marginBottom: 12 }}>
        {[{ slug: '', nom: 'Tous' }, ...espaces].map((e) => (
          <button key={e.slug} type="button" className={fCat === e.slug ? 'on' : ''} onClick={() => setFCat(e.slug)}>{e.nom}</button>
        ))}
      </div>

      <div className="liste">
        {visibles.flatMap((f) =>
          f.modeles.map((mo) => (
            <Modele key={mo.id} f={f} mo={mo} faire={faire} nomEspace={nomEspace} espaces={espaces.map((e) => e.slug)} BoutonImage={BoutonImage} />
          )),
        )}
        {!visibles.length && <p className="muted">Aucun modèle.</p>}
      </div>
    </div>
  );
}

function Modele({ f, mo, faire, nomEspace, espaces, BoutonImage }: {
  f: FabricantAdmin; mo: ModeleAdmin; faire: (c: string, o: RequestInit & { json?: unknown }) => Promise<boolean>;
  nomEspace: (s: string) => string; espaces: string[];
  BoutonImage: (p: { cible: 'modeles' | 'variantes'; id: string; a: boolean }) => React.ReactElement;
}) {
  const [nom, setNom] = useState<string | null>(null);
  const [variante, setVariante] = useState('');
  const utilise = mo.variantes.some((v) => v.machines || v.reglages);
  return (
    <div className="carte">
      <div className="ligne-machine">
        <MiniatureMachine url={mo.imageUrl} taille={72} />
        <div style={{ flex: 1 }}>
          {nom === null ? (
            <b>{f.nom} {mo.nom}</b>
          ) : (
            <span className="ba-libre">
              <input autoFocus value={nom} maxLength={60} onChange={(e) => setNom(e.target.value)} />
              <button type="button" className="btn petit prim" disabled={!nom.trim()} onClick={() => faire(`/admin/catalogue/modeles/${mo.id}`, { method: 'PATCH', json: { nom } }).then((ok) => ok && setNom(null))}>OK</button>
            </span>
          )}
          <div className="petit">
            {mo.espaces.map((s) => <BadgeZone key={s} zone={s} />)}
            {!mo.espaces.length && <span className="badge-masquee">visible nulle part</span>}
            {mo.technologie && <span className="muted"> · fiches de réglage</span>}
          </div>
        </div>
        <BoutonImage cible="modeles" id={mo.id} a={!!mo.imageUrl} />
      </div>
      <div className="actions-avis">
        {espaces.map((s) => (
          <label key={s} className="interrupteur petit">
            <input type="checkbox" checked={mo.espaces.includes(s)}
              onChange={() => faire(`/admin/catalogue/modeles/${mo.id}`, { method: 'PATCH', json: { espaces: mo.espaces.includes(s) ? mo.espaces.filter((x) => x !== s) : [...mo.espaces, s] } })} />
            Visible dans {nomEspace(s)}
          </label>
        ))}
        {nom === null && <button type="button" className="btn petit" onClick={() => setNom(mo.nom)}>✏️ Renommer</button>}
        {!utilise && <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer ${f.nom} ${mo.nom} ?`) && faire(`/admin/catalogue/modeles/${mo.id}`, { method: 'DELETE' })}>🗑</button>}
      </div>
      {mo.variantes.map((v) => (
        <div key={v.id} className={'ligne-machine sous-bloc' + (v.actif ? '' : ' inactif')}>
          <MiniatureMachine url={v.imageUrl} badge={v.nom} taille={48} />
          <div style={{ flex: 1 }} className="petit">
            <b>{v.nom}</b> <span className="muted">· {v.machines} machine{v.machines > 1 ? 's' : ''} chez des clients{v.reglages ? ' · écran de réglage' : ''}{v.actif ? '' : ' · désactivée'}</span>
          </div>
          <BoutonImage cible="variantes" id={v.id} a={v.imagePropre} />
          <button type="button" className="btn petit" title={v.actif ? 'Ne plus proposer cette variante' : 'Proposer de nouveau'}
            onClick={() => faire(`/admin/catalogue/variantes/${v.id}`, { method: 'PATCH', json: { actif: !v.actif } })}>{v.actif ? 'Désactiver' : 'Réactiver'}</button>
          {!v.machines && !v.reglages && mo.variantes.length > 1 && (
            <button type="button" className="btn petit danger" onClick={() => confirm(`Supprimer la variante ${v.nom} ?`) && faire(`/admin/catalogue/variantes/${v.id}`, { method: 'DELETE' })}>🗑</button>
          )}
        </div>
      ))}
      <div className="ba-libre" style={{ marginTop: 8 }}>
        <input value={variante} maxLength={60} placeholder="+ Variante (ex. 1,8 m, 4 têtes)" onChange={(e) => setVariante(e.target.value)} />
        <button type="button" className="btn petit" disabled={!variante.trim()}
          onClick={() => faire('/admin/catalogue/variantes', { method: 'POST', json: { modeleId: mo.id, nom: variante } }).then((ok) => ok && setVariante(''))}>Ajouter</button>
      </div>
    </div>
  );
}
