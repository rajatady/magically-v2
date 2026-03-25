import { z } from 'zod';

// ─── Widget Sizes ─────────────────────────────────────────────────────────────

export const WidgetSizeSchema = z.enum(['small', 'medium', 'large', 'tall', 'wide', 'hero']);
export type WidgetSize = z.infer<typeof WidgetSizeSchema>;

// Grid span mapping (col-span x row-span)
export const WIDGET_GRID_SPANS: Record<WidgetSize, { cols: number; rows: number }> = {
  small: { cols: 1, rows: 1 },
  medium: { cols: 2, rows: 1 },
  tall: { cols: 1, rows: 2 },
  large: { cols: 2, rows: 2 },
  wide: { cols: 3, rows: 1 },
  hero: { cols: 4, rows: 2 },
};

// ─── Widget Node Types ────────────────────────────────────────────────────────

const baseNode = z.object({
  id: z.string().optional(),
  visible: z.string().optional(),  // template expression e.g. "{{data.count > 0}}"
  style: z.string().optional(),    // predefined style token
});

export const TextNodeSchema = baseNode.extend({
  type: z.literal('text'),
  value: z.string(),               // supports {{template}} syntax
  style: z.enum(['title', 'subtitle', 'body', 'body-bold', 'caption', 'mono', 'display']).optional(),
  truncate: z.boolean().optional(),
});

export const BadgeNodeSchema = baseNode.extend({
  type: z.literal('badge'),
  text: z.string(),
  color: z.string().optional(),    // hex, css var, or 'blue' | 'green' | 'red' | 'orange'
});

export const IconNodeSchema = baseNode.extend({
  type: z.literal('icon'),
  value: z.string(),               // emoji or icon name
  size: z.enum(['sm', 'md', 'lg']).optional(),
});

export const ColorBarSchema = baseNode.extend({
  type: z.literal('color-bar'),
  color: z.string(),
  width: z.number().optional(),
});

export const SparklineNodeSchema = baseNode.extend({
  type: z.literal('sparkline'),
  data: z.string(),                // template: "{{data.values}}"
  color: z.string().optional(),
  height: z.number().optional(),
});

export const RingNodeSchema = baseNode.extend({
  type: z.literal('ring'),
  value: z.string(),               // template: 0..100
  color: z.string().optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
});

export const DividerNodeSchema = baseNode.extend({
  type: z.literal('divider'),
});

// Recursive types — rows, stacks, lists, grids
type WidgetNode =
  | z.infer<typeof TextNodeSchema>
  | z.infer<typeof BadgeNodeSchema>
  | z.infer<typeof IconNodeSchema>
  | z.infer<typeof ColorBarSchema>
  | z.infer<typeof SparklineNodeSchema>
  | z.infer<typeof RingNodeSchema>
  | z.infer<typeof DividerNodeSchema>
  | RowNode
  | StackNode
  | ListNode;

interface RowNode extends z.infer<typeof baseNode> {
  type: 'row';
  children: WidgetNode[];
  gap?: number;
  align?: 'start' | 'center' | 'end';
}

interface StackNode extends z.infer<typeof baseNode> {
  type: 'stack';
  children: WidgetNode[];
  gap?: number;
  direction?: 'vertical' | 'horizontal';
}

interface ListNode extends z.infer<typeof baseNode> {
  type: 'list';
  items: string;            // template: "{{data.events}}"
  template: WidgetNode;     // rendered for each item (item available as {{item}})
  maxItems?: number;
}

export type { WidgetNode, RowNode, StackNode, ListNode };

// ─── Widget Spec ──────────────────────────────────────────────────────────────

export const WidgetDataSourceSchema = z.object({
  source: z.enum(['agent', 'static']),
  endpoint: z.string().optional(),  // for source: 'agent'
  data: z.record(z.unknown()).optional(), // for source: 'static'
});

export const WidgetSpecSchema = z.object({
  size: WidgetSizeSchema,
  refresh: z.string().optional(),   // e.g. '1m', '5m', '1h'
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
  data: WidgetDataSourceSchema.optional(),
  layout: z.object({
    type: z.enum(['stack', 'grid', 'list', 'custom']),
    children: z.array(z.record(z.unknown())),
  }),
});

export type WidgetSpec = z.infer<typeof WidgetSpecSchema>;
export type WidgetDataSource = z.infer<typeof WidgetDataSourceSchema>;
