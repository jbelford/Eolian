import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute, SignInPage } from '../auth/auth-views';
import { MarketingLayout } from './layout';
import { AuthenticatedLayout } from './authenticated-layout';
import { HomePage } from '../marketing/home-page';
import { AccountRouteLayout, WorkspaceOverviewPage } from '../pages/workspace-pages';
import { AccountSettingsPage } from '../pages/account-settings-page';
import { GuildSettingsPage, GuildsSettingsPage } from '../pages/guild-settings-pages';

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
            <Route index element={<GuildsSettingsPage />} />
            <Route path=":guildId" element={<GuildSettingsPage />} />
          </Route>
          <Route path="account" element={<AccountRouteLayout />}>
            <Route index element={<AccountSettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  </BrowserRouter>
);
