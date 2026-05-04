import React from 'react';

/** Carrinho de bebê (lateral), alinhado ao estilo outline dos demais ícones de vulnerabilidade. */
export const IconMenorStroller = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
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
      <circle cx="7" cy="18.5" r="2.3" />
      <circle cx="17" cy="18.5" r="2.3" />
      <path d="M7 18.5h10" />
      <path d="M8 18.5L10 10h6l2 8.5" />
      <path d="M10 10c0-4 3.5-7 8-7" />
      <path d="M18 3l2-1.5" />
      <path d="M11 14h5" />
    </svg>
  )
);

IconMenorStroller.displayName = 'IconMenorStroller';
