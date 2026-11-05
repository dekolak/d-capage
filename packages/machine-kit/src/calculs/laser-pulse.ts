import type { ChampChoix, ConfigMachine, Valeurs } from '../schema';
import type { Erreur } from '../valeurs';
import type { Indicateur, Technologie } from './types';

const num = (v: unknown, d = 0) => (typeof v === 'number' ? v : Number(v ?? d));

function lentille(cfg: ConfigMachine, v: Valeurs) {
  for (const p of cfg.pages)
    for (const s of p.sections)
      for (const c of s.champs)
        if (c.key === 'lens' && c.type === 'choix') {
          const o = (c as ChampChoix).options.find((x) => String(x.valeur) === String(v.lens));
          return o?.donnees ?? {};
        }
  return {};
}

/** Formules simples, identiques au simulateur du site. */
export function modeleLaser(cfg: ConfigMachine, v: Valeurs) {
  const pmax = num(cfg.constantes.pmax);
  const spotRef = num(cfg.constantes.spot_f254_mm, 0.1);
  const L = lentille(cfg, v);
  const P = (pmax * num(v.pwr)) / 100; // W
  const freq = num(v.freq, 1); // kHz
  const E = P / freq; // mJ = W / kHz
  const spot = (spotRef * num(L.focale, 254)) / 254; // mm (hypothèse)
  const ecart = num(v.speed) / freq; // mm = (m/s) / kHz
  const pw = num(v.pw);
  return {
    P,
    E,
    spot,
    ecart,
    recouvrement: 1 - ecart / spot,
    crete: pw ? (E / pw) * 1000 : 0, // kW
    periode: 1000 / freq, // µs
    zone: num(L.zone, Infinity),
  };
}

export const laserPulse: Technologie = {
  id: 'laser-pulse',
  nom: 'Laser pulsé',
  indicateurs(cfg, v): Indicateur[] {
    const m = modeleLaser(cfg, v);
    const r = +(m.recouvrement * 100).toFixed(0);
    return [
      { key: 'puissance', label: 'Puissance moyenne', valeur: +m.P.toFixed(0), unite: 'W' },
      { key: 'energie', label: 'Énergie / impulsion', valeur: +m.E.toFixed(2), unite: 'mJ' },
      { key: 'crete', label: 'Puissance crête', valeur: +m.crete.toFixed(1), unite: 'kW', note: 'calcul simple, forme d\'impulsion non connue' },
      { key: 'ecart', label: 'Écart entre impulsions', valeur: +m.ecart.toFixed(3), unite: 'mm' },
      r >= 0
        ? { key: 'recouvrement', label: 'Recouvrement', valeur: r, unite: '%', hypothese: true, note: 'trace continue' }
        : {
            key: 'recouvrement',
            label: 'Écart / spot',
            valeur: +(m.ecart / m.spot).toFixed(1),
            unite: '× le spot',
            hypothese: true,
            note: 'points séparés : les passages suivants complètent',
          },
    ];
  },
  valider(cfg, v): Erreur[] {
    const e: Erreur[] = [];
    const { zone } = modeleLaser(cfg, v);
    const geo = [1, 3, 4].includes(num(v.scan));
    if (geo) {
      if (num(v.len) > zone) e.push({ key: 'len', message: `max ${zone} mm avec la lentille ${v.lens}` });
      if (num(v.wid) > zone) e.push({ key: 'wid', message: `max ${zone} mm avec la lentille ${v.lens}` });
    } else if (2 * num(v.oR) > zone) {
      e.push({ key: 'oR', message: `max ${zone / 2} mm avec la lentille ${v.lens}` });
    }
    if (num(v.scan) === 2 && num(v.iR) >= num(v.oR))
      e.push({ key: 'iR', message: 'doit être inférieur au rayon ext.' });
    return e;
  },
};
