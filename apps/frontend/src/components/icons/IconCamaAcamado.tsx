import React from 'react';

/** Cama / leito (vista lateral), para acamados. */
export const IconCamaAcamado = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
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
      <rect x="2.5" y="12" width="4" height="7" rx="0.5" fill="none" />
      <path d="M6.5 15.5H21" />
      <path d="M6.5 15.5V13l2.5-2.5H21" />
      <path d="M9 10.5V16" />
      <path d="M19 10.5V16" />
      <path d="M2.5 20.5h19" />
    </svg>
  )
);

IconCamaAcamado.displayName = 'IconCamaAcamado';
