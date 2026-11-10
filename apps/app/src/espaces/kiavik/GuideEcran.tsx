import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { useAuth } from '../../lib/auth';
import { Fenetre } from './Fenetres';
import { CANAUX_DEPART, CommandesInteractif, EtatCanaux, Interactif } from './Interactifs';
import { useProcedures } from './donneesProcedures';
import { choisirModeBlanc, ecranCite, Ecran, groupes, Guide, modeBlancChoisi, Pastille, PastilleNav, pastillesNavigation, useGuide } from './guides';
import './guides.css';

const CLE_REPERES = 'kiavik.reperes';
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/**
 * Un écran d'un guide : capture (ou fenêtre recréée) + pastilles. Toucher une pastille ouvre sa fiche en bas.
 * Mobile d'abord : menu repliable (☰), zoom 240 % avec défilement au doigt, liste des repères sous la capture.
 * Adresse : /guides/<guide>/<écran>?p=<pastille> (la pastille est mise en surbrillance).
 */
export default function GuideEcran() {
  const { slug = '', ecran: idEcran } = useParams();
  const { guide, erreur } = useGuide(slug);
  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/guides">← Guides</Link></div>;
  if (!guide) return <Chargement />;
  const e = guide.ecrans.find((x) => x.id === idEcran);
  if (!e) return <Navigate to={`/guides/${slug}/${guide.ecrans[0].id}`} replace />;
  return <Vue key={e.id} guide={guide} e={e} />;
}

function Vue({ guide, e }: { guide: Guide; e: Ecran }) {
  const { moi } = useAuth();
  const admin = moi?.role === 'ADMIN';
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const sel = params.get('p');
  const [menu, setMenu] = useState(false);
  const [zoom, setZoom] = useState(() => sessionStorage.getItem('kiavik.zoom') === '1');
  const [reperes, setReperes] = useState(() => admin && localStorage.getItem(CLE_REPERES) === '1');
  const flash = (loc.state as { flash?: string } | null)?.flash;

  const navs = useMemo(() => pastillesNavigation(guide, e), [guide, e]);
  const pastille: Pastille | undefined = e.pastilles.find((p) => p.id === sel) ?? navs.find((n) => n.info?.id === sel)?.info;
  const i = guide.ecrans.indexOf(e);
  const [prec, suiv] = [guide.ecrans[i - 1], guide.ecrans[i + 1]];
  const aller = (id: string, p?: string) => nav(`/guides/${guide.slug}/${id}${p ? `?p=${encodeURIComponent(p)}` : ''}`);
  const [remise, setRemise] = useState(0);
  const [canaux, setCanaux] = useState<EtatCanaux>(CANAUX_DEPART);
  const choisir = (id: string | null) => {
    if (id && e.interactif?.type === 'echantillon' && id === e.interactif.remise) setRemise((n) => n + 1);
    setParams(id ? { p: id } : {}, { replace: true });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    sessionStorage.setItem('kiavik.zoom', zoom ? '1' : '0');
  }, [zoom]);

  const toucherNav = (n: PastilleNav) => (n.vers ? aller(n.vers) : n.info && choisir(n.info.id));
  /** Écran d'où l'on vient pour une fenêtre (celui qui la cite), sinon le premier. */
  const parent = guide.ecrans.find((x) => x.pastilles.some((p) => ecranCite(guide, p.texte, x.id)?.id === e.id)) ?? guide.ecrans[0];

  return (
    <div className="page gx">
      <div className="gx-barre">
        <button type="button" className="gx-ic" aria-label="Menu des écrans" onClick={() => setMenu(true)}>☰</button>
        <div className="gx-titre"><small>{guide.nom}</small>{e.code} · {e.titre}</div>
        <button type="button" className={`gx-ic ${zoom ? 'on' : ''}`} aria-label="Zoom" onClick={() => setZoom(!zoom)}>⤢</button>
      </div>

      {e.intro && <p className="gx-intro">{e.intro}</p>}
      {flash && <div className="gx-ok">✅ {flash}</div>}

      <div className={`gx-defile ${zoom ? 'zoom' : ''}`}>
        <div className="gx-shot" style={{ aspectRatio: `${e.largeur} / ${e.hauteur}` }}>
          {e.type === 'capture' && e.image ? (
            <img src={e.image} alt={e.titre} draggable={false} />
          ) : (
            <Fenetre
              fenetre={e.fenetre ?? ''}
              largeur={e.largeur}
              hauteur={e.hauteur}
              onFermer={(ok, message) => nav(`/guides/${guide.slug}/${parent.id}`, { state: ok ? { flash: message } : undefined })}
            />
          )}
          {e.pastilles.map((p) =>
            p.zone ? (
              <div
                key={`z${p.id}`}
                className={`gx-zone ${p.etat === 'preregle' ? 'pre' : ''}`}
                style={{ left: pct(p.zone.x, e.largeur), top: pct(p.zone.y, e.hauteur), width: pct(p.zone.largeur, e.largeur), height: pct(p.zone.hauteur, e.hauteur) }}
              >
                <span>{p.zone.libelle ?? (p.etat === 'preregle' ? 'préréglé' : 'non utilisé')}</span>
              </div>
            ) : null,
          )}
          <Interactif guide={guide} e={e} remise={remise} canaux={canaux} setCanaux={setCanaux} />
          {reperes && (
            <>
              <div className="gx-filigrane">{e.code}</div>
              <div className="gx-tag">Écran {e.code}</div>
            </>
          )}
          {navs.map((n) => (
            <button
              type="button"
              key={n.id}
              className={`gx-p nav ${n.actif || sel === n.info?.id ? 'sel' : ''}`}
              style={{ left: pct(n.x, e.largeur), top: pct(n.y, e.hauteur) }}
              onClick={() => toucherNav(n)}
              title={n.vers ? `Aller à ${n.label}` : n.info?.titre}
            >
              {n.label}
            </button>
          ))}
          {e.pastilles.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`gx-p ${p.etat && p.etat !== 'actif' ? 'off' : ''} ${sel === p.id ? 'sel' : ''}`}
              style={{ left: pct(p.x, e.largeur), top: pct(p.y, e.hauteur) }}
              onClick={() => choisir(sel === p.id ? null : p.id)}
              aria-label={`${p.id} ${p.titre}`}
            >
              {p.id}
            </button>
          ))}
        </div>
      </div>

      <CommandesInteractif guide={guide} e={e} remise={remise} canaux={canaux} setCanaux={setCanaux} />

      <div className="gx-suite">
        {prec ? <button type="button" className="btn petit" onClick={() => aller(prec.id)}>← {prec.code}</button> : <span />}
        {suiv && <button type="button" className="btn petit" onClick={() => aller(suiv.id)}>{suiv.code} →</button>}
      </div>

      <h4>Repères</h4>
      <div className="gx-liste">
        {e.pastilles.map((p) => (
          <button type="button" key={p.id} className={`gx-item ${p.etat && p.etat !== 'actif' ? 'off' : ''} ${sel === p.id ? 'on' : ''}`} onClick={() => choisir(p.id)}>
            <b>{p.id}</b>{p.titre}
            {p.etat === 'non_utilise' && <i> (non utilisé)</i>}
            {p.etat === 'preregle' && <i> (préréglé)</i>}
          </button>
        ))}
      </div>

      {pastille && (
        <>
          <div className="gx-masque" onClick={() => choisir(null)} />
          <div className="gx-fiche" role="dialog" aria-label={pastille.titre}>
            <button type="button" className="gx-fermer" aria-label="Fermer" onClick={() => choisir(null)}>✕</button>
            <FichePastille guide={guide} e={e} p={pastille} onOuvrir={(id) => aller(id)} />
          </div>
        </>
      )}

      {menu && (
        <>
          <div className="gx-masque" onClick={() => setMenu(false)} />
          <div className="gx-menu">
            <div className="gx-menu-tete">
              <b>{guide.nom}</b>
              <button type="button" className="gx-ic" aria-label="Fermer" onClick={() => setMenu(false)}>✕</button>
            </div>
            <Link to="/guides" className="gx-autres">← Tous les guides</Link>
            {groupes(guide).map(([g, ecrans]) => (
              <details key={g} className="gx-groupe" open={ecrans.includes(e) || ecrans.length === 1}>
                <summary>{g}<span>{ecrans.length}</span></summary>
                {ecrans.map((x) => (
                  <button type="button" key={x.id} className={`gx-lien ${x === e ? 'on' : ''}`} onClick={() => (setMenu(false), aller(x.id))}>
                    <span className="code">{x.code}</span>{x.titre}
                  </button>
                ))}
              </details>
            ))}
            {admin && (
              <label className="gx-option">
                <input
                  type="checkbox"
                  checked={reperes}
                  onChange={(ev) => (setReperes(ev.target.checked), localStorage.setItem(CLE_REPERES, ev.target.checked ? '1' : '0'))}
                />
                Afficher les repères d'écran (admin)
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FichePastille({ guide, e, p, onOuvrir }: { guide: Guide; e: Ecran; p: Pastille; onOuvrir(id: string): void }) {
  const off = p.etat === 'non_utilise' ? ' · non utilisé' : p.etat === 'preregle' ? ' · préréglé' : '';
  const conseil = p.conseil ?? (p.etat === 'preregle' ? 'Préréglé : ne pas toucher.' : undefined);
  const lien = ecranCite(guide, p.texte, e.id);
  const { liste } = useProcedures();
  const anims = (guide.animations ?? []).filter((a) => a.liens?.some(([ec, id]) => ec === e.id && id === p.id));
  const liees = (liste ?? []).filter((x) => x.liens.some((l) => l.guide === guide.slug && l.ecran === e.id && l.pastille === p.id));
  return (
    <>
      <span className={`gx-ref ${off ? 'off' : ''}`}>{e.code} · {p.id}{off}</span>
      <h3>{p.titre}</h3>
      <p>{p.texte}</p>
      {conseil &&
        (p.niveau === 'a_completer' ? (
          <div className="gx-todo">À compléter (visible par l'admin seulement) : {conseil}</div>
        ) : p.niveau === 'avertissement' ? (
          <div className="gx-warn">⚠️ {conseil}</div>
        ) : (
          <div className="gx-tip">💡 {conseil}</div>
        ))}
      {p.special === 'menu_blanc' && guide.modesBlanc && <MenuBlanc modes={guide.modesBlanc} />}
      {lien && (
        <button type="button" className="btn prim petit gx-ouvrir" onClick={() => onOuvrir(lien.id)}>
          Ouvrir l'écran {lien.code}
        </button>
      )}
      {(liees.length > 0 || anims.length > 0) && (
        <div className="gx-proc-lies">
          {anims.map((a) => (
            <Link key={a.id} to={`/guides/${guide.slug}/animation/${a.id}`} className="btn petit">🎬 Voir l'animation : {a.titre}</Link>
          ))}
        </div>
      )}
      {liees.length > 0 && (
        <div className="gx-proc-lies">
          {liees.map((x) => (
            <Link key={x.id} to={`/procedures/${x.id}`} className="btn petit">📋 Voir la procédure : {x.titre}</Link>
          ))}
        </div>
      )}
    </>
  );
}

/** Les modes de blanc (T4 / 4.1) ; pour les plus utilisés, la fenêtre « Quel blanc choisir ? ». */
function MenuBlanc({ modes }: { modes: NonNullable<Guide['modesBlanc']> }) {
  const plus = modes.plus_utilises ?? [];
  const [choix, setChoix0] = useState(() => modeBlancChoisi(plus[0] ?? modes.modes[0].nom));
  const setChoix = (n: string) => {
    setChoix0(n);
    choisirModeBlanc(n); // repris par l'aperçu du blanc en T9
  };
  const m = modes.modes.find((x) => x.nom === choix) ?? modes.modes[0];
  return (
    <div className="gx-blanc">
      <div className="gx-blanc-liste">
        {modes.modes.map((x) => (
          <button type="button" key={x.nom} className={x.nom === choix ? 'on' : ''} onClick={() => setChoix(x.nom)}>
            {x.nom}
            {plus.includes(x.nom) && <i>le plus utilisé</i>}
          </button>
        ))}
      </div>
      {plus.includes(m.nom) ? (
        <div className="gx-choisir">
          <b>Quel blanc choisir ?</b>
          <div className="gx-onglets">
            {plus.map((n) => (
              <button type="button" key={n} className={n === m.nom ? 'on' : ''} onClick={() => setChoix(n)}>{n}</button>
            ))}
          </div>
          <div className="gx-blanc-imgs">
            <figure><img src={m.image_canal} alt="" /><figcaption>Aperçu dans le logiciel (noir = blanc)</figcaption></figure>
            <figure><img src={m.image_mur} alt="" /><figcaption>Résultat sur un mur foncé</figcaption></figure>
          </div>
          <p><b>{m.nom}</b> : {m.texte}</p>
        </div>
      ) : (
        <div className="gx-blanc-apercu">
          <img src={m.image_canal} alt="" />
          <div><b>{m.nom}</b><span>{m.texte}</span></div>
        </div>
      )}
      {modes.convention && <p className="muted petit">{modes.convention}</p>}
    </div>
  );
}
