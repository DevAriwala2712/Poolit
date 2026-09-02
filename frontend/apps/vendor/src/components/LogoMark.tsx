export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 220" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="34" height="204" fill="#00FF66" />
      <path
        d="M34,0 L142,0 C198,0 240,44 240,102 C240,160 198,204 142,204 L34,204 Z"
        fill="#00FF66"
      />
      <path
        d="M34,34 L138,34 C176,34 206,64 206,102 C206,140 176,170 138,170 L106,170 L146,102 L86,102 L34,170 Z"
        fill="#000"
      />
      <rect x="214" y="0" width="16" height="16" fill="#fff" />
    </svg>
  );
}
