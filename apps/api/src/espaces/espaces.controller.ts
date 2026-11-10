import { Controller, Get, Header, Req } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { ESPACES, EspaceDef, espaceDeLaRequete } from './espaces';

const publique = (e: EspaceDef) => ({
  slug: e.slug,
  nom: e.nom,
  nomApp: e.nomApp,
  nomCourt: e.nomCourt,
  domaines: e.domaines,
  couleur: e.couleur,
  couleurFoncee: e.couleurFoncee,
  couleurDouce: e.couleurDouce,
  icones: e.icones,
  communaute: e.communaute,
  modules: e.modules,
});

@Controller()
export class EspacesController {
  /** Tous les espaces (l'app choisit celui de son adresse, l'admin s'en sert pour les accès). */
  @Get('espaces')
  @Public()
  lister() {
    return ESPACES.map(publique);
  }

  /** Espace de l'adresse appelée. */
  @Get('espace')
  @Public()
  courant(@Req() req: { headers: Record<string, string> }) {
    return publique(espaceDeLaRequete(req));
  }

  /** Manifeste PWA selon l'adresse : nom, couleur et icône de l'espace sur l'écran d'accueil du téléphone. */
  @Get('manifest.webmanifest')
  @Public()
  @Header('Content-Type', 'application/manifest+json')
  @Header('Cache-Control', 'no-cache')
  manifeste(@Req() req: { headers: Record<string, string> }) {
    const e = espaceDeLaRequete({ headers: { ...req.headers, 'x-espace': '' } });
    return {
      name: e.nomApp,
      short_name: e.nomCourt,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: e.couleur,
      icons: [
        { src: `${e.icones}icone.svg`, sizes: 'any', type: 'image/svg+xml' },
        { src: `${e.icones}icone-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${e.icones}icone-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    };
  }
}
