import { Link as HeroLink } from '@heroui/react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from './brand';

export const SiteFooter = () => (
  <footer className="border-t border-separator bg-surface">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
      <div className="max-w-sm">
        <BrandMark />
        <p className="mt-4 text-sm leading-6 text-muted">
          A Discord music bot built for the moment between someone saying “play this” and the whole
          channel singing along.
        </p>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Explore</h2>
        <div className="mt-4 flex flex-col items-start gap-3 text-sm">
          <a className="footer-link" href="/#features">
            Features
          </a>
          <a className="footer-link" href="/#command-modes">
            Command modes
          </a>
          <Link className="footer-link" to="/app">
            Sign in
          </Link>
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Project</h2>
        <div className="mt-4 flex flex-col items-start gap-3 text-sm">
          <HeroLink href="https://github.com/jbelford/Eolian" target="_blank">
            GitHub
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </HeroLink>
          <HeroLink href="https://github.com/jbelford/Eolian/issues" target="_blank">
            Report an issue
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </HeroLink>
        </div>
      </div>
    </div>
    <div className="border-t border-separator px-5 py-5 text-center text-xs text-muted sm:px-8">
      Eolian is an independent open-source project and is not affiliated with Discord.
    </div>
  </footer>
);
