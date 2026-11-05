import { ReactNode, useEffect, useRef, useState } from 'react';
import { tousLesChamps } from '@decapage/machine-kit';
import { Chargement, Erreur } from '../components/Composants';
import { AnimationReglage } from '../components/AnimationsLaser';
import { Icone } from '../components/Miroir';
import { api, chargerVersion, Fabricant, MaMachine, Version } from '../lib/api';
import { t } from '../lib/util';

/**
 * Aide simple pour comprendre les réglages. Le contenu vient de la config de la machine
 * (textes « aide » de chaque champ + « guide ») : une nouvelle machine apporte sa propre aide.
 * L'aide complète (simulateur, exercices) reste sur le site.
 */
export default function Aide() {
  const [choix, setChoix] = useState<{ versionId: string; nom: string }[]>([]);
  const [versionId, setVersionId] = useState('');
  const [v, setV] = useState<Version>();
  const [err, setErr] = useState<unknown>();
  // Une seule rubrique ouverte à la fois sur toute la page.
  const [ouvert, setOuvert] = useState<string | null>('guide-0');
  const r = (id: string) => ({ id, ouvert: ouvert === id, basculer: () => setOuvert(ouvert === id ? null : id) });

  useEffect(() => {
    Promise.all([api<MaMachine[]>('/moi/machines'), api<Fabricant[]>('/catalogue')])
      .then(([mes, cat]) => {
        // Mes machines d'abord, puis le reste du catalogue (sans doublon).
        const liste = new Map<string, string>();
        for (const m of mes) if (m.version) liste.set(m.version.id, m.nom);
        for (const f of cat) for (const mo of f.modeles) for (const va of mo.variantes) if (!liste.has(va.version.id)) liste.set(va.version.id, `${f.nom} ${mo.nom} ${va.nom}`);
        const l = [...liste].map(([id, nom]) => ({ versionId: id, nom }));
        setChoix(l);
        if (l[0]) setVersionId(l[0].versionId);
      })
      .catch(setErr);
  }, []);

  useEffect(() => {
    if (versionId) chargerVersion(versionId).then(setV).catch(setErr);
  }, [versionId]);

  const cfg = v?.config;
  const champs = cfg ? tousLesChamps(cfg).filter((c) => c.aide) : [];

  return (
    <div className="page aide">
      <h1>Aide</h1>
      <p className="muted">Comprendre chaque réglage en quelques mots.</p>
      {choix.length > 1 && (
        <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          {choix.map((c) => <option key={c.versionId} value={c.versionId}>{c.nom}</option>)}
        </select>
      )}
      <Erreur e={err} />
      {!cfg ? (
        <Chargement />
      ) : (
        <>
          {cfg.guide.length > 0 && (
            <>
              <h2>Les bases</h2>
              <div className="accordeon">
                {cfg.guide.map((g, i) => (
                  <Rubrique key={i} {...r(`guide-${i}`)} titre={t(g.titre)}>
                    <p>{t(g.texte)}</p>
                  </Rubrique>
                ))}
              </div>
            </>
          )}

          <h2>Les réglages</h2>
          <div className="accordeon">
            {champs.map((c) => (
              <Rubrique
                key={c.key}
                {...r(c.key)}
                titre={
                  <>
                    <span>{t(c.label)}</span>
                    {c.label.en && <small>{c.label.en}</small>}
                  </>
                }
              >
                <p>{t(c.aide)}</p>
                {cfg.technologie === 'laser-pulse' && <AnimationReglage k={c.key} />}
                {c.type === 'nombre' && (
                  <p className="plage">
                    De {c.min} à {c.max}
                    {c.unite ? ` ${c.unite}` : ''}
                  </p>
                )}
                {c.type === 'choix' && c.affichage === 'icones' && (
                  <div className="aide-icones">
                    {c.options.map((o) => (
                      <div key={String(o.valeur)}>
                        {o.icone && <span className="m-sc"><Icone svg={o.icone} /></span>}
                        <small>{t(o.label)}</small>
                      </div>
                    ))}
                  </div>
                )}
              </Rubrique>
            ))}
          </div>

          <h2>Les indicateurs</h2>
          <div className="accordeon">
            <Rubrique {...r('indicateurs')} titre="Énergie, crête, écart…">
              <p>
                Sous les réglages, l'app calcule quelques repères à partir de vos valeurs : la puissance moyenne, l'énergie de
                chaque impulsion, la puissance crête et l'écart entre deux impulsions. Ce sont des calculs simples pour comparer
                des réglages entre eux ; une valeur marquée d'une étoile (*) dépend d'une estimation (taille du spot).
              </p>
            </Rubrique>
          </div>

          {cfg.lienAide && (
            <a href={cfg.lienAide} target="_blank" rel="noreferrer" className="bandeau lien-bandeau">
              <span><b>Aller plus loin</b> : simulateur et exercices sur le site</span>
              <span>›</span>
            </a>
          )}
        </>
      )}
    </div>
  );
}

/** Rubrique repliable contrôlée : ouvrir l'une ferme les autres, et la garde visible à l'écran. */
function Rubrique({ ouvert, basculer, titre, children }: { id: string; ouvert: boolean; basculer(): void; titre: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    // Les rubriques au-dessus se referment : on recale celle-ci en haut de l'écran.
    if (ouvert) requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [ouvert]);
  return (
    <details ref={ref} open={ouvert}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          basculer();
        }}
      >
        {titre}
      </summary>
      {ouvert && children}
    </details>
  );
}
