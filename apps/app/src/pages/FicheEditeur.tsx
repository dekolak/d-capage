import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { completer, technologie, validerValeurs } from '@decapage/machine-kit';
import { ChoixTags, Chargement, Erreur, Etoiles, Galerie, Indicateurs, LIBELLE_PHOTO } from '../components/Composants';
import { Miroir } from '../components/Miroir';
import { api, chargerVersion, envoyerPhoto, Fiche, GroupeTag, MaMachine, PhotoRef, Tag, TypePhoto, Version } from '../lib/api';
import { compresser } from '../lib/image';
import {
  Brouillon, brouillonUtile, ecrireBrouillon, ecrirePhotosBrouillon, effacerBrouillon, lireBrouillon, lirePhotosBrouillon,
} from '../lib/brouillon';
import { nomMachine } from '../lib/util';

interface NouvellePhoto { type: TypePhoto; fichier: Blob; miniature: Blob; apercu: string }
const ETAPES = ['Machine', 'Surface', 'Avant', 'Réglages', 'Écran', 'Résultat'] as const;

/** Création (avec brouillon local), duplication (?depuis=id) et modification (/fiches/:id/modifier). */
export default function FicheEditeur() {
  const { id: ficheId } = useParams();
  const [qs] = useSearchParams();
  const depuis = qs.get('depuis');
  const modif = !!ficheId;
  const nav = useNavigate();

  const [machines, setMachines] = useState<MaMachine[]>();
  const [groupes, setGroupes] = useState<GroupeTag[]>([]);
  const [version, setVersion] = useState<Version>();
  const [b, setB] = useState<Brouillon>({ userMachineId: '', valeurs: null, tagIds: [], titre: '', commentaire: '', note: null, etape: modif ? 1 : 0 });
  const [photos, setPhotos] = useState<NouvellePhoto[]>([]);
  const [existantes, setExistantes] = useState<PhotoRef[]>([]);
  const [noteInitiale, setNoteInitiale] = useState<number | null>(null);
  const [parent, setParent] = useState<Fiche>();
  const [repris, setRepris] = useState<number | null>(null);
  const [pret, setPret] = useState(false); // brouillon relu : on peut sauvegarder
  const [err, setErr] = useState<unknown>();
  const [envoi, setEnvoi] = useState('');
  const maj = (p: Partial<Brouillon>) => setB((x) => ({ ...x, ...p }));

  // Chargement initial
  useEffect(() => {
    (async () => {
      const [ms, gs] = await Promise.all([api<MaMachine[]>('/moi/machines'), api<GroupeTag[]>('/tags')]);
      setMachines(ms);
      setGroupes(gs);
      if (modif) {
        const f = await api<Fiche>(`/fiches/${ficheId}`);
        const v = await chargerVersion(f.version.id);
        setVersion(v);
        setExistantes(f.photos);
        setNoteInitiale(f.note.maNote);
        ajouterTagsInconnus(gs, f.tags);
        setB({
          userMachineId: f.machine.userMachineId ?? '', valeurs: completer(v.config, f.valeurs),
          tagIds: f.tags.map((t) => t.id), titre: f.titre, commentaire: f.commentaire ?? '',
          note: f.note.maNote, etape: 1,
        });
      } else if (depuis) {
        const p = await api<Fiche>(`/fiches/${depuis}`);
        setParent(p);
        ajouterTagsInconnus(gs, p.tags);
        const m = ms.find((x) => x.varianteId === p.machine.varianteId) ?? ms[0];
        maj({ userMachineId: m?.id ?? '', valeurs: p.valeurs, tagIds: p.tags.map((t) => t.id), titre: p.titre, etape: m ? 1 : 0 });
      } else {
        const brouillon = lireBrouillon();
        const ph = await lirePhotosBrouillon();
        if (brouillonUtile(brouillon, ph.length)) {
          setB({ ...brouillon!, userMachineId: ms.some((m) => m.id === brouillon!.userMachineId) ? brouillon!.userMachineId : '' });
          setPhotos(ph.map((x) => ({ ...x, apercu: URL.createObjectURL(x.miniature) })));
          setRepris(brouillon!.maj ?? Date.now());
        } else if (ms.length === 1) maj({ userMachineId: ms[0].id, etape: 1 });
      }
      setPret(true);
    })().catch(setErr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficheId, depuis]);

  function ajouterTagsInconnus(gs: GroupeTag[], tags: Tag[]) {
    // Tags proposés (pas encore validés) : on les ajoute à la liste pour pouvoir les afficher.
    const connus = new Set(gs.flatMap((g) => g.tags.map((t) => t.id)));
    const manquants = tags.filter((t) => !connus.has(t.id));
    if (manquants.length)
      setGroupes(gs.map((g) => ({ ...g, tags: [...g.tags, ...manquants.filter((t) => t.groupe === g.slug)] })));
  }

  // Sauvegarde automatique du brouillon (création simple) : champs + photos
  const avecBrouillon = !modif && !depuis;
  useEffect(() => {
    if (avecBrouillon && pret) ecrireBrouillon(b);
  }, [b, avecBrouillon, pret]);
  useEffect(() => {
    if (avecBrouillon && pret) ecrirePhotosBrouillon(photos);
  }, [photos, avecBrouillon, pret]);

  const recommencer = async () => {
    if (!confirm('Effacer le brouillon et recommencer une fiche vide ?')) return;
    await effacerBrouillon();
    setPhotos([]);
    setRepris(null);
    setB({ userMachineId: machines?.length === 1 ? machines[0].id : '', valeurs: null, tagIds: [], titre: '', commentaire: '', note: null, etape: machines?.length === 1 ? 1 : 0 });
  };

  // Config de la machine choisie
  const machine = machines?.find((m) => m.id === b.userMachineId);
  useEffect(() => {
    if (modif || !machine?.version) return;
    chargerVersion(machine.version.id)
      .then((v) => {
        setVersion(v);
        setB((x) => ({ ...x, valeurs: completer(v.config, x.valeurs) }));
      })
      .catch(setErr);
  }, [machine?.version?.id, modif]);

  const validation = useMemo(
    () => (version && b.valeurs ? validerValeurs(version.config, b.valeurs) : null),
    [version, b.valeurs],
  );
  const indicateurs = useMemo(
    () => (version && b.valeurs ? technologie(version.config.technologie)?.indicateurs(version.config, b.valeurs) ?? [] : []),
    [version, b.valeurs],
  );

  const ajouterPhoto = async (type: TypePhoto, fichiers: FileList | null) => {
    if (!fichiers) return;
    try {
      const nv = await Promise.all([...fichiers].map(async (f) => ({ type, ...(await compresser(f)) })));
      setPhotos((p) => [...p, ...nv]);
    } catch (e) {
      setErr(e);
    }
  };

  const proposerTag = async (groupeId: string, nom: string) => {
    const t = await api<Tag>('/tags', { method: 'POST', json: { groupeId, nom } });
    setGroupes((gs) => gs.map((g) => (g.id === groupeId && !g.tags.some((x) => x.id === t.id) ? { ...g, tags: [...g.tags, t] } : g)));
    maj({ tagIds: [...new Set([...b.tagIds, t.id])] });
  };

  const titreSuggere = () =>
    groupes.flatMap((g) => g.tags).filter((t) => b.tagIds.includes(t.id)).map((t) => t.nom).slice(0, 3).join(' · ');

  const aller = (e: number) => {
    if (e === 5 && !b.titre) maj({ etape: e, titre: titreSuggere() });
    else maj({ etape: e });
    window.scrollTo(0, 0);
  };

  const enregistrer = async () => {
    if (!validation?.ok) return aller(3);
    if (!b.titre.trim()) return setErr(new Error('Donnez un titre à la fiche'));
    setErr(undefined);
    try {
      setEnvoi('Enregistrement…');
      const corps = {
        titre: b.titre, commentaire: b.commentaire, valeurs: validation.valeurs, tagIds: b.tagIds,
      };
      const f = modif
        ? await api<Fiche>(`/fiches/${ficheId}`, { method: 'PATCH', json: corps })
        : await api<Fiche>('/fiches', {
            method: 'POST',
            json: { ...corps, userMachineId: b.userMachineId, note: b.note ?? undefined, parentId: parent?.id },
          });
      if (modif && b.note && b.note !== noteInitiale)
        await api(`/fiches/${f.id}/evaluation`, { method: 'POST', json: { note: b.note } });
      for (const [i, p] of photos.entries()) {
        setEnvoi(`Envoi des photos ${i + 1}/${photos.length}…`);
        await envoyerPhoto(f.id, p.type, p);
      }
      if (avecBrouillon) await effacerBrouillon();
      nav(`/fiches/${f.id}`, { replace: true });
    } catch (e) {
      setErr(e);
      setEnvoi('');
    }
  };

  const supprimerExistante = async (p: PhotoRef) => {
    if (!confirm('Supprimer cette photo ?')) return;
    await api(`/photos/${p.id}`, { method: 'DELETE' }).catch(setErr);
    setExistantes((x) => x.filter((y) => y.id !== p.id));
  };

  if (!machines) return <div className="page"><Erreur e={err} /><Chargement /></div>;
  if (!machines.length && !modif)
    return (
      <div className="page vide-etat">
        <h1>Nouvelle fiche</h1>
        <p>Ajoutez d'abord votre machine.</p>
        <Link to="/machines" className="btn prim">Ajouter une machine</Link>
      </div>
    );

  const e = b.etape;
  const NOM_PHOTO: Record<TypePhoto, string> = { AVANT: 'Photo avant', APRES: 'Photo après', INTERFACE: 'Photo écran', AUTRE: 'Photo' };
  const blocPhotos = (type: TypePhoto, conseil: string) => {
    const nb = photos.filter((p) => p.type === type).length + existantes.filter((p) => p.type === type).length;
    return (
    <section>
      <p className="muted">{conseil}</p>
      <div className="boutons-photo">
        <label className={'bouton-photo' + (nb ? ' fait' : '')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13.5" r="3.8" />
          </svg>
          <span className="bp-texte">
            <b>{nb ? `+ ${NOM_PHOTO[type]}` : NOM_PHOTO[type]}</b>
            <small>{nb ? `${nb} photo${nb > 1 ? 's' : ''} ✓ · toucher pour en ajouter` : 'Toucher pour prendre la photo'}</small>
          </span>
          <input type="file" accept="image/*" capture="environment" hidden onChange={(ev) => ajouterPhoto(type, ev.target.files)} />
        </label>
        <label className="btn">
          Choisir dans la galerie
          <input type="file" accept="image/*" multiple hidden onChange={(ev) => ajouterPhoto(type, ev.target.files)} />
        </label>
      </div>
      <Galerie photos={existantes.filter((p) => p.type === type)} onSupprimer={supprimerExistante} />
      <div className="galerie">
        {photos.map((p, i) =>
          p.type === type ? (
            <figure key={i}>
              <img src={p.apercu} alt="" />
              <figcaption>{LIBELLE_PHOTO[type]}</figcaption>
              <button type="button" className="suppr" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label="Retirer">×</button>
            </figure>
          ) : null,
        )}
      </div>
    </section>
    );
  };

  return (
    <div className="page editeur">
      <h1>{modif ? 'Modifier la fiche' : parent ? 'Dupliquer un réglage' : 'Nouvelle fiche'}</h1>
      {parent && <p className="muted petit">À partir de « {parent.titre} » ({parent.auteur})</p>}

      <ol className="etapes">
        {ETAPES.map((n, i) => (
          <li key={n} className={(i === e ? 'on ' : '') + (i < e ? 'fait' : '')}>
            <button type="button" onClick={() => aller(i)} disabled={(modif && i === 0) || (i > 0 && !version)}>
              <span>{i + 1}</span>
              {n}
            </button>
          </li>
        ))}
      </ol>

      {repris && (
        <div className="bandeau">
          <span>Brouillon du {new Date(repris).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} repris.</span>
          <button type="button" className="btn-lien" onClick={recommencer}>Recommencer</button>
        </div>
      )}
      {avecBrouillon && !repris && <p className="muted petit">Enregistré automatiquement sur ce téléphone : vous pouvez reprendre plus tard.</p>}

      <Erreur e={err} />

      {e === 0 && (
        <section>
          <h2>Quelle machine ?</h2>
          <div className="liste-choix">
            {machines.map((m) => (
              <button key={m.id} type="button" className={'choix' + (b.userMachineId === m.id ? ' on' : '')}
                onClick={() => maj({ userMachineId: m.id, ...(m.varianteId !== machine?.varianteId && !parent ? { valeurs: null } : {}) })}>
                {nomMachine(m)}
              </button>
            ))}
          </div>
          <Link to="/machines" className="lien">+ Ajouter une machine</Link>
        </section>
      )}

      {e === 1 && (
        <section>
          <h2>Surface décapée</h2>
          <ChoixTags groupes={groupes} choisis={b.tagIds} onChange={(tagIds) => maj({ tagIds })} onProposer={proposerTag} />
        </section>
      )}

      {e === 2 && (<><h2>Photo avant</h2>{blocPhotos('AVANT', 'La surface avant le décapage.')}</>)}

      {e === 3 && version && b.valeurs && (
        <section>
          <h2>Réglages</h2>
          <p className="muted petit">Recopiez l'écran de la machine : touchez une valeur pour la modifier.</p>
          <Miroir config={version.config} valeurs={b.valeurs} onChange={(valeurs) => maj({ valeurs })} erreurs={validation?.erreurs} />
          <Indicateurs liste={indicateurs} />
        </section>
      )}

      {e === 4 && (<><h2>Photo de l'écran machine</h2>{blocPhotos('INTERFACE', 'Une photo de l\'écran de réglage : elle sert de preuve et de vérification.')}</>)}

      {e === 5 && (
        <section className="form">
          <h2>Résultat</h2>
          {blocPhotos('APRES', 'La surface après le décapage.')}
          <label>
            Votre note
            <Etoiles note={b.note} onChange={(note) => maj({ note })} />
          </label>
          <label>
            Titre
            <input value={b.titre} maxLength={120} onChange={(ev) => maj({ titre: ev.target.value })} placeholder="ex. Rouille sur acier" />
          </label>
          <label>
            Commentaire
            <textarea rows={4} value={b.commentaire} onChange={(ev) => maj({ commentaire: ev.target.value })} placeholder="Nombre de passages, distance, remarques…" />
          </label>
          {validation && !validation.ok && (
            <div className="alerte">Réglages à corriger : {validation.erreurs.map((x) => `${x.key ?? ''} ${x.message}`).join(', ')}</div>
          )}
        </section>
      )}

      <div className="barre-etapes">
        <button type="button" className="btn" disabled={e === (modif ? 1 : 0) || !!envoi} onClick={() => aller(e - 1)}>‹ Retour</button>
        {e < 5 ? (
          <button type="button" className="btn prim" disabled={!version || (e === 0 && !b.userMachineId)} onClick={() => aller(e + 1)}>
            Suivant ›
          </button>
        ) : (
          <button type="button" className="btn prim" disabled={!!envoi} onClick={enregistrer}>{envoi || 'Enregistrer'}</button>
        )}
      </div>
    </div>
  );
}
