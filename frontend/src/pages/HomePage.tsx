import React from 'react';
import { PublicTicker } from '@/components/public/PublicTicker';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { HeroSection } from '@/components/public/HeroSection';
import { StatsStrip } from '@/components/public/StatsStrip';
import heroBg from '@/assets/hero-bg.jpg';
import '@/styles/home.css';

export const HomePage: React.FC = () => {
  return (
    <div
      className="dealforge-home-page page"
      data-canvas-width="1440"
      data-canvas-height="820"
      data-document-role="page"
      data-label="Home"
    >
      {/* 1. Market Ticker - 36px, full width, top of vertical hierarchy */}
      <PublicTicker />

      {/* 2. Main Hero Viewport - min-height calc(100vh - 36px) */}
      <main className="home-main" id="main-content">
        {/* Drift Photographic Background Layer */}
        <div
          className="bg"
          style={{ backgroundImage: `url(${heroBg})` }}
          aria-hidden="true"
        />

        {/* Two-Part Gradients Scrim (Maintains left text legibility & bottom clarity) */}
        <div className="scrim" aria-hidden="true" />

        {/* Content Stack: Navigation and Hero */}
        <div className="home-content stack">
          {/* Public Navigation */}
          <PublicNavbar />

          {/* Hero Headline, Subtitle, and Call-to-Action CTAs */}
          <HeroSection />
        </div>
      </main>

      {/* 3. Bottom Platform Coverage Statistics Strip - normal document flow */}
      <StatsStrip />
    </div>
  );
};
