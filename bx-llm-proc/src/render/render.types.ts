export type RenderNode =
 | ParagraphNode
  | ListNode
  | HeadingNode
  | HtmlNode
  | TableNode
  | TabNode;
  
export interface ParagraphNode {
  type: 'paragraph';
  text: string;
}

export interface ListNode {
  type: 'list';
  ordered?: boolean;
  items: string[];
}

export interface HeadingNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface HtmlNode {
  type: 'html';
  html: string;
}

export interface TableNode {
  type: 'table';
  rows: string[][];
}

export interface TabNode {
  type: 'tab';
  content: string;
}


export type RenderTree = RenderNode[];