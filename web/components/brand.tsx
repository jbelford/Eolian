import { Link } from 'react-router-dom';
import logoUrl from '../assets/eolian-logo.png';

export const BrandMark = () => (
  <Link
    aria-label="Eolian home"
    className="group inline-flex items-center gap-3 rounded-full text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    to="/"
  >
    <img alt="" className="brand-mark" height="36" src={logoUrl} width="36" />
    <span className="font-display text-lg font-bold tracking-[-0.03em]">Eolian</span>
  </Link>
);
