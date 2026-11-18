import { describe, expect, it } from 'vitest';
import type { Guide } from './guides';
import { motsRecherche, nbTrouves, rechercher } from './recherche';

const p = (id: string, titre: string, texte = '', extra: Record<string, unknown> = {}) => ({ id, x: 0, y: 0, titre, texte, ...extra });
const guide = {
  slug: 'dx', nom: 'DXonJet', module: 'guide-dx',
  ecrans: [
    {
      id: 'a', code: 'A', titre: 'Réglages impression', groupe: 'Réglages', type: 'capture', largeur: 100, hauteur: 100,
      pastilles: [
        p('a.4', 'Plage', 'Plage de mouvement de la tête'),
        p('a.6', 'Retard de mouvement', 'Délai avant que la tête bouge', { mots_cles: ['décalage'] }),
        p('a.7', 'Vitesse de la tête', 'Vitesse', { etat: 'non_utilise' }),
        p('h', 'Haut', 'Monte la tête'),
        p('b', 'Bas', 'Descend la tête'),
      ],
      ensembles: [{ id: 'fleches', nom: 'Flèches de direction', mots_cles: ['bouger'], pastilles: ['h', 'b'] }],
    },
  ],
} as unknown as Guide;

describe('recherche des boutons', () => {
  it('comprend une phrase : mots inutiles ignorés', () => {
    expect(motsRecherche('je me rappelle plus le retard de mouvement').map((v) => v[0])).toEqual(['retard', 'mouvement']);
    expect(rechercher([guide], 'je me rappelle plus le retard de mouvement')[0]).toMatchObject({ type: 'pastille', pastille: 'a.6' });
  });

  it('mot-clé, synonyme et faute de frappe', () => {
    expect(rechercher([guide], 'décalage')[0].pastille).toBe('a.6');
    expect(rechercher([guide], 'délai')[0].pastille).toBe('a.6'); // délai → retard
    expect(rechercher([guide], 'retrad')[0].pastille).toBe('a.6'); // faute de frappe
  });

  it('pas tous les mots : les boutons qui en ont le plus d’abord ; moins de la moitié = rien', () => {
    const r = rechercher([guide], 'retard mouvement bleu');
    expect(r[0].pastille).toBe('a.6');
    expect(rechercher([guide], 'bleu jaune noir retard')).toEqual([]);
  });

  it('groupes de boutons trouvés comme un seul résultat', () => {
    const r = rechercher([guide], 'flèches');
    expect(r[0]).toMatchObject({ type: 'ensemble', pastille: 'fleches', pastilles: ['h', 'b'] });
    expect(rechercher([guide], 'comment bouger')[0].type).toBe('ensemble');
  });

  it('nbTrouves (pas-à-pas, astuces…)', () => {
    const q = motsRecherche('je cherche le retard de mouvement');
    expect(nbTrouves(q, 'Régler le retard de mouvement')).toBe(2);
    expect(nbTrouves(q, 'Changer les filtres')).toBe(0);
  });
});
