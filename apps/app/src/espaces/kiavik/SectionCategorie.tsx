import { ReactNode, useState } from 'react';
import './accueil.css';

/** Sections ouvertes (une seule à la fois), gardées sur le téléphone sous la clé donnée. */
export function useSectionOuverte(cle: string) {
  const [ouverte, setOuverte] = useState<string | null>(() => {
    try {
      const l = JSON.parse(localStorage.getItem(cle) ?? '[]');
      return Array.isArray(l) && typeof l[0] === 'string' ? l[0] : null;
    } catch {
      return null;
    }
  });
  const basculer = (cat: string) => {
    const v = ouverte === cat ? null : cat;
    setOuverte(v);
    localStorage.setItem(cle, JSON.stringify(v === null ? [] : [v]));
  };
  return { ouverte, basculer };
}

/** Section repliable d'une catégorie de l'accueil (icône, nom, résumé du contenu) : accueil Kiavik et Ma machine. */
export function SectionCategorie({ icone, nom, resume, ouverte, onBasculer, children }: {
  icone: string; nom: string; resume: string; ouverte: boolean; onBasculer: () => void; children: ReactNode;
}) {
  return (
    <section className={`kh-cat ${ouverte ? 'ouverte' : ''}`}>
      <button type="button" className="kh-cat-tete" aria-expanded={ouverte} onClick={onBasculer}>
        <span className="kh-cat-icone" aria-hidden="true">{icone}</span>
        <span className="kh-cat-nom">
          <b>{nom}</b>
          <small>{resume}</small>
        </span>
        <span className="kh-cat-chevron" aria-hidden="true">›</span>
      </button>
      {ouverte && <div className="kh-cat-corps">{children}</div>}
    </section>
  );
}
