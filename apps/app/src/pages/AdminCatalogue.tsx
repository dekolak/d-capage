import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Erreur } from '../components/Composants';
import { MiniatureMachine } from '../components/MiniatureMachine';
import { api, Fabricant } from '../lib/api';

/**
 * Admin : miniature de chaque machine. Une image par modèle (PNG conseillé : fond transparent ou clair,
 * machine entière, ~800 px) ; une variante peut avoir la sienne, sinon elle reprend celle du modèle.
 */
export default function AdminCatalogue() {
  const [cat, setCat] = useState<Fabricant[]>([]);
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState('');

  useEffect(() => {
    api<Fabricant[]>('/catalogue').then(setCat).catch(setErr);
  }, []);

  const envoyer = async (cible: 'modeles' | 'variantes', id: string, f?: File) => {
    if (!f) return;
    setErr(undefined);
    setEnvoi(id);
    const fd = new FormData();
    fd.append('image', f);
    try {
      setCat(await api<Fabricant[]>(`/catalogue/${cible}/${id}/image`, { method: 'POST', body: fd }));
    } catch (e) {
      setErr(e);
    } finally {
      setEnvoi('');
    }
  };
  const retirer = async (cible: 'modeles' | 'variantes', id: string) => {
    if (!confirm('Retirer cette image ?')) return;
    setCat(await api<Fabricant[]>(`/catalogue/${cible}/${id}/image`, { method: 'DELETE' }).catch((e) => { setErr(e); return cat; }));
  };

  const BoutonImage = ({ cible, id, a }: { cible: 'modeles' | 'variantes'; id: string; a: boolean }) => (
    <span className="actions-avis">
      <label className="btn petit prim">
        {envoi === id ? 'Envoi…' : a ? 'Remplacer' : 'Ajouter une image'}
        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => envoyer(cible, id, e.target.files?.[0])} />
      </label>
      {a && <button type="button" className="btn petit" onClick={() => retirer(cible, id)}>Retirer</button>}
    </span>
  );

  return (
    <div className="page">
      <p className="petit"><Link to="/admin">‹ Administration</Link></p>
      <h1>Machines</h1>
      <p className="muted petit">PNG conseillé : machine entière sur fond transparent ou clair, environ 800 × 800 px, 5 Mo maximum.</p>
      <Erreur e={err} />
      <div className="liste">
        {cat.flatMap((f) =>
          f.modeles.map((mo) => (
            <div key={mo.id} className="carte">
              <div className="ligne-machine">
                <MiniatureMachine url={mo.imageUrl} taille={72} />
                <div style={{ flex: 1 }}>
                  <b>{f.nom} {mo.nom}</b>
                  <div className="muted petit">Image du modèle (utilisée par toutes ses variantes)</div>
                </div>
                <BoutonImage cible="modeles" id={mo.id} a={!!mo.imageUrl} />
              </div>
              {mo.variantes.map((v) => (
                <div key={v.id} className="ligne-machine sous-bloc">
                  <MiniatureMachine url={v.imageUrl} badge={v.nom} taille={48} />
                  <div style={{ flex: 1 }} className="petit">
                    <b>{v.nom}</b> <span className="muted">{v.imagePropre ? 'image propre' : 'reprend l\'image du modèle'}</span>
                  </div>
                  <BoutonImage cible="variantes" id={v.id} a={v.imagePropre} />
                </div>
              ))}
            </div>
          )),
        )}
      </div>
    </div>
  );
}
