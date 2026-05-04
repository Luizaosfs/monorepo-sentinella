import React from 'react';

/** Cadeira de rodas (símbolo simplificado), mobilidade reduzida. */
export const IconCadeiraRodas = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="13.5" cy="5.5" r="2.2" />
      <circle cx="16" cy="17" r="4.5" />
      <circle cx="7" cy="19" r="1.8" />
      <path d="M13.5 7.7v4.8l2.5 1.5" />
      <path d="M16 12.5l-4 3.5" />
      <path d="M11 15l-2 4" />
    </svg>
  )
);

IconCadeiraRodas.displayName = 'IconCadeiraRodas';
