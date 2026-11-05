import { useEffect, useState } from 'react';
import { tousLesChamps } from '@decapage/machine-kit';
import { Chargement, Erreur } from '../components/Composants';
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
                  <details key={i} open={i === 0}>
                    <summary>{t(g.titre)}</summary>
                    <p>{t(g.texte)}</p>
                  </details>
                ))}
              </div>
            </>
          )}

          <h2>Les réglages</h2>
          <div className="accordeon">
            {champs.map((c) => (
              <details key={c.key}>
                <summary>
                  <span>{t(c.label)}</span>
                  {c.label.en && <small>{c.label.en}</small>}
                </summary>
                <p>{t(c.aide)}</p>
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
              </details>
            ))}
          </div>

          <h2>Les indicateurs</h2>
          <div className="accordeon">
            <details>
              <summary>Énergie, crête, écart…</summary>
              <p>
                Sous les réglages, l'app calcule quelques repères à partir de vos valeurs : la puissance moyenne, l'énergie de
                chaque impulsion, la puissance crête et l'écart entre deux impulsions. Ce sont des calculs simples pour comparer
                des réglages entre eux ; une valeur marquée d'une étoile (*) dépend d'une estimation (taille du spot).
              </p>
            </details>
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
