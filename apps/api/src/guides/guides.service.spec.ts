import { GuidesService } from './guides.service';

describe('GuidesService', () => {
  const svc = new GuidesService();
  (svc as unknown as { guides: unknown[] }).guides = [
    {
      slug: 'essai', nom: 'Essai', module: 'guide-essai',
      ecrans: [{ id: 'e1', code: 'E1', titre: 'Écran', groupe: 'G', type: 'capture', largeur: 10, hauteur: 10, pastilles: [
        { id: '1', x: 1, y: 1, titre: 'A', texte: 'a', conseil: 'note interne', niveau: 'a_completer' },
        { id: '2', x: 2, y: 2, titre: 'B', texte: 'b', conseil: 'astuce', niveau: 'astuce' },
      ] }],
    },
  ];

  it("n'envoie les notes « à compléter » qu'à l'admin", () => {
    const client = svc.guide('essai', false).ecrans[0].pastilles;
    expect(client[0].conseil).toBeUndefined();
    expect(client[0].niveau).toBeUndefined();
    expect(client[1].conseil).toBe('astuce');
    expect(svc.guide('essai', true).ecrans[0].pastilles[0].conseil).toBe('note interne');
  });
});
