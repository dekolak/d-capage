import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  chargerConfig,
  champsEnregistres,
  modeleLaser,
  technologie,
  validerValeurs,
  valeursParDefaut,
} from './index';

const brut = JSON.parse(
  readFileSync(join(__dirname, '../../../machines/lazzeko/laser-pulse-300w/v1.json'), 'utf8'),
);

describe('config Lazzeko 300 W', () => {
  const cfg = chargerConfig(brut);

  it('se charge et expose les champs enregistrés', () => {
    const keys = champsEnregistres(cfg).map((c) => c.key);
    expect(keys).toEqual(
      expect.arrayContaining(['pwr', 'pw', 'freq', 'scan', 'len', 'wid', 'oR', 'iR', 'ph', 'speed', 'hatch', 'times', 'lens']),
    );
    // Non pertinents pour archiver un réglage : retirés
    for (const k of ['air', 'paramNo', 'paramName']) expect(keys).not.toContain(k);
  });

  it('les valeurs par défaut correspondent à l\'écran réel (photo)', () => {
    expect(valeursParDefaut(cfg)).toMatchObject({ pwr: 85, freq: 20, pw: 500, scan: 4, speed: 20, hatch: 10, lens: '254' });
  });

  it('ne garde que les champs visibles selon le motif', () => {
    const anneau = validerValeurs(cfg, { ...valeursParDefaut(cfg), scan: 2, oR: 10, iR: 2 });
    expect(anneau.ok).toBe(true);
    expect(anneau.valeurs).toHaveProperty('iR', 2);
    expect(anneau.valeurs).not.toHaveProperty('len');

    const fleur = validerValeurs(cfg, { scan: 6, ph: 1 });
    expect(fleur.valeurs).toHaveProperty('ph', 1);
    expect(fleur.valeurs).not.toHaveProperty('iR');
  });

  it('refuse les valeurs hors limites et les champs inconnus', () => {
    const r = validerValeurs(cfg, { pwr: 120, inconnu: 1 });
    expect(r.ok).toBe(false);
    expect(r.erreurs.map((e) => e.key)).toEqual(expect.arrayContaining(['pwr', 'inconnu']));
  });

  it('contrôle la zone max selon la lentille', () => {
    const r = validerValeurs(cfg, { scan: 4, len: 200, lens: '254' });
    expect(r.ok).toBe(false);
    expect(r.erreurs[0].key).toBe('len');
    expect(validerValeurs(cfg, { scan: 4, len: 200, lens: '420' }).ok).toBe(true);
  });

  it('calcule les indicateurs comme le simulateur', () => {
    const v = valeursParDefaut(cfg);
    const m = modeleLaser(cfg, v);
    expect(m.P).toBeCloseTo(255); // 300 W × 85 %
    expect(m.E).toBeCloseTo(12.75); // 255 W / 20 kHz
    expect(m.ecart).toBeCloseTo(1); // 20 m/s / 20 kHz
    expect(technologie('laser-pulse')!.indicateurs(cfg, v)).toHaveLength(5);
  });
});

describe('validation du schéma', () => {
  it('rejette une config incohérente', () => {
    const casse = structuredClone(brut);
    casse.pages[0].sections[0].champs[0].defaut = 999;
    expect(() => chargerConfig(casse)).toThrow(/Limites incohérentes/);
  });
});
