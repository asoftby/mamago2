"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Input } from "@/components/ui/input";

function QuoteBlockNodeView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="div"
      className="border-l-4 border-muted-foreground/30 pl-4 py-1 my-1 space-y-2"
    >
      <NodeViewContent as="div" className="italic" />
      <div className="flex gap-2" contentEditable={false}>
        <Input
          placeholder="Автор (опционально)"
          value={(node.attrs.author as string) ?? ""}
          onChange={(e) => updateAttributes({ author: e.target.value })}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Роль / должность"
          value={(node.attrs.authorRole as string) ?? ""}
          onChange={(e) => updateAttributes({ authorRole: e.target.value })}
          className="h-8 text-sm"
        />
      </div>
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    quoteBlock: {
      toggleQuoteBlock: () => ReturnType;
    };
  }
}

export const QuoteBlock = Node.create({
  name: "quoteBlock",
  group: "block",
  content: "paragraph+",

  addAttributes() {
    return {
      author: { default: "" },
      authorRole: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="quote-block"]',
        getAttrs: (dom) => ({
          author: (dom as HTMLElement).getAttribute("data-author") ?? "",
          authorRole: (dom as HTMLElement).getAttribute("data-author-role") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "quote-block",
        ...(node.attrs.author ? { "data-author": node.attrs.author as string } : {}),
        ...(node.attrs.authorRole ? { "data-author-role": node.attrs.authorRole as string } : {}),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      toggleQuoteBlock:
        () =>
        ({ commands, editor }) => {
          if (editor.isActive("quoteBlock")) {
            return commands.lift("quoteBlock");
          }
          return commands.wrapIn("quoteBlock");
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuoteBlockNodeView);
  },
});
