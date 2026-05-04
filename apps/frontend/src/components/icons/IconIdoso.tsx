import React from 'react';

/**
 * Ícone de idoso com bengala (outline), compatível com LucideIcon (forwardRef).
 */
export const IconIdoso = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
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
      {/* Cabeça */}
      <circle cx="14" cy="4" r="2.3" />
      {/* Coluna / tronco — curvado para frente */}
      <path d="M13 6.3 C11.5 9 10 11.5 9.5 14.5" />
      {/* Braço dianteiro segurando a bengala */}
      <path d="M11.5 9.5 L8 13.5" />
      {/* Bengala: da mão até o chão */}
      <path d="M8 13.5 L5.5 22" />
      {/* Braço traseiro */}
      <path d="M11.5 9.5 L13.5 12.5" />
      {/* Perna dianteira */}
      <path d="M9.5 14.5 L8 22" />
      {/* Perna traseira */}
      <path d="M9.5 14.5 L13 21" />
    </svg>
  )
);

IconIdoso.displayName = 'IconIdoso';

export default IconIdoso;
