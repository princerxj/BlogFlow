import ReactMarkdown from 'react-markdown';
import { cx } from './ui.jsx';

// react-markdown does not render raw HTML by default, so LLM output cannot inject markup/scripts.
const components = {
  a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export function Markdown({ children, className }) {
  return (
    <div
      className={cx(
        'prose max-w-none',
        'prose-headings:tracking-tight prose-h1:text-3xl prose-h1:leading-tight prose-h2:mt-9 prose-h2:text-2xl prose-h3:text-lg',
        'prose-p:leading-[1.75] prose-li:my-1 prose-a:underline-offset-2 prose-blockquote:font-normal prose-blockquote:not-italic',
        className,
      )}
    >
      <ReactMarkdown components={components}>{children || ''}</ReactMarkdown>
    </div>
  );
}
