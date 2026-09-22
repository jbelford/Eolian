import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from './layout';
import { HomePage } from '../marketing/home-page';
import { WorkspacePlaceholder } from '../pages/workspace-placeholder';

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route index element={<HomePage />} />
        <Route path="app" element={<WorkspacePlaceholder section="overview" />} />
        <Route path="app/guilds" element={<WorkspacePlaceholder section="guilds" />} />
        <Route path="app/account" element={<WorkspacePlaceholder section="account" />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
