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
        element: (
          <UnderConstructionPage
            title="Scenario Analysis"
            category="Deal Workspace"
            plannedPhase="Stage 1D Scenarios Engine"
            description="Deterministic Base, Bull, and Bear transaction stress testing across organic growth rates, margin performance, and synergy capture schedules."
            backendEndpoint="/api/v1/deals/scenarios"
            isDealContextSensitive={true}
          />
        ),
      },
      {
        path: '/sensitivity',
        element: (
          <UnderConstructionPage
            title="Sensitivity Analysis"
            category="Deal Workspace"
            plannedPhase="Stage 1D Sensitivity Engine"
            description="Two-dimensional sensitivity matrix evaluating pro-forma EPS impact and deal feasibility across varying purchase premiums and financing interest rates."
            backendEndpoint="/api/v1/deals/sensitivity"
            isDealContextSensitive={true}
          />
        ),
      },

      /* Portfolio Navigation Group */
      {
        path: '/deal-comparison',
        element: (
          <UnderConstructionPage
            title="Deal Comparison"
            category="Portfolio"
            plannedPhase="Portfolio Comparison Engine"
            description="Side-by-side comparative evaluation of multiple pipeline M&A opportunities across valuation multiples, capital requirements, and EPS accretion profiles."
          />
        ),
      },

      /* Output Navigation Group */
      {
        path: '/ic-report',
        element: (
          <UnderConstructionPage
            title="IC Report"
            category="Output"
            plannedPhase="Phase 9 IC Report Synthesis"
            description="Investment Committee synthesis memorandum compiling transaction rationale, valuation triangulation, financing breakdown, and risk disclosures."
          />
        ),
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
