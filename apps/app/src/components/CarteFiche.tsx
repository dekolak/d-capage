import { Link } from 'react-router-dom';
import { Fiche } from '../lib/api';
import { date } from '../lib/util';
import { ImageProtegee, NoteResume } from './Composants';

export function CarteFiche({ f, montrerAuteur }: { f: Fiche; montrerAuteur?: boolean }) {
  const photo = f.photos.find((p) => p.type === 'APRES') ?? f.photos.find((p) => p.type === 'AVANT') ?? f.photos[0];
  return (
    <Link to={`/fiches/${f.id}`} className="carte-fiche">
      {photo ? <ImageProtegee id={photo.id} min className="vignette" /> : <div className="vignette vide">◎</div>}
      <div className="cf-corps">
        <b>{f.titre}</b>
        <div className="muted petit">
          {f.machine.nom}
          {montrerAuteur ? ` · ${f.auteur}` : ''} · {date(f.createdAt)}
        </div>
        <div className="puces mini">
          {f.tags.slice(0, 4).map((t) => (
            <span key={t.id} className="puce">{t.nom}</span>
          ))}
        </div>
        <NoteResume moyenne={f.note.moyenne} nombre={f.note.nombre} />
      </div>
    </Link>
  );
}
