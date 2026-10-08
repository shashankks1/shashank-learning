import markSvg from '../../assets/mark.svg?raw';

// The personal mark, recoloured with currentColor so it follows the theme.
const themed = markSvg
  .replace(/fill="#2C57CA"/gi, 'fill="currentColor"')
  .replace('<svg ', '<svg aria-hidden="true" focusable="false" ');

export function Mark({ className }: { className?: string }) {
  return <span className={`mark ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: themed }} />;
}
