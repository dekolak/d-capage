import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Fenêtres Windows recréées (repris du prototype) : dossiers neutres, fichier d'exemple smiley.jpg.
 * Dessinées à 900 × 600 puis mises à l'échelle de l'écran.
 */
const FICHIERS: [type: 'd' | 'f', nom: string, date: string][] = [
  ['d', 'Visuels clients', '12/10/2026 09:14'],
  ['d', 'Murs 2026', '03/11/2026 16:40'],
  ['d', 'Logos', '21/09/2026 11:02'],
  ['d', 'Photos chantier', '28/10/2026 08:55'],
  ['d', 'Maquettes', '15/08/2026 17:21'],
  ['f', 'fresque-ecole.pdf', '02/11/2026 10:30'],
  ['f', 'logo-boulangerie.png', '30/10/2026 14:12'],
  ['f', 'smiley.jpg', '07/11/2026 07:45'],
];
const RIP: [string, string][] = [
  ['fresque-ecole', '02/11/2026 11:05'],
  ['logo-boulangerie', '30/10/2026 15:40'],
  ['mur-salle-sport', '24/10/2026 09:12'],
];

const Dossier = () => (
  <svg width="16" height="13" viewBox="0 0 16 13"><path d="M0 2h6l1.5 1.5H16V13H0z" fill="#f2c94c" stroke="#d4a72c" /></svg>
);
const Fichier = ({ c = '#6fb3e8' }: { c?: string }) => (
  <svg width="14" height="16" viewBox="0 0 14 16"><path d="M0 0h9l5 5v11H0z" fill="#fff" stroke="#7a8" /><rect x="2" y="7" width="10" height="6" fill={c} /></svg>
);

function Cadre({ largeur, hauteur, children }: { largeur: number; hauteur: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const o = new ResizeObserver(() => setEchelle(el.clientWidth / largeur));
    o.observe(el);
    return () => o.disconnect();
  }, [largeur]);
  return (
    <div ref={ref} className="gx-dlg" style={{ width: largeur, height: hauteur, transform: `scale(${echelle})` }}>
      {children}
    </div>
  );
}

const Cote = () => (
  <div className="side">
    <div><i>⭐</i>Accès rapide</div><div><i>🖥️</i>Bureau</div><div><i>📚</i>Bibliothèques</div><div><i>💻</i>Ce PC</div><div><i>🌐</i>Réseau</div>
  </div>
);

interface Props {
  fenetre: string;
  largeur: number;
  hauteur: number;
  /** Fermeture : `ok` = validée (Ajout, Enregistrer), sinon annulée. */
  onFermer(ok: boolean, message?: string): void;
  /** Fichier sélectionné imposé (animations). */
  fichier?: string | null;
}

export function Fenetre({ fenetre, largeur, hauteur, onFermer, fichier }: Props) {
  const [choisi, setChoix] = useState<string | null>(null);
  const choix = fichier !== undefined ? fichier : choisi;
  const [toast, setToast] = useState('');

  if (fenetre === 'enregistrer_sous')
    return (
      <Cadre largeur={largeur} hauteur={hauteur}>
        <div className="tb"><span className="ic">P</span>Enregistrer sous<span className="x" onClick={() => onFermer(false)}>✕</span></div>
        <div className="lk">Enregistrer dans : <div className="sel" style={{ width: 400 }}>📁 Fichiers RIP DXonJet <span>⌄</span></div></div>
        <Cote />
        <div className="files">
          <div className="fh"><span>Nom</span><span>Statut</span><span>Modifié le</span></div>
          {RIP.map(([n, d]) => (
            <div key={n} className="fr"><span><Fichier c="#e8541e" />{n}</span><span /><span>{d}</span></div>
          ))}
        </div>
        <div className="btn9" style={{ top: 80 }} onClick={() => onFermer(true, 'Fichier RIPé enregistré. Il reste à l\'ouvrir dans le logiciel DXonJet pour imprimer.')}>Enregistrer</div>
        <div className="btn9" style={{ top: 116 }} onClick={() => onFermer(false)}>Annuler</div>
        <div className="row" style={{ top: 450 }}><b>Nom du fichier :</b><div className="sel" style={{ width: 400, borderColor: '#0078d7' }}>smiley<span>⌄</span></div></div>
        <div className="row" style={{ top: 488 }}><b>Type :</b><div className="sel" style={{ width: 400 }}>Fichier d'impression DXonJet <span>⌄</span></div></div>
      </Cadre>
    );

  // ajouter_travail (par défaut)
  return (
    <Cadre largeur={largeur} hauteur={hauteur}>
      <div className="tb"><span className="ic">P</span>Ajouter un travail: DXonJet-XHS-VP4<span className="x" onClick={() => onFermer(false)}>✕</span></div>
      <div className="lk">Regarder dans : <div className="sel" style={{ width: 400 }}>🖥️ Bureau <span>⌄</span></div></div>
      <Cote />
      <div className="files">
        <div className="fh"><span>Nom</span><span>Statut</span><span>Modifié le</span></div>
        {FICHIERS.map(([t, n, d]) => (
          <div
            key={n}
            className={`fr ${choix === n ? 's' : ''}`}
            onClick={() => (t === 'd' ? setToast('Dossier d\'exemple : choisissez plutôt le fichier smiley.jpg.') : (setChoix(n), setToast('')))}
          >
            <span>{t === 'd' ? <Dossier /> : <Fichier />}{n}</span><span /><span>{d}</span>
          </div>
        ))}
      </div>
      <div
        className="btn9"
        style={{ top: 80 }}
        onClick={() => (choix ? onFermer(true, `Travail « ${choix} » ajouté dans la file.`) : setToast('Sélectionnez d\'abord un fichier dans la liste.'))}
      >
        Ajout
      </div>
      <div className="btn9" style={{ top: 116 }} onClick={() => onFermer(false)}>Annuler</div>
      <div className="pv" />
      <div className="cks">
        <label><input type="checkbox" /> Aperçu</label>
        <label><input type="checkbox" /> Copier dans le répertoire "Job"</label>
        <label><input type="checkbox" /> Ouvrir les propriétés du travail</label>
        <label><input type="checkbox" /> Imbriquer Travaux</label>
      </div>
      <div className="toast">{toast}</div>
      <div className="row" style={{ top: 450 }}><b>Nom du fichier :</b><div className="sel" style={{ width: 400, borderColor: '#0078d7' }}>{choix ?? ''}<span>⌄</span></div></div>
      <div className="row" style={{ top: 488 }}><b>Types de fichiers :</b><div className="sel" style={{ width: 400 }}>Tout ce qui est lisible <span>⌄</span></div></div>
      <div className="row" style={{ top: 536 }}><b>Préréglage :</b><div className="sel" style={{ width: 400, color: '#888' }}>Utiliser les propriétés du travail par défaut <span>⌄</span></div></div>
    </Cadre>
  );
}
