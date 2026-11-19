import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assemblerConfig,
  chargerConfig,
  champsEnregistres,
  modeleLaser,
  modeleSoudure,
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

describe('config ZEKO mini 300', () => {
  const cfg = chargerConfig(
    JSON.parse(readFileSync(join(__dirname, '../../../machines/lazzeko/zeko-mini-300/v1.json'), 'utf8')),
  );

  it('valeurs d\'usine et champs selon la trajectoire', () => {
    expect(valeursParDefaut(cfg)).toMatchObject({ traj: 4, sx: 5, sy: 5, speed: 1000, pwr: 100, freq: 20, pw: 9 });
    const spirale = validerValeurs(cfg, { ...valeursParDefaut(cfg), traj: 5 });
    expect(spirale.valeurs).toHaveProperty('pitch');
    expect(spirale.valeurs).not.toHaveProperty('sy');
    expect(validerValeurs(cfg, { traj: 5, sx: 5, inside: 6 }).erreurs.map((e) => e.key)).toContain('inside');
  });

  it('plafonne l\'énergie à 15 mJ et compte la vitesse en mm/s', () => {
    const m = modeleLaser(cfg, { pwr: 100, freq: 10, speed: 1000 });
    expect(m.E).toBe(15);
    expect(m.P).toBe(150); // 15 mJ × 10 kHz
    expect(m.ecart).toBeCloseTo(0.1); // 1000 mm/s ÷ 10 kHz
    expect(m.spot).toBe(0.1);
    expect(modeleLaser(cfg, { pwr: 100, freq: 20, speed: 1000 }).E).toBe(15);
  });
});

describe('soudeuses laser (base commune)', () => {
  const dir = join(__dirname, '../../../machines/lazzeko');
  const lire = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
  const charger = (p: number) =>
    chargerConfig(assemblerConfig(lire(join(dir, `soudeuse-laser-${p}w/v1.json`)), (b) => lire(join(dir, `soudeuse-laser-${p}w`, b))));
  const s2000 = charger(2000);
  const s1500 = charger(1500);

  it('hérite de la base et garde sa puissance', () => {
    expect(s2000.technologie).toBe('soudure-laser');
    expect(s2000.constantes).toMatchObject({ pmax: 2000, pref_cordon: 3000 });
    expect(s1500.constantes.pmax).toBe(1500);
    expect(s1500.pages.map((p) => p.id)).toEqual(['principal', 'avance']);
    expect(s1500.apparence).toBe('ecran');
    expect(s1500.source?.notes.length).toBeGreaterThan(3);
  });

  it('sans fil d\'apport : les réglages du fil ne sont pas enregistrés', () => {
    const sans = validerValeurs(s2000, { ...valeursParDefaut(s2000), won: false });
    expect(sans.ok).toBe(true);
    for (const k of ['wire', 'ws', 'wmode']) expect(sans.valeurs).not.toHaveProperty(k);
    expect(validerValeurs(s2000, valeursParDefaut(s2000)).valeurs).toHaveProperty('ws', 10);
  });

  it('calcule la puissance de sortie et le repère largeur / fil', () => {
    const v = valeursParDefaut(s2000); // 50 %, 100 %, largeur 1,5, fil 1,2
    expect(modeleSoudure(s2000, v).sortie).toBe(1000);
    expect(modeleSoudure(s1500, v).sortie).toBe(750);
    const ind = technologie('soudure-laser')!.indicateurs(s2000, { ...v, wd: 3 });
    expect(ind.find((i) => i.key === 'rapportFil')).toMatchObject({ valeur: 2.5 });
    expect(technologie('soudure-laser')!.indicateurs(s2000, { ...v, mode: 1, pt: 200 }).find((i) => i.key === 'tir')?.valeur).toBe(200);
  });
});
