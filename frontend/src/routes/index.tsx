import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { HomePage } from '@/pages/HomePage';
import { SignInPage } from '@/pages/SignInPage';
import { MethodologyPage } from '@/pages/MethodologyPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { ScreeningPage } from '@/pages/ScreeningPage';
import { CompanyIntelligencePage } from '@/pages/CompanyIntelligencePage';
import { ComparableCompaniesPage } from '@/pages/ComparableCompaniesPage';
import { PrecedentTransactionsPage } from '@/pages/PrecedentTransactionsPage';
import { ValuationSummaryPage } from '@/pages/ValuationSummaryPage';
import { DealBuilderPage } from '@/pages/DealBuilderPage';
import { SourcesUsesPage } from '@/pages/SourcesUsesPage';
import { AccretionDilutionPage } from '@/pages/AccretionDilutionPage';
import { ScenarioAnalysisPage } from '@/pages/ScenarioAnalysisPage';
import { SensitivityAnalysisPage } from '@/pages/SensitivityAnalysisPage';
import { DealComparisonPage } from '@/pages/DealComparisonPage';
import { ICReportPage } from '@/pages/ICReportPage';
import { UnderConstructionPage } from '@/pages/UnderConstructionPage';

export const router = createBrowserRouter([
  /* Public Routes */
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    path: '/methodology',
    element: <MethodologyPage />,
  },

  /* Authenticated Workstation Shell */
  {
    element: <AppShell />,
    children: [
      {
        path: '/overview',
        element: <OverviewPage />,
      },

      /* Research Navigation Group — Production Stage 3A Screens */
      {
        path: '/research/screening',
        element: <ScreeningPage />,
      },
      {
        path: '/research/companies',
        element: <CompanyIntelligencePage />,
      },
      {
        path: '/research/comps',
        element: <ComparableCompaniesPage />,
      },
      {
        path: '/research/comparable-companies',
        element: <ComparableCompaniesPage />,
      },
      {
        path: '/research/precedents',
        element: <PrecedentTransactionsPage />,
      },
      {
        path: '/research/precedent-transactions',
        element: <PrecedentTransactionsPage />,
      },
      {
        path: '/research/valuation',
        element: <ValuationSummaryPage />,
      },

      /* Deal Workspace Navigation Group */
      {
        path: '/deals',
        element: <Navigate to="/deal-builder" replace />,
      },
      {
        path: '/deal-builder',
        element: <DealBuilderPage />,
      },
      {
        path: '/sources-uses',
        element: <SourcesUsesPage />,
      },
      {
        path: '/accretion-dilution',
        element: <AccretionDilutionPage />,
      },
      {
        path: '/scenarios',
        element: <ScenarioAnalysisPage />,
      },
      {
        path: '/deal-workspace/scenarios',
        element: <ScenarioAnalysisPage />,
      },
      {
        path: '/sensitivity',
        element: <SensitivityAnalysisPage />,
      },
      {
        path: '/deal-workspace/sensitivity',
        element: <SensitivityAnalysisPage />,
      },

      /* Portfolio Navigation Group */
      {
        path: '/portfolio/deal-comparison',
        element: <DealComparisonPage />,
      },
      {
        path: '/deal-comparison',
        element: <DealComparisonPage />,
      },

      /* Output Navigation Group */
      {
        path: '/output/ic-report',
        element: <ICReportPage />,
      },
      {
        path: '/ic-report',
        element: <ICReportPage />,
      },

      /* System Navigation Group */
      {
        path: '/data-methodology',
        element: (
          <UnderConstructionPage
            title="Data & Methodology"
            category="System"
            plannedPhase="System Data Audit"
            description="Transparent data-quality audit surfacing statement completeness, missing items, coverage depth, and calculation methodology."
            backendEndpoint="/api/v1/dataset/summary"
          />
        ),
      },
      {
        path: '/settings',
        element: (
          <UnderConstructionPage
            title="Settings"
            category="System"
            plannedPhase="System Settings"
            description="Workstation user preferences, tabular display density, keyboard shortcuts, currency units (₹ Cr), and API endpoint configuration."
          />
        ),
      },

      /* Catch-all route within shell redirects to Overview */
      {
        path: '*',
        element: <Navigate to="/overview" replace />,
      },
    ],
  },
]);
