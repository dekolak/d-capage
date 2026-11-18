import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chargement, Erreur } from '../../components/Composants';
import { BoutonPartager } from '../../components/Partager';
import { EditeurPastille } from './Corrections';
import { EditeurEnsemble, EditionEnsemble, editionDe, FicheEnsemble, nouvelEnsemble, supprimerEnsemble } from './Ensembles';
import { lienResultat, rechercher } from './recherche';
import { useAuth } from '../../lib/auth';
import { Fenetre } from './Fenetres';
import { CANAUX_DEPART, CommandesInteractif, EtatCanaux, Interactif } from './Interactifs';
import { useProcedures, useSolutions } from './donneesProcedures';
import { choisirModeBlanc, ecranCite, Ecran, groupes, Guide, modeBlancChoisi, Pastille, PastilleNav, pastillesNavigation, useGuide } from './guides';
import './guides.css';
import { t } from '../../lib/i18n';

const CLE_REPERES = 'kiavik.reperes';
/** Affichage des pastilles (gardé sur le téléphone) : visibles, discrètes (points transparents) ou masquées. */
type Affichage = 'visibles' | 'discretes' | 'masquees';
const CLE_AFFICHAGE = 'kiavik.pastilles';
const CLE_ESSENTIELS = 'kiavik.essentiels';
const ICONE_AFFICHAGE: Record<Affichage, string> = { visibles: '👁', discretes: '◌', masquees: '🙈' };
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/**
 * Un écran d'un guide : capture (ou fenêtre recréée) + pastilles. Toucher une pastille ouvre sa fiche en bas.
 * Mobile d'abord : menu repliable (☰), zoom 240 % avec défilement au doigt, liste des repères sous la capture.
 * Adresse : /guides/<guide>/<écran>?p=<pastille> (la pastille est mise en surbrillance), ?g=<groupe> (groupe de boutons).
 * Recherche dans le guide (phrases, mots-clés, groupes) en haut ; affichage des pastilles (👁 visibles / discrètes / masquées,
 * essentiels seulement) ; appui long sur l'écran = les pastilles disparaissent le temps de regarder.
 */
export default function GuideEcran() {
  const { slug = '', ecran: idEcran } = useParams();
  const { guide, erreur } = useGuide(slug);
  if (erreur) return <div className="page"><Erreur e={erreur} /><Link to="/guides">{t('kiavik.guide.retour')}</Link></div>;
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
  const selGroupe = params.get('g');
  const [q, setQ] = useState('');
  const [affichage, setAffichage0] = useState<Affichage>(() => (localStorage.getItem(CLE_AFFICHAGE) as Affichage) || 'visibles');
  const [essentiels, setEssentiels0] = useState(() => localStorage.getItem(CLE_ESSENTIELS) === '1');
  const [reglages, setReglages] = useState(false);
  const [regarder, setRegarder] = useState(false);
  const [edition, setEdition] = useState<EditionEnsemble | null>(null);
  const appui = useRef<{ x: number; y: number; t: ReturnType<typeof setTimeout> } | null>(null);
  const apresAppui = useRef(false);
  const setAffichage = (a: Affichage) => (setAffichage0(a), localStorage.setItem(CLE_AFFICHAGE, a));
  const setEssentiels = (v: boolean) => (setEssentiels0(v), localStorage.setItem(CLE_ESSENTIELS, v ? '1' : '0'));
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
    if (edition) {
      // admin : on compose un groupe en touchant les boutons
      if (id) setEdition({ ...edition, pastilles: edition.pastilles.includes(id) ? edition.pastilles.filter((x) => x !== id) : [...edition.pastilles, id] });
      return;
    }
    if (id && e.interactif?.type === 'echantillon' && id === e.interactif.remise) setRemise((n) => n + 1);
    setParams(id ? { p: id } : {}, { replace: true });
  };
  const choisirGroupe = (id: string | null) => setParams(id ? { g: id } : {}, { replace: true });
  const ensemble = (e.ensembles ?? []).find((x) => x.id === selGroupe);

  // recherche dans ce guide : résultats en puces sous la barre
  const resultats = useMemo(() => (q.trim() ? rechercher([guide], q, 8) : []), [guide, q]);
  // boutons mis en avant (les autres s'estompent) : groupe choisi, ou résultats de la recherche sur cet écran
  const enAvant = new Set<string>(
    edition ? edition.pastilles : ensemble ? ensemble.pastilles : resultats.filter((r) => r.ecran === e.id).flatMap((r) => (r.type === 'ensemble' ? r.pastilles ?? [] : [r.pastille])),
  );
  const masquee = (p: Pastille) => essentiels && p.etat === 'non_utilise' && sel !== p.id && !enAvant.has(p.id);
  const ouvrirResultat = (r: (typeof resultats)[number]) => {
    setQ('');
    if (r.ecran === e.id) return r.type === 'ensemble' ? choisirGroupe(r.pastille) : choisir(r.pastille);
    nav(lienResultat(r));
  };

  // appui long sur l'écran : les pastilles disparaissent le temps de regarder
  const debutAppui = (ev: React.PointerEvent) => {
    const x = ev.clientX, y = ev.clientY;
    if (appui.current) clearTimeout(appui.current.t);
    appui.current = { x, y, t: setTimeout(() => (setRegarder(true), (apresAppui.current = true)), 450) };
  };
  const bougeAppui = (ev: React.PointerEvent) => {
    const a = appui.current;
    if (a && !regarder && Math.hypot(ev.clientX - a.x, ev.clientY - a.y) > 10) (clearTimeout(a.t), (appui.current = null));
  };
  const finAppui = () => {
    if (appui.current) clearTimeout(appui.current.t);
    appui.current = null;
    setRegarder(false);
  };
  /** Pastilles masquées : toucher l'écran ouvre la pastille la plus proche. */
  const toucherEcran = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (apresAppui.current) return void (apresAppui.current = false);
    if (affichage !== 'masquees' || (ev.target as HTMLElement).closest('button')) return;
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * e.largeur;
    const y = ((ev.clientY - r.top) / r.height) * e.hauteur;
    const proche = e.pastilles
      .filter((p) => !masquee(p))
      .map((p) => ({ p, d: Math.hypot(p.x - x, p.y - y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (proche && proche.d < e.largeur * 0.08) choisir(proche.p.id);
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
        <button type="button" className="gx-ic" aria-label={t('kiavik.guide.menu')} onClick={() => setMenu(true)}>☰</button>
        <div className="gx-titre"><small>{guide.nom}</small>{e.code} · {e.titre}</div>
        <button type="button" className={`gx-ic ${reglages ? 'on' : ''}`} aria-label={t('kiavik.guide.affichage')} onClick={() => setReglages(!reglages)}>
          {ICONE_AFFICHAGE[affichage]}
        </button>
        <button type="button" className={`gx-ic ${zoom ? 'on' : ''}`} aria-label={t('kiavik.guide.zoom')} onClick={() => setZoom(!zoom)}>⤢</button>
      </div>

      {reglages && (
        <div className="gx-affichage carte">
          <b className="petit">{t('kiavik.guide.affichage')}</b>
          <div className="seg">
            {(['visibles', 'discretes', 'masquees'] as Affichage[]).map((a) => (
              <button key={a} type="button" className={affichage === a ? 'on' : ''} onClick={() => setAffichage(a)}>
                {ICONE_AFFICHAGE[a]} {t(`kiavik.guide.pastilles.${a}`)}
              </button>
            ))}
          </div>
          {e.pastilles.some((p) => p.etat === 'non_utilise') && (
            <label className="gx-option">
              <input type="checkbox" checked={essentiels} onChange={(ev) => setEssentiels(ev.target.checked)} /> {t('kiavik.guide.essentiels')}
            </label>
          )}
          <small className="muted">{t('kiavik.guide.appuiLong')}</small>
        </div>
      )}

      <div className="gx-cherche">
        <input type="search" className="recherche" value={q} placeholder={t('kiavik.guide.chercher')} onChange={(ev) => setQ(ev.target.value)} />
        {q.trim() && (
          <div className="puces gx-cherche-res">
            {resultats.map((r) => (
              <button key={`${r.type}/${r.ecran}/${r.pastille}`} type="button" className={`puce ${r.type === 'ensemble' ? 'gx-puce-groupe' : ''}`} onClick={() => ouvrirResultat(r)}>
                {r.ecran !== e.id && <small className="muted">{r.codeEcran} · </small>}
                {r.type === 'ensemble' ? `▦ ${r.titre} (${r.pastilles?.length})` : `${r.pastille} · ${r.titre}`}
              </button>
            ))}
            {!resultats.length && <span className="muted petit">{t('kiavik.guide.rienTrouve')}</span>}
          </div>
        )}
      </div>

      {e.intro && <p className="gx-intro">{e.intro}</p>}
      {flash && <div className="gx-ok">✅ {flash}</div>}

      <div
        className={`gx-defile ${zoom ? 'zoom' : ''}`}
        onPointerDown={debutAppui}
        onPointerMove={bougeAppui}
        onPointerUp={finAppui}
        onPointerCancel={finAppui}
        onPointerLeave={finAppui}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <div
          className={`gx-shot p-${affichage} ${regarder ? 'regarde' : ''} ${enAvant.size ? 'avec-avant' : ''} ${edition ? 'edition' : ''}`}
          style={{ aspectRatio: `${e.largeur} / ${e.hauteur}` }}
          onClick={toucherEcran}
        >
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
                <span>{p.zone.libelle ?? (p.etat === 'preregle' ? t('kiavik.guide.preregle') : t('kiavik.guide.nonUtilise'))}</span>
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
          {e.pastilles.filter((p) => !masquee(p)).map((p) => (
            <button
              type="button"
              key={p.id}
              className={`gx-p ${p.etat && p.etat !== 'actif' ? 'off' : ''} ${sel === p.id ? 'sel' : ''} ${enAvant.has(p.id) ? 'avant' : ''}`}
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

      {edition && <EditeurEnsemble guide={guide} e={e} v={edition} onChange={setEdition} onFini={(id) => (setEdition(null), id && choisirGroupe(id))} />}

      {(e.ensembles ?? []).length > 0 && (
        <>
          <h4>{t('kiavik.guide.groupes')}</h4>
          <div className="puces">
            {e.ensembles!.map((en) => (
              <button key={en.id} type="button" className={`puce gx-puce-groupe ${selGroupe === en.id ? 'on' : ''}`} onClick={() => choisirGroupe(selGroupe === en.id ? null : en.id)}>
                ▦ {en.nom} ({en.pastilles.length})
              </button>
            ))}
          </div>
        </>
      )}

      <h4>{t('kiavik.guide.reperes')}</h4>
      <div className="gx-liste">
        {e.pastilles.filter((p) => !masquee(p)).map((p) => (
          <button type="button" key={p.id} className={`gx-item ${p.etat && p.etat !== 'actif' ? 'off' : ''} ${sel === p.id ? 'on' : ''}`} onClick={() => choisir(p.id)}>
            <b>{p.id}</b>{p.titre}
            {p.etat === 'non_utilise' && <i>{t('kiavik.guide.nonUtiliseListe')}</i>}
            {p.etat === 'preregle' && <i>{t('kiavik.guide.preregleListe')}</i>}
          </button>
        ))}
      </div>

      {ensemble && !pastille && !edition && (
        <>
          <div className="gx-masque" onClick={() => choisirGroupe(null)} />
          <div className="gx-fiche" role="dialog" aria-label={ensemble.nom}>
            <button type="button" className="gx-fermer" aria-label={t('commun.fermer')} onClick={() => choisirGroupe(null)}>✕</button>
            <FicheEnsemble
              e={e}
              en={ensemble}
              onBouton={(id) => setParams({ p: id }, { replace: true })}
              onModifier={() => setEdition(editionDe(ensemble))}
              onSupprimer={() => supprimerEnsemble(guide, e, ensemble.id).then(() => choisirGroupe(null))}
            />
          </div>
        </>
      )}

      {pastille && !edition && (
        <>
          <div className="gx-masque" onClick={() => choisir(null)} />
          <div className="gx-fiche" role="dialog" aria-label={pastille.titre}>
            <button type="button" className="gx-fermer" aria-label={t('commun.fermer')} onClick={() => choisir(null)}>✕</button>
            <FichePastille guide={guide} e={e} p={pastille} onOuvrir={(id) => aller(id)} />
            <div className="gx-partage"><BoutonPartager titre={`${guide.nom} · ${e.code} · ${pastille.id} ${pastille.titre}`} /></div>
          </div>
        </>
      )}

      {menu && (
        <>
          <div className="gx-masque" onClick={() => setMenu(false)} />
          <div className="gx-menu">
            <div className="gx-menu-tete">
              <b>{guide.nom}</b>
              <button type="button" className="gx-ic" aria-label={t('commun.fermer')} onClick={() => setMenu(false)}>✕</button>
            </div>
            <Link to="/guides" className="gx-autres">{t('kiavik.guide.tousLesGuides')}</Link>
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
              <button type="button" className="btn petit" onClick={() => (setMenu(false), setParams({}, { replace: true }), setEdition(nouvelEnsemble()))}>
                ▦ Nouveau groupe de boutons (admin)
              </button>
            )}
            {admin && (
              <label className="gx-option">
                <input
                  type="checkbox"
                  checked={reperes}
                  onChange={(ev) => (setReperes(ev.target.checked), localStorage.setItem(CLE_REPERES, ev.target.checked ? '1' : '0'))}
                />
                {t('kiavik.guide.afficherReperes')}
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FichePastille({ guide, e, p, onOuvrir }: { guide: Guide; e: Ecran; p: Pastille; onOuvrir(id: string): void }) {
  const off = p.etat === 'non_utilise' ? t('kiavik.guide.refNonUtilise') : p.etat === 'preregle' ? t('kiavik.guide.refPreregle') : '';
  const conseil = p.conseil ?? (p.etat === 'preregle' ? t('kiavik.guide.preregleConseil') : undefined);
  const lien = ecranCite(guide, p.texte, e.id);
  const { liste } = useProcedures();
  const anims = (guide.animations ?? []).filter((a) => a.liens?.some(([ec, id]) => ec === e.id && id === p.id));
  const liees = (liste ?? []).filter((x) => x.liens.some((l) => l.guide === guide.slug && l.ecran === e.id && l.pastille === p.id));
  const { liste: solutions } = useSolutions();
  const astuces = (solutions ?? []).filter((x) => x.guide === guide.slug && x.ecran === e.id && x.pastille === p.id);
  const { moi } = useAuth();
  const [edition, setEdition] = useState(false);
  // fiche modifiée : on referme le formulaire si l'on change de bouton
  useEffect(() => {
    setEdition(false);
  }, [p.id]);
  if (edition) return <EditeurPastille guide={guide} e={e} p={p} onFermer={() => setEdition(false)} />;
  return (
    <>
      {moi?.role === 'ADMIN' && (
        <div className="cx-actions" style={{ marginBottom: 6 }}>
          <button type="button" className="btn petit" onClick={() => setEdition(true)}>✏️ Modifier</button>
          {p.corrige && <span className="cx-badge">modifié dans l'app</span>}
        </div>
      )}
      <span className={`gx-ref ${off ? 'off' : ''}`}>{e.code} · {p.id}{off}</span>
      <h3>{p.titre}</h3>
      <p>{p.texte}</p>
      {conseil &&
        (p.niveau === 'a_completer' ? (
          <div className="gx-todo">{t('kiavik.guide.aCompleter', { texte: conseil })}</div>
        ) : p.niveau === 'avertissement' ? (
          <div className="gx-warn">⚠️ {conseil}</div>
        ) : (
          <div className="gx-tip">💡 {conseil}</div>
        ))}
      {p.special === 'menu_blanc' && guide.modesBlanc && <MenuBlanc modes={guide.modesBlanc} />}
      {lien && (
        <button type="button" className="btn prim petit gx-ouvrir" onClick={() => onOuvrir(lien.id)}>
          {t('kiavik.guide.ouvrirEcran', { code: lien.code })}
        </button>
      )}
      {astuces.length > 0 && (
        <div className="gx-proc-lies">
          {astuces.map((x) => (
            <Link key={x.id} to={`/solutions/${x.id}`} className="btn petit">{t('kiavik.guide.voirSolution', { titre: x.titre })}</Link>
          ))}
        </div>
      )}
      {(liees.length > 0 || anims.length > 0) && (
        <div className="gx-proc-lies">
          {anims.map((a) => (
            <Link key={a.id} to={`/guides/${guide.slug}/animation/${a.id}`} className="btn petit">{t('kiavik.guide.voirAnimation', { titre: a.titre })}</Link>
          ))}
        </div>
      )}
      {liees.length > 0 && (
        <div className="gx-proc-lies">
          {liees.map((x) => (
            <Link key={x.id} to={`/procedures/${x.id}`} className="btn petit">{t('kiavik.guide.voirProcedure', { titre: x.titre })}</Link>
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
            {plus.includes(x.nom) && <i>{t('kiavik.guide.plusUtilise')}</i>}
          </button>
        ))}
      </div>
      {plus.includes(m.nom) ? (
        <div className="gx-choisir">
          <b>{t('kiavik.guide.quelBlanc')}</b>
          <div className="gx-onglets">
            {plus.map((n) => (
              <button type="button" key={n} className={n === m.nom ? 'on' : ''} onClick={() => setChoix(n)}>{n}</button>
            ))}
          </div>
          <div className="gx-blanc-imgs">
            <figure><img src={m.image_canal} alt="" /><figcaption>{t('kiavik.guide.apercuLogiciel')}</figcaption></figure>
            <figure><img src={m.image_mur} alt="" /><figcaption>{t('kiavik.guide.resultatMur')}</figcaption></figure>
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
