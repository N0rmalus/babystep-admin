'use client';

import type { AriaAttributes } from 'react';
import { forwardRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Pilcrow, Quote, Redo2, Undo2 } from 'lucide-react';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';
import useMounted from '@/hooks/use-mounted';
import { cn } from '@/lib/utils';
import { normalizeRichTextContent } from '@/lib/rich-text';

type TiptapEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
};

type ToolbarButtonProps = {
  editor: Editor | null;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  isActive?: boolean;
  onClick: () => void;
};

const ToolbarButton = ({ editor, icon: Icon, label, disabled, isActive, onClick }: ToolbarButtonProps) => (
  <Button
    type="button"
    variant={isActive ? 'secondary' : 'ghost'}
    size="sm"
    disabled={disabled || !editor}
    className="h-8 px-2.5"
    onClick={onClick}
    aria-label={label}
    aria-pressed={isActive}
    title={label}
  >
    <Icon className="h-4 w-4" />
  </Button>
);

const TiptapEditorContent = forwardRef<HTMLDivElement, TiptapEditorProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder = 'Pradėkite rašyti...',
      disabled = false,
      className,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
    },
    ref,
  ) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [2, 3],
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: normalizeRichTextContent(value),
      editable: !disabled,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          id: id ?? '',
          'aria-describedby': ariaDescribedBy ?? '',
          'aria-invalid': ariaInvalid ? 'true' : 'false',
          class: 'tiptap min-h-[240px] w-full px-4 py-3 text-sm leading-6 text-foreground focus:outline-hidden',
        },
      },
      onUpdate: ({ editor: currentEditor }) => {
        onChange(currentEditor.isEmpty ? '' : currentEditor.getHTML());
      },
      onBlur: () => {
        onBlur?.();
      },
    });

    useEffect(() => {
      if (!editor) {
        return;
      }

      editor.setEditable(!disabled);
      editor.setOptions({
        editorProps: {
          attributes: {
            id: id ?? '',
            'aria-describedby': ariaDescribedBy ?? '',
            'aria-invalid': ariaInvalid ? 'true' : 'false',
            class: 'tiptap min-h-[240px] w-full px-4 py-3 text-sm leading-6 text-foreground focus:outline-hidden',
          },
        },
      });
    }, [ariaDescribedBy, ariaInvalid, disabled, editor, id]);

    useEffect(() => {
      if (!editor) {
        return;
      }

      const normalizedValue = normalizeRichTextContent(value);
      const currentValue = editor.isEmpty ? '' : editor.getHTML();

      if (currentValue === normalizedValue) {
        return;
      }

      editor.commands.setContent(normalizedValue, { emitUpdate: false });
    }, [editor, value]);

    return (
      <div
        ref={ref}
        className={cn(
          'overflow-hidden rounded-md border border-input bg-background shadow-xs transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-70',
          className,
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-2">
          <ToolbarButton
            editor={editor}
            icon={Pilcrow}
            label="Pastraipa"
            disabled={disabled}
            isActive={editor?.isActive('paragraph')}
            onClick={() => editor?.chain().focus().setParagraph().run()}
          />
          <ToolbarButton
            editor={editor}
            icon={Heading2}
            label="Antraštė 2"
            disabled={disabled}
            isActive={editor?.isActive('heading', { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            editor={editor}
            icon={Heading3}
            label="Antraštė 3"
            disabled={disabled}
            isActive={editor?.isActive('heading', { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            icon={Bold}
            label="Paryškinti"
            disabled={disabled}
            isActive={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            editor={editor}
            icon={Italic}
            label="Kursyvas"
            disabled={disabled}
            isActive={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            icon={List}
            label="Žymėtas sąrašas"
            disabled={disabled}
            isActive={editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            editor={editor}
            icon={ListOrdered}
            label="Numeruotas sąrašas"
            disabled={disabled}
            isActive={editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            editor={editor}
            icon={Quote}
            label="Citata"
            disabled={disabled}
            isActive={editor?.isActive('blockquote')}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            editor={editor}
            icon={Undo2}
            label="Atšaukti"
            disabled={disabled || !editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          />
          <ToolbarButton
            editor={editor}
            icon={Redo2}
            label="Grąžinti"
            disabled={disabled || !editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          />
        </div>

        <EditorContent editor={editor} />
      </div>
    );
  },
);
TiptapEditorContent.displayName = 'TiptapEditorContent';

export const TiptapEditor = forwardRef<HTMLDivElement, TiptapEditorProps>(
  ({ disabled = false, className, ...props }, ref) => {
    const mounted = useMounted();

    if (!mounted) {
      return (
        <div
          ref={ref}
          className={cn(
            'overflow-hidden rounded-md border border-input bg-background shadow-xs transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            disabled && 'cursor-not-allowed opacity-70',
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-2">
            <div className="h-8 w-full rounded bg-muted sm:w-56" />
          </div>
          <div className="min-h-[240px] px-4 py-3 text-sm text-muted-foreground">Kraunamas redaktorius...</div>
        </div>
      );
    }

    return <TiptapEditorContent ref={ref} disabled={disabled} className={className} {...props} />;
  },
);
TiptapEditor.displayName = 'TiptapEditor';
