import React from 'react';

/**
 * Ícone de drone (quadricóptero), compatível com LucideIcon (forwardRef).
 */
export const IconDrone = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  (props, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 10v4" />
      <path d="M10 12h4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M12 6v2" />
      <path d="M12 16v2" />
      <path d="M6 12h2" />
      <path d="M16 12h2" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
    </svg>
  )
);

IconDrone.displayName = 'IconDrone';

export default IconDrone;
