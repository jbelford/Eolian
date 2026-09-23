import { Outlet } from 'react-router-dom';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';

export const MarketingLayout = () => (
  <div className="flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground">
    <a
      className="fixed left-4 top-4 z-50 -translate-y-24 rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground shadow-lg transition-transform focus:translate-y-0"
      href="#main-content"
    >
      Skip to content
    </a>
    <SiteHeader />
    <main className="flex-1" id="main-content">
      <Outlet />
    </main>
    <SiteFooter />
  </div>
);
