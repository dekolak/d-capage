import { useState } from 'react';

/**
 * Référence courte et fixe d'un élément (admin) : préfixe + fin de l'identifiant interne (ex. M-k3x9q2).
 * Ne change jamais, même si l'élément est renommé ; un clic copie l'identifiant complet (à donner à Claude).
 * Préfixes : M modèle, V variante, P pas-à-pas, B Bon à savoir, C cours, L leçon, S simulateur, E plan d'entretien.
 */
export function RefId({ id, p }: { id: string; p: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      className="ref-id"
      title={`Référence fixe — cliquer pour copier : ${id}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard?.writeText(id).catch(() => {});
        setCopie(true);
        setTimeout(() => setCopie(false), 1200);
      }}
    >
      {copie ? 'copié ✓' : `${p}-${id.slice(-6)}`}
    </button>
  );
}
