import { calculerChemin } from './chemin';

const c = (id: string, suite = 'retour', etapeCibleId: string | null = null) => ({ id, suite, etapeCibleId });
const e = (id: string, ordre: number, brancheId: string | null = null, choix: ReturnType<typeof c>[] = []) => ({ id, ordre, brancheId, choix });

// 1 → 2 ❓pompe (oui : a ❓encre [oui ↩, non contact] ; non : b ❓tourne [oui ↩, non contact]) → 3
const etapes = [
  e('1', 0),
  e('2', 1, null, [c('oui'), c('non')]),
  e('a', 0, 'oui', [c('encreOui'), c('encreNon', 'contact')]),
  e('b', 0, 'non', [c('tourneOui'), c('tourneNon', 'contact')]),
  e('3', 2),
];
const ids = (r: ReturnType<typeof calculerChemin>) => r.pas.map((p) => p.e.id).join(' ');

describe('calculerChemin', () => {
  it('attend la réponse à une question', () => {
    const r = calculerChemin(etapes, {});
    expect(ids(r)).toBe('1 2');
    expect(r.fin).toBeNull();
  });
  it('fait le détour puis revient sur la route principale', () => {
    const r = calculerChemin(etapes, { '2': 'oui', a: 'encreOui' });
    expect(ids(r)).toBe('1 2 a 3');
    expect(r.fin).toEqual({ type: 'termine' });
    expect(r.pas.map((p) => [p.profondeur, p.principal])).toEqual([[0, 0], [0, 1], [1, 1], [0, 2]]);
  });
  it('s\'arrête sur une fin « contact »', () => {
    const r = calculerChemin(etapes, { '2': 'non', b: 'tourneNon' });
    expect(ids(r)).toBe('1 2 b');
    expect(r.fin).toMatchObject({ type: 'contact', choix: { id: 'tourneNon' } });
  });
  it('ignore les réponses hors du chemin et suit un saut', () => {
    const avecSaut = [...etapes.slice(0, 1), e('2', 1, null, [c('oui', 'etape', '1'), c('non', 'etape', '3')]), etapes[4]];
    expect(ids(calculerChemin(avecSaut, { '2': 'non', a: 'encreNon' }))).toBe('1 2 3');
    // saut en arrière sans fin : le garde-fou arrête la boucle
    expect(calculerChemin(avecSaut, { '2': 'oui' }).fin).toBeNull();
  });
});
