import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, SignInPage } from '../auth/auth-views';
import { MarketingLayout } from './layout';
import { AuthenticatedLayout } from './authenticated-layout';
import { HomePage } from '../marketing/home-page';
import {
  AccountOverviewPage,
  AccountRouteLayout,
  GuildOverviewPage,
  GuildRouteLayout,
  GuildsPage,
  WorkspaceOverviewPage,
} from '../pages/workspace-pages';

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<HomePage />} />
        <Route path="sign-in" element={<SignInPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="app" element={<AuthenticatedLayout />}>
          <Route index element={<WorkspaceOverviewPage />} />
          <Route path="guilds">
            <Route index element={<GuildsPage />} />
            <Route path=":guildId" element={<GuildRouteLayout />}>
              <Route index element={<GuildOverviewPage />} />
            </Route>
          </Route>
          <Route path="account" element={<AccountRouteLayout />}>
            <Route index element={<AccountOverviewPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  </BrowserRouter>
);
