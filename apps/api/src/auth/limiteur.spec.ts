import { HttpException } from '@nestjs/common';
import { Limiteur } from './limiteur';

describe('Limiteur', () => {
  it('bloque après le maximum, par clé, puis se libère', () => {
    const l = new Limiteur(3, 1);
    for (let i = 0; i < 3; i++) l.essai('ip1');
    expect(() => l.essai('ip1')).toThrow(HttpException);
    expect(() => l.essai('ip2')).not.toThrow();
    l.effacer('ip1');
    expect(() => l.essai('ip1')).not.toThrow();
  });

  it('verifier ne compte pas', () => {
    const l = new Limiteur(1, 1);
    l.verifier('a');
    l.verifier('a');
    l.compter('a');
    expect(() => l.verifier('a')).toThrow(/Trop d'essais/);
  });
});
