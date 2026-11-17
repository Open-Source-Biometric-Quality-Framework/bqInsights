import MarkdownIt from 'markdown-it';

export function stepMdToHtml(input: string): string {
  const md = new MarkdownIt({html: true});
  return '<div class="noteview">'+md.render(input)+'</div>'
}
