import React from 'react';
import { Link } from 'react-router-dom';

export const HeroSection: React.FC = () => {
  return (
    <section className="hero" aria-label="Hero Overview">
      <h1 className="h1">
        <span className="ln">
          <span className="in" style={{ animationDelay: '0.1s' }}>
            Evaluate targets.
          </span>
        </span>
        <span className="ln">
          <span className="in" style={{ animationDelay: '0.22s' }}>
            Model deals.
          </span>
        </span>
        <span className="ln">
          <span className="in" style={{ animationDelay: '0.34s' }}>
            Decide with evidence.
          </span>
        </span>
      </h1>

      <p className="sub">
        Screen acquisition targets, benchmark their valuation, and see what a deal does to your EPS, all on sourced Indian financials.
      </p>

      <div className="cta">
        <Link to="/research/screening" className="btn p" aria-label="Start screening acquisition targets">
          Start screening
        </Link>
        <Link to="/methodology" className="btn g" aria-label="Read DealForge financial methodology">
          Read the methodology
        </Link>
      </div>
    </section>
  );
};
