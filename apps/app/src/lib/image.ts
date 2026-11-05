/**
 * Compression côté téléphone avant envoi : une photo de 4–12 Mo devient ~300 Ko.
 * Retourne l'image (1600 px max) et une miniature (400 px max), en JPEG.
 */
export async function compresser(f: File | Blob): Promise<{ fichier: Blob; miniature: Blob; apercu: string }> {
  const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const versJpeg = (max: number, qualite: number) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Compression impossible'))), 'image/jpeg', qualite));
  };
  const fichier = await versJpeg(1600, 0.82);
  const miniature = await versJpeg(400, 0.75);
  bmp.close();
  return { fichier, miniature, apercu: URL.createObjectURL(miniature) };
}
