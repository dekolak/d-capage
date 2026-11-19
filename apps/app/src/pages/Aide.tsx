import { ReactNode, useEffect, useRef, useState } from 'react';
import { tousLesChamps, universTechnologie } from '@decapage/machine-kit';
import { Chargement, Erreur } from '../components/Composants';
import { AnimationReglage } from '../components/AnimationsLaser';
import { Icone } from '../components/Miroir';
import { api, chargerVersion, Fabricant, MaMachine, Version } from '../lib/api';
import { libelle } from '../lib/util';
import { langue, t } from '../lib/i18n';
import { BasculeUnivers, universMachine, useUnivers } from '../lib/univers';

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

  const [donnees, setDonnees] = useState<{ mes: MaMachine[]; cat: Fabricant[] }>();
  const u = useUnivers(donnees?.mes);
  useEffect(() => {
    Promise.all([api<MaMachine[]>('/moi/machines'), api<Fabricant[]>('/catalogue')])
      .then(([mes, cat]) => setDonnees({ mes, cat }))
      .catch(setErr);
  }, []);
  // Machines du métier choisi (décapage / soudure) : les miennes d'abord, puis le reste du catalogue (sans doublon).
  useEffect(() => {
    if (!donnees) return;
    const liste = new Map<string, string>();
    for (const m of donnees.mes) if (m.version && universMachine(m) === u.univers) liste.set(m.version.id, m.nom);
    for (const f of donnees.cat)
      for (const mo of f.modeles)
        if (universTechnologie(mo.technologie) === u.univers)
          for (const va of mo.variantes) if (va.version && !liste.has(va.version.id)) liste.set(va.version.id, `${f.nom} ${mo.nom} ${va.nom}`);
    const l = [...liste].map(([id, nom]) => ({ versionId: id, nom }));
    setChoix(l);
    setVersionId(l[0]?.versionId ?? '');
  }, [donnees, u.univers]);

  useEffect(() => {
    if (versionId) chargerVersion(versionId).then(setV).catch(setErr);
  }, [versionId]);

  const cfg = v?.config;
  const champs = cfg ? tousLesChamps(cfg).filter((c) => c.aide) : [];

  return (
    <div className="page aide">
      <h1>{t('aide.titre')}</h1>
      <p className="muted">{t('aide.intro')}</p>
      <BasculeUnivers {...u} />
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
              <h2>{t('aide.bases')}</h2>
              <div className="accordeon">
                {cfg.guide.map((g, i) => (
                  <Rubrique key={i} {...r(`guide-${i}`)} titre={libelle(g.titre)}>
                    <p>{libelle(g.texte)}</p>
                  </Rubrique>
                ))}
              </div>
            </>
          )}

          <h2>{t('aide.reglages')}</h2>
          <div className="accordeon">
            {champs.map((c) => (
              <Rubrique
                key={c.key}
                {...r(c.key)}
                titre={
                  <>
                    <span>{libelle(c.label)}</span>
                    {c.label.en && c.label.en !== c.label.fr && langue() !== 'en' && <small>{c.label.en}</small>}
                  </>
                }
              >
                <p>{libelle(c.aide)}</p>
                {cfg.technologie === 'laser-pulse' && <AnimationReglage k={c.key} />}
                {c.type === 'nombre' && (
                  <p className="plage">
                    {t('aide.plage', { min: c.min, max: c.max, unite: c.unite ? ` ${c.unite}` : '' })}
                  </p>
                )}
                {c.type === 'choix' && c.affichage === 'icones' && (
                  <div className="aide-icones">
                    {c.options.map((o) => (
                      <div key={String(o.valeur)}>
                        {o.icone && <span className="m-sc"><Icone svg={o.icone} /></span>}
                        <small>{libelle(o.label)}</small>
                      </div>
                    ))}
                  </div>
                )}
              </Rubrique>
            ))}
          </div>

          <h2>{t('aide.indicateurs')}</h2>
          <div className="accordeon">
            <Rubrique {...r('indicateurs')} titre={u.univers === 'soudure' ? t('aide.indicateursTitreSoudure') : t('aide.indicateursTitre')}>
              <p>{u.univers === 'soudure' ? t('aide.indicateursTexteSoudure') : t('aide.indicateursTexte')}</p>
            </Rubrique>
          </div>

          {cfg.lienAide && (
            <a href={cfg.lienAide} target="_blank" rel="noreferrer" className="bandeau lien-bandeau">
              <span><b>{t('aide.plusLoin')}</b>{t('aide.plusLoinDetail')}</span>
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
