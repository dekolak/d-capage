import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Champ,
  ChampChoix,
  ChampNombre,
  ConfigMachine,
  Erreur,
  estVisible,
  Section,
  Valeurs,
} from '@decapage/machine-kit';
import { t } from '../lib/util';

/**
 * Miroir de l'interface machine, construit uniquement à partir de la config JSON.
 * - lecture seule si `onChange` est absent ;
 * - toucher une ligne ouvre un panneau de saisie (clavier numérique, −/+, curseur) ;
 * - « Suivant » enchaîne les champs dans l'ordre de l'écran réel.
 */
export function Miroir({
  config,
  valeurs,
  onChange,
  erreurs = [],
}: {
  config: ConfigMachine;
  valeurs: Valeurs;
  onChange?: (v: Valeurs) => void;
  erreurs?: Erreur[];
}) {
  const [page, setPage] = useState(config.pages[0].id);
  const [edit, setEdit] = useState<string | null>(null);
  const lecture = !onChange;
  const th = config.theme;
  const style = {
    '--m-fond': th.fond, '--m-carte': th.carte, '--m-pastille': th.pastille, '--m-orange': th.orange,
    '--m-rouge': th.rouge, '--m-marine': th.marine, '--m-ligne': th.ligne,
  } as React.CSSProperties;

  // Ordre de saisie : tous les champs visibles, page par page (pour « Suivant »).
  const ordre = useMemo(
    () =>
      config.pages.flatMap((p) =>
        p.sections.flatMap((s) => colonnes(s, valeurs).flat().map((c) => ({ page: p.id, champ: c }))),
      ),
    [config, valeurs],
  );
  const erreurDe = (k: string) => erreurs.find((e) => e.key === k)?.message;
  const pageCourante = config.pages.find((p) => p.id === page) ?? config.pages[0];

  const ouvrir = (c: Champ) => {
    if (lecture) return;
    if (c.type === 'interrupteur') return onChange!({ ...valeurs, [c.key]: !valeurs[c.key] });
    setEdit(c.key);
  };
  const aller = (delta: number) => {
    const i = ordre.findIndex((o) => o.champ.key === edit);
    let j = i + delta;
    while (ordre[j] && ordre[j].champ.type === 'interrupteur') j += delta;
    const o = ordre[j];
    if (!o) return setEdit(null);
    setPage(o.page);
    setEdit(o.champ.key);
  };
  const champEdite = ordre.find((o) => o.champ.key === edit)?.champ;

  return (
    <div className="miroir" style={style}>
      <div className="m-logo">{config.fabricant.nom.toUpperCase()}</div>
      {config.pages.length > 1 && (
        <div className="m-nav">
          {config.pages.map((p) => (
            <button key={p.id} type="button" className={p.id === page ? 'on' : ''} onClick={() => setPage(p.id)}>
              {t(p.label)}
            </button>
          ))}
        </div>
      )}

      {pageCourante.sections.map((s) =>
        s.zone === 'haut' ? (
          <div key={s.id} className="m-tuiles">
            {s.champs.filter((c) => estVisible(c, valeurs)).map((c) => (
              <button key={c.key} type="button" className={'m-tuile' + (valeurs[c.key] ? ' on' : '')} onClick={() => ouvrir(c)} disabled={lecture}>
                <span className="m-ic" />
                {t(c.label)}
              </button>
            ))}
          </div>
        ) : (
          <div key={s.id} className={'m-carte cols-' + Math.min(2, colonnes(s, valeurs).length)}>
            {colonnes(s, valeurs).map((col, i) => (
              <div key={i} className="m-col">
                {col.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={'m-ligne' + (edit === c.key ? ' sel' : '') + (erreurDe(c.key) ? ' err' : '')}
                    onClick={() => ouvrir(c)}
                    disabled={lecture}
                  >
                    <span className="m-lab">{t(c.label)}</span>
                    <ValeurAffichee champ={c} v={valeurs[c.key]} />
                  </button>
                ))}
              </div>
            ))}
          </div>
        ),
      )}

      {!lecture && page === config.pages[0].id && config.presets.length > 0 && (
        <div className="m-lib">
          {config.presets.map((p) => (
            <button
              key={p.no}
              type="button"
              onClick={() => {
                const v = { ...valeurs, ...p.valeurs };
                if ('paramNo' in valeurs) v.paramNo = p.no;
                onChange!(v);
              }}
              title={p.exemple ? 'Valeurs d\'exemple' : 'Valeurs lues sur la machine'}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      )}

      {champEdite && !lecture && (
        <Panneau
          champ={champEdite}
          valeur={valeurs[champEdite.key]}
          erreur={erreurDe(champEdite.key)}
          onChange={(v) => onChange!({ ...valeurs, [champEdite.key]: v })}
          onFermer={() => setEdit(null)}
          onPrecedent={() => aller(-1)}
          onSuivant={() => aller(1)}
        />
      )}
    </div>
  );
}

/** Répartit les champs visibles d'une section en colonnes (propriété `colonne`). */
function colonnes(s: Section, valeurs: Valeurs): Champ[][] {
  const n = s.colonnes;
  const cols: Champ[][] = Array.from({ length: n }, () => []);
  for (const c of s.champs) if (estVisible(c, valeurs)) cols[Math.min(n, c.colonne ?? 1) - 1].push(c);
  return cols.filter((c) => c.length);
}

function fmt(c: ChampNombre, v: unknown) {
  const n = Number(v);
  const dec = c.step < 1 ? String(c.step).split('.')[1]?.length ?? 1 : 0;
  return Number.isFinite(n) ? (dec && n % 1 ? n.toFixed(dec) : String(n)) : '—';
}

export function Icone({ svg, couleur = '#fff' }: { svg: string; couleur?: string }) {
  return <svg viewBox="0 0 56 36" fill="none" stroke={couleur} strokeLinecap="round" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ValeurAffichee({ champ: c, v }: { champ: Champ; v: unknown }) {
  switch (c.type) {
    case 'nombre':
      return <span className="m-v">{fmt(c, v)}</span>;
    case 'interrupteur':
      return <span className={'m-tg' + (v ? ' on' : '')}>{v ? 'ON' : 'OFF'}</span>;
    case 'texte':
      return <span className="m-txt">{String(v ?? '') || '---'}</span>;
    case 'choix': {
      const o = c.options.find((x) => String(x.valeur) === String(v));
      if (c.affichage === 'icones' && o?.icone)
        return (
          <span className="m-sc" title={t(o.label)}>
            <Icone svg={o.icone} />
          </span>
        );
      return <span className="m-v">{o ? String(o.valeur) : '—'}</span>;
    }
  }
}

function Panneau({
  champ: c,
  valeur,
  erreur,
  onChange,
  onFermer,
  onPrecedent,
  onSuivant,
}: {
  champ: Champ;
  valeur: unknown;
  erreur?: string;
  onChange: (v: string | number | boolean) => void;
  onFermer(): void;
  onPrecedent(): void;
  onSuivant(): void;
}) {
  return (
    <div className="m-pnl" role="dialog" aria-label={t(c.label)}>
      <div className="m-pnl-h">
        <div>
          <b>{t(c.label)}</b>
          {c.label.en && <small> · {c.label.en}</small>}
        </div>
        <button type="button" className="m-x" onClick={onFermer} aria-label="Fermer">×</button>
      </div>
      {c.aide && <p className="m-aide">{t(c.aide)}</p>}
      {c.type === 'nombre' && <SaisieNombre key={c.key} champ={c} valeur={Number(valeur)} onChange={onChange} onValider={onSuivant} />}
      {c.type === 'choix' && <SaisieChoix champ={c} valeur={valeur} onChange={onChange} />}
      {c.type === 'texte' && (
        <input
          className="m-input"
          maxLength={c.maxLength}
          value={valeur === '---' ? '' : String(valeur ?? '')}
          onChange={(e) => onChange(e.target.value || '---')}
          onKeyDown={(e) => e.key === 'Enter' && onSuivant()}
        />
      )}
      {erreur && <p className="m-erreur">{erreur}</p>}
      <div className="m-pnl-b">
        <button type="button" onClick={onPrecedent}>‹ Préc.</button>
        <button type="button" className="prim" onClick={onSuivant}>Suivant ›</button>
      </div>
    </div>
  );
}

function SaisieNombre({
  champ: c,
  valeur,
  onChange,
  onValider,
}: {
  champ: ChampNombre;
  valeur: number;
  onChange(v: number): void;
  onValider(): void;
}) {
  const [txt, setTxt] = useState(fmt(c, valeur));
  const ref = useRef<HTMLInputElement>(null);
  // Ne pas reformater pendant la frappe (sinon « 0, » deviendrait « 0 »).
  useEffect(() => {
    if (document.activeElement !== ref.current || Number(txt.replace(',', '.')) !== valeur) setTxt(fmt(c, valeur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur, c]);

  const log = c.echelle === 'log' && c.min > 0;
  const versCurseur = (v: number) => (log ? Math.round((1000 * Math.log(v / c.min)) / Math.log(c.max / c.min)) : v);
  const depuisCurseur = (r: number) => (log ? c.min * Math.pow(c.max / c.min, r / 1000) : r);
  const borne = (v: number) => {
    const n = Math.min(c.max, Math.max(c.min, v));
    return +(Math.round((n - c.min) / c.step) * c.step + c.min).toFixed(6);
  };
  const pas = log ? (valeur < 100 ? 1 : valeur < 1000 ? 10 : 50) : c.step;

  return (
    <div className="m-ctl">
      <div className="m-ctl-l">
        <button type="button" onClick={() => onChange(borne(valeur - pas))} aria-label="moins">−</button>
        <input
          ref={ref}
          className="m-input m-num"
          onFocus={(e) => e.target.select()}
          inputMode="decimal"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value);
            const n = Number(e.target.value.replace(',', '.'));
            if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => onChange(borne(valeur))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(borne(valeur));
              onValider();
            }
          }}
        />
        <button type="button" onClick={() => onChange(borne(valeur + pas))} aria-label="plus">+</button>
        {c.unite && <span className="m-unite">{c.unite}</span>}
      </div>
      <input
        type="range"
        min={log ? 0 : c.min}
        max={log ? 1000 : c.max}
        step={log ? 1 : c.step}
        value={versCurseur(Math.min(c.max, Math.max(c.min, valeur || c.min)))}
        onChange={(e) => onChange(borne(depuisCurseur(Number(e.target.value))))}
      />
      <div className="m-bornes">
        <span>{c.min}</span>
        <span>{c.max}</span>
      </div>
    </div>
  );
}

function SaisieChoix({ champ: c, valeur, onChange }: { champ: ChampChoix; valeur: unknown; onChange(v: string | number): void }) {
  return (
    <div className={'m-opts' + (c.affichage === 'icones' ? ' icones' : '')}>
      {c.options.map((o) => {
        const on = String(o.valeur) === String(valeur);
        return (
          <button key={String(o.valeur)} type="button" className={on ? 'on' : ''} onClick={() => onChange(o.valeur)}>
            {c.affichage === 'icones' && o.icone && <Icone svg={o.icone} couleur={on ? '#fff' : '#1d2433'} />}
            <span>{t(o.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
