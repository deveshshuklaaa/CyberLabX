import React from 'react';
import { ExternalLink, Mail, MapPin, Phone, ShieldCheck, Heart } from 'lucide-react';
import { PortalNavigation } from './PortalNavigation';
import { BrandLockup } from './BrandLockup';

export const UniversityFooter: React.FC = () => {
  return (
    <footer className="mt-16 bg-footer text-footer-text border-t-4 border-brand">
      {/* ── Main Multi-Column Footer ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Column 1: Institutional Identity */}
          <div className="space-y-4">
            <BrandLockup size="md" variant="dark" clickable={false} />
            <p className="text-xs text-footer-text/80 leading-relaxed mt-2">
              Official virtual laboratory platform of Somaiya Vidyavihar University.
              Dedicated to providing undergraduate and postgraduate engineering students
              with hands-on, isolated, experiential learning environments in networking and cybersecurity.
            </p>
            <div className="flex items-center gap-2 text-xs text-footer-text/70 pt-1">
              <MapPin size={14} className="shrink-0 text-white/90" />
              <span>Vidyavihar (E), Mumbai - 400077, Maharashtra, India</span>
            </div>
          </div>

          {/* Column 2: Academic Practical Resources */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white border-b border-white/20 pb-2 mb-4">
              Portal Resources
            </h3>
            <nav aria-label="Footer navigation" className="footer-navigation flex flex-col items-start gap-1">
              <PortalNavigation />
            </nav>
            <p className="mt-4 text-xs flex items-center gap-2"><ShieldCheck size={14} aria-hidden="true" />Controlled learning environments</p>
          </div>

          {/* Column 3: University Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white border-b border-white/20 pb-2 mb-4">
              Useful Links
            </h3>
            <ul className="space-y-2.5 text-xs text-footer-text/85">
              <li>
                <a
                  href="https://www.somaiya.edu/en/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Somaiya Vidyavihar University</span>
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              </li>
              <li>
                <a
                  href="https://kjsieit.somaiya.edu/en/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>KJSIEIT Official Portal</span>
                  <ExternalLink size={12} className="opacity-70" />
                </a>
              </li>
              <li>
                <span className="text-footer-text/70">Department of Computer Engineering</span>
              </li>
              <li>
                <span className="text-footer-text/70">Academic Integrity &amp; Safe Lab Policy</span>
              </li>
              <li>
                <span className="text-footer-text/70">Virtual Lab Support &amp; Assistance</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Academic Guidance & Development Attribution */}
          <div className="bg-footer-dark/60 p-5 rounded-lg border border-white/10 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white border-b border-white/20 pb-2">
              Project Attribution
            </h3>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/60 font-medium">Guided By</p>
              <p className="text-sm font-semibold text-white mt-0.5">Prof. Harsh Bhor</p>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-white/60 font-medium">Developed By</p>
              <p className="text-sm font-semibold text-white mt-0.5">Devesh Shukla</p>
              <p className="text-sm font-semibold text-white">Arvind Shekhawat</p>
            </div>

            <div className="pt-2 border-t border-white/10 text-[11px] text-footer-text/70">
              Department of Computer Engineering
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub-Footer / Copyright Bar ── */}
      <div className="bg-footer-dark border-t border-white/10 py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-footer-text/70">
          <p>© 2026 Somaiya Vidyavihar University. All rights reserved. Somaiya Virtual Labs.</p>
          <p className="text-[11px]">
            Academic Laboratory Platform · V1 Production Release
          </p>
        </div>
      </div>
    </footer>
  );
};
