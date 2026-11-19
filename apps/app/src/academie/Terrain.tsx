import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chargement, Erreur } from '../components/Composants';
import { Camera, Dictee, Galerie } from '../pages/Terrain';
import { api } from '../lib/api';
import { useEspace } from '../lib/espace';
import { compresser } from '../lib/image';
import { AnnoterImage, Blocs } from './Blocs';
import { Bloc, Lecon } from './donnees';
import '../pages/terrain.css';
import './academie.css';

/*
 * Administration → Académie → 🎥 Mode terrain (admin, en français) : préparer une leçon devant la machine,
 * téléphone sur trépied. Chaque capture devient tout de suite un bloc de la leçon (enregistrée, non publiée) :
 * 📷 photo (+ légende), 🎙 texte dicté ou tapé, ⚠️ attention, 📝 note de montage (jamais vue par les clients).
 * On la finit ensuite sur ordinateur dans l'éditeur habituel.
 */

const CLE_RECENTS = 'academie.terrain';
interface Recent { id: string; titre: string; ou: string; date: number }
const lireRecents = (): Recent[] => {
  try {
    return JSON.parse(localStorage.getItem(CLE_RECENTS) ?? '[]');
  } catch {
    return [];
  }
};
const noterRecent = (r: Recent) => localStorage.setItem(CLE_RECENTS, JSON.stringify([r, ...lireRecents().filter((x) => x.id !== r.id)].slice(0, 10)));
const nouvelId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface CoursAdmin { id: string; titre: string; espace: string; type: 'parcours' | 'page' }

/** Accueil : où ranger la leçon (parcours existant, nouveau parcours, nouvelle page), titre ; ou reprendre. */
export function TerrainAcademie() {
  const nav = useNavigate();
  const { espaces, espace } = useEspace();
  const [esp, setEsp] = useState(espace.slug);
  const [cours, setCours] = useState<CoursAdmin[]>();
  const [ou, setOu] = useState('');
  const [titreParcours, setTitreParcours] = useState('');
  const [titre, setTitre] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    api<CoursAdmin[]>('/admin/academie/cours').then(setCours).catch(setErr);
  }, []);
  const parcours = (cours ?? []).filter((c) => c.espace === esp && c.type !== 'page');
  const valide = titre.trim().length >= 2 && !!ou && (ou !== 'nouveau' || titreParcours.trim().length >= 2);

  const demarrer = async () => {
    setEnvoi(true);
    setErr(undefined);
    try {
      let leconId: string;
      let nomOu: string;
      if (ou === 'page') {
        const c = await api<{ id: string; lecons: { id: string }[] }>('/admin/academie/cours', { method: 'POST', json: { espace: esp, type: 'page', titre } });
        leconId = c.lecons[0].id;
        nomOu = 'Page';
      } else {
        const coursId = ou === 'nouveau'
          ? (await api<{ id: string }>('/admin/academie/cours', { method: 'POST', json: { espace: esp, type: 'parcours', titre: titreParcours } })).id
          : ou;
        leconId = (await api<{ id: string }>(`/admin/academie/cours/${coursId}/lecons`, { method: 'POST', json: { titre } })).id;
        nomOu = ou === 'nouveau' ? titreParcours.trim() : parcours.find((c) => c.id === ou)?.titre ?? '';
      }
      noterRecent({ id: leconId, titre: titre.trim(), ou: nomOu, date: Date.now() });
      nav(`/admin/academie/terrain/${leconId}`);
    } catch (e) {
      setErr(e);
      setEnvoi(false);
    }
  };

  const recents = lireRecents();
  return (
    <div className="page tr">
      <Link to="/admin/academie" className="btn-lien">← Académie</Link>
      <h1>🎥 Mode terrain · Académie</h1>
      <p className="muted petit">Téléphone sur trépied devant la machine : photos (avec retardateur), textes dictés, points d'attention et notes de montage. Tout est enregistré au fur et à mesure, non publié ; vous finissez la leçon sur ordinateur.</p>
      <Erreur e={err} />
      <div className="carte form">
        {espaces.length > 1 && (
          <div className="seg">
            {espaces.map((e) => (
              <button key={e.slug} type="button" className={esp === e.slug ? 'on' : ''} onClick={() => ((setEsp(e.slug), setOu('')))}>{e.nom}</button>
            ))}
          </div>
        )}
        <label>Ranger dans
          <select value={ou} onChange={(e) => setOu(e.target.value)}>
            <option value="">Choisir…</option>
            {parcours.map((c) => <option key={c.id} value={c.id}>📚 {c.titre}</option>)}
            <option value="nouveau">➕ Nouveau parcours…</option>
            <option value="page">🧰 Nouvelle page (contenu seul)</option>
          </select>
        </label>
        {ou === 'nouveau' && <input value={titreParcours} maxLength={150} placeholder="Titre du parcours (ex. Prise en main ZEKO)" onChange={(e) => setTitreParcours(e.target.value)} />}
        <input value={titre} maxLength={150} placeholder={ou === 'page' ? 'Titre de la page' : 'Titre de la leçon (ex. Changer la lentille)'} onChange={(e) => setTitre(e.target.value)} />
        <button type="button" className="btn prim large" disabled={!valide || envoi} onClick={demarrer}>{envoi ? 'Création…' : '🎥 Commencer la capture'}</button>
      </div>
      {recents.length > 0 && (
        <>
          <h2>Reprendre (sur ce téléphone)</h2>
          <div className="liste">
            {recents.map((r) => (
              <Link key={r.id} to={`/admin/academie/terrain/${r.id}`} className="carte ac-ligne">
                <span className="ac-ligne-lien"><b>{r.titre}</b><small className="muted">{r.ou} · {new Date(r.date).toLocaleDateString('fr-FR')}</small></span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Sorte = 'texte' | 'attention' | 'note';
const SORTES: { s: Sorte; l: string; aide: string }[] = [
  { s: 'texte', l: '🎙 Texte', aide: 'Ce que l\'on fait (paragraphe de la leçon)' },
  { s: 'attention', l: '⚠️ Attention', aide: 'Point de vigilance (encadré)' },
  { s: 'note', l: '📝 Note', aide: 'Rappel pour vous au montage (ex. vidéo à placer ici) : jamais vu par les clients' },
];

/** Capture : caméra + retardateur, légende de la dernière photo, texte / attention / note, liste des blocs capturés. */
export function TerrainLecon() {
  const { id = '' } = useParams();
  const [l, setL] = useState<Lecon>();
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [sorte, setSorte] = useState<Sorte>('texte');
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState('');
  const [err, setErr] = useState<unknown>();
  useEffect(() => {
    api<Lecon>(`/academie/lecons/${id}`).then((x) => ((setL(x), setBlocs(x.blocs)))).catch(setErr);
  }, [id]);

  /** Enregistre la leçon (mêmes règles que l'éditeur : chemin et nom des fichiers recalculés par l'API). */
  const enregistrer = async (liste: Bloc[]) => {
    setBlocs(liste);
    const propres = liste.map(({ chemin: _c, nom, ...b }) => (b.type === 'fichier' ? { ...b, nom } : b));
    await api(`/admin/academie/lecons/${id}`, { method: 'PATCH', json: { blocs: propres } }).catch(setErr);
  };

  const photo = async (f: Blob) => {
    setEnvoi('Envoi de la photo…');
    setErr(undefined);
    try {
      const fd = new FormData();
      fd.append('fichier', (await compresser(f)).fichier, 'image.jpg');
      const r = await api<{ id: string; chemin: string }>('/admin/academie/fichiers', { method: 'POST', body: fd });
      await enregistrer([...blocs, { id: nouvelId(), type: 'image', fichierId: r.id, chemin: r.chemin, legende: '' }]);
    } catch (e) {
      setErr(e);
    } finally {
      setEnvoi('');
    }
  };

  const ajouterTexte = async () => {
    const x = texte.trim();
    if (!x) return;
    const b: Bloc = sorte === 'texte' ? { id: nouvelId(), type: 'texte', texte: x }
      : sorte === 'attention' ? { id: nouvelId(), type: 'encadre', niveau: 'avertissement', texte: x }
      : { id: nouvelId(), type: 'note', texte: x };
    await enregistrer([...blocs, b]);
    setTexte('');
  };

  const derniere = [...blocs].reverse().find((b) => b.type === 'image');
  const legende = (v: string) => setBlocs((l2) => l2.map((b) => (b.id === derniere?.id ? { ...b, legende: v } : b)));

  if (!l) return err ? <div className="page"><Erreur e={err} /></div> : <Chargement />;
  return (
    <div className="page tr">
      <div className="tr-tete">
        <Link to="/admin/academie/terrain" className="btn-lien">←</Link>
        <span className="tr-titre"><b>{l.titre}</b><small>{l.cours.titre} · {blocs.length} bloc(s) · enregistré</small></span>
        <Link to={`/admin/academie/lecons/${id}`} className="btn petit">Finir ›</Link>
      </div>
      <Erreur e={err} />

      <Camera onPhoto={photo} pleine={!!envoi} />
      <Galerie reste={20} onPhoto={photo} />
      {envoi && <p className="muted petit">{envoi}</p>}
      {derniere && (
        <details className="carte">
          <summary>Dernière photo : légende et annotation{derniere.reperes?.length ? ` (${derniere.reperes.length})` : ''}</summary>
          <input value={derniere.legende ?? ''} maxLength={300} placeholder="Légende (facultatif)"
            onChange={(e) => legende(e.target.value)} onBlur={() => enregistrer(blocs)} />
          <AnnoterImage b={derniere} onChange={(nb) => enregistrer(blocs.map((x) => (x.id === nb.id ? nb : x)))} />
        </details>
      )}

      <div className="seg">
        {SORTES.map((x) => (
          <button key={x.s} type="button" className={sorte === x.s ? 'on' : ''} onClick={() => setSorte(x.s)}>{x.l}</button>
        ))}
      </div>
      <div className="tr-texte">
        <small className="muted">{SORTES.find((x) => x.s === sorte)!.aide}</small>
        <textarea rows={3} value={texte} maxLength={4000} onChange={(e) => setTexte(e.target.value)} />
        <div className="tr-dictee">
          <Dictee onTexte={(x) => setTexte((t) => (t ? `${t} ${x}` : x))} />
          <button type="button" className="btn prim" disabled={!texte.trim()} onClick={ajouterTexte}>➕ Ajouter</button>
        </div>
      </div>

      <h2>Capturé ({blocs.length})</h2>
      <div className="ac-terrain-blocs">
        {[...blocs].reverse().map((b) => (
          <div key={b.id} className="ac-terrain-bloc">
            <Blocs blocs={[b]} />
            <button type="button" className="btn petit danger" aria-label="Supprimer" onClick={() => confirm('Supprimer ce bloc ?') && enregistrer(blocs.filter((x) => x.id !== b.id))}>🗑</button>
          </div>
        ))}
        {!blocs.length && <p className="muted">Rien encore : prenez une photo ou dictez la première étape.</p>}
      </div>
    </div>
  );
}
