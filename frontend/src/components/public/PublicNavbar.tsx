import React from 'react';
import { Link } from 'react-router-dom';

export const PublicNavbar: React.FC = () => {
  return (
    <nav className="nav" aria-label="Public Navigation">
      <Link to="/" className="mark" aria-label="DealForge Home">
        DEALFORGE
      </Link>

      <div className="navlinks">
        <Link to="/research/screening" className="l">
          Screening
        </Link>
        <Link to="/research/valuation" className="l">
          Valuation
        </Link>
        <Link to="/deal-builder" className="l">
          Deal builder
        </Link>
        <Link to="/methodology" className="l">
          Methodology
        </Link>
        <Link to="/sign-in" className="btn g s" aria-label="Sign in to DealForge">
          Sign in
        </Link>
      </div>
    </nav>
  );
};
