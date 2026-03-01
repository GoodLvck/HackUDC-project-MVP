import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Category, Message } from "@/types/brain";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";

interface MindmapViewProps {
  categories: Category[];
  messages: Message[];
}

interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
  messages: Message[];
}

interface CategoryLayoutNode {
  x: number;
  y: number;
  node: CategoryTreeNode;
  branchColorIndex: number;
  children: CategoryLayoutNode[];
}

interface MessageLayoutNode {
  id: string;
  x: number;
  y: number;
  message: Message;
  parentCategoryId: number;
  branchColorIndex: number;
}

const BRANCH_COLORS = [
  "var(--branch-1)",
  "var(--branch-2)",
  "var(--branch-3)",
  "var(--branch-4)",
  "var(--branch-5)",
  "var(--branch-6)",
  "var(--branch-7)",
  "var(--branch-8)",
];

function buildCategoryForest(categories: Category[], messages: Message[]): CategoryTreeNode[] {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const childrenMap = new Map<number | null, Category[]>();
  const messagesByCategory = new Map<number, Message[]>();

  for (const message of messages) {
    if (message.category_id === null) continue;
    const list = messagesByCategory.get(message.category_id) ?? [];
    list.push(message);
    messagesByCategory.set(message.category_id, list);
  }

  for (const category of categories) {
    const key = category.parent_id;
    const list = childrenMap.get(key) ?? [];
    list.push(category);
    childrenMap.set(key, list);
  }

  const visited = new Set<number>();

  const buildNode = (category: Category): CategoryTreeNode => {
    visited.add(category.id);

    const directChildren = (childrenMap.get(category.id) ?? []).filter((child) => !visited.has(child.id));

    return {
      category,
      children: directChildren.map(buildNode),
      messages: messagesByCategory.get(category.id) ?? [],
    };
  };

  const roots = categories.filter((category) => category.parent_id === null || !categoriesById.has(category.parent_id));
  const forest = roots.map(buildNode);

  for (const category of categories) {
    if (visited.has(category.id)) continue;
    forest.push(buildNode(category));
  }

  return forest;
}

function layoutCategoryTree(
  tree: CategoryTreeNode[],
  cx: number,
  cy: number,
  startAngle: number,
  endAngle: number,
  radius: number,
  branchColorIndex: number,
  depth: number
): CategoryLayoutNode[] {
  if (tree.length === 0) return [];

  const angleStep = (endAngle - startAngle) / tree.length;

  return tree.map((node, index) => {
    const angle = startAngle + angleStep * (index + 0.5);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const colorIndex = depth === 0 ? index % BRANCH_COLORS.length : branchColorIndex;

    const childSpread = Math.min(angleStep * 0.8, Math.PI * 0.55);
    const children = layoutCategoryTree(
      node.children,
      x,
      y,
      angle - childSpread / 2,
      angle + childSpread / 2,
      Math.max(120, radius * 0.7),
      colorIndex,
      depth + 1
    );

    return { x, y, node, branchColorIndex: colorIndex, children };
  });
}

function flattenCategories(nodes: CategoryLayoutNode[]): CategoryLayoutNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children)]);
}

function collectMessageNodes(categories: CategoryLayoutNode[]): MessageLayoutNode[] {
  return categories.flatMap((categoryNode) => {
    const ownMessages = categoryNode.node.messages;
    const total = ownMessages.length;

    const messageNodes = ownMessages.map((message, index) => {
      const angle = total === 1 ? 0 : (Math.PI * 2 * index) / total;
      const orbitRadius = Math.max(65, 50 + Math.min(total * 5, 35));

      return {
        id: `message-${message.id}`,
        x: categoryNode.x + Math.cos(angle) * orbitRadius,
        y: categoryNode.y + Math.sin(angle) * orbitRadius,
        message,
        parentCategoryId: categoryNode.node.category.id,
        branchColorIndex: categoryNode.branchColorIndex,
      };
    });

    return [...messageNodes, ...collectMessageNodes(categoryNode.children)];
  });
}

function renderCategoryEdges(nodes: CategoryLayoutNode[]): JSX.Element[] {
  return nodes.flatMap((node) => {
    const ownEdges = node.children.map((child) => {
      const color = `hsl(${BRANCH_COLORS[child.branchColorIndex]})`;
      const mx = (node.x + child.x) / 2;
      const my = (node.y + child.y) / 2;
      const dx = child.x - node.x;
      const dy = child.y - node.y;
      const cx = mx - dy * 0.12;
      const cy = my + dx * 0.12;

      return (
        <path
          key={`edge-category-${node.node.category.id}-${child.node.category.id}`}
          d={`M ${node.x} ${node.y} Q ${cx} ${cy} ${child.x} ${child.y}`}
          stroke={color}
          strokeWidth={2}
          strokeOpacity={0.5}
          fill="none"
          className="transition-all duration-500"
        />
      );
    });

    return [...ownEdges, ...renderCategoryEdges(node.children)];
  });
}

const MindmapView = ({ categories, messages }: MindmapViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedCategory, setSelectedCategory] = useState<CategoryTreeNode | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const forest = useMemo(() => buildCategoryForest(categories, messages), [categories, messages]);
  const categoryLayout = useMemo(
    () => layoutCategoryTree(forest, 0, 0, 0, Math.PI * 2, 260, 0, 0),
    [forest]
  );
  const allCategories = useMemo(() => flattenCategories(categoryLayout), [categoryLayout]);
  const allMessages = useMemo(() => collectMessageNodes(categoryLayout), [categoryLayout]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    },
    [dragging, dragStart]
  );

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom((current) => Math.max(0.2, Math.min(3, current - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  if (categories.length === 0) {
    return <div className="p-8 text-muted-foreground">No hay categorias en el backend todavia</div>;
  }

  return (
    <div className="relative h-full w-full overflow-hidden" ref={containerRef}>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setZoom((current) => Math.min(3, current + 0.2))}
          className="p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
        >
          <ZoomIn className="w-4 h-4 text-foreground" />
        </button>
        <button
          onClick={() => setZoom((current) => Math.max(0.2, current - 0.2))}
          className="p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
        >
          <ZoomOut className="w-4 h-4 text-foreground" />
        </button>
        <button
          onClick={resetView}
          className="p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
        >
          <Maximize className="w-4 h-4 text-foreground" />
        </button>
      </div>

      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g
          transform={`translate(${pan.x + (containerRef.current?.clientWidth ?? 800) / 2}, ${pan.y + (containerRef.current?.clientHeight ?? 600) / 2}) scale(${zoom})`}
          style={{ transition: dragging ? "none" : "transform 0.3s ease-out" }}
        >
          {renderCategoryEdges(categoryLayout)}

          {allMessages.map((messageNode) => {
            const parent = allCategories.find((categoryNode) => categoryNode.node.category.id === messageNode.parentCategoryId);
            if (!parent) return null;

            const color = `hsl(${BRANCH_COLORS[messageNode.branchColorIndex]})`;
            const isHovered = hoveredNode === messageNode.id;
            const preview = messageNode.message.content.length > 22
              ? `${messageNode.message.content.slice(0, 19)}...`
              : messageNode.message.content;

            return (
              <g key={messageNode.id}>
                <line
                  x1={parent.x}
                  y1={parent.y}
                  x2={messageNode.x}
                  y2={messageNode.y}
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={0.35}
                />
                <g
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedMessage(messageNode.message);
                  }}
                  onMouseEnter={() => setHoveredNode(messageNode.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={messageNode.x}
                    cy={messageNode.y}
                    r={isHovered ? 20 : 17}
                    fill="hsl(var(--card))"
                    stroke={color}
                    strokeWidth={2}
                    filter={isHovered ? "url(#glow)" : undefined}
                    style={{ transition: "r 0.2s ease" }}
                  />
                  <text
                    x={messageNode.x}
                    y={messageNode.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="hsl(var(--foreground))"
                    fontSize={8}
                    fontFamily="JetBrains Mono"
                  >
                    {preview}
                  </text>
                </g>
              </g>
            );
          })}

          {allCategories.map((categoryNode) => {
            const color = `hsl(${BRANCH_COLORS[categoryNode.branchColorIndex]})`;
            const isLeaf = categoryNode.children.length === 0;
            const nodeId = `category-${categoryNode.node.category.id}`;
            const isHovered = hoveredNode === nodeId;
            const baseRadius = isLeaf ? 28 : 34;

            return (
              <g
                key={categoryNode.node.category.id}
                onClick={() => {
                  setSelectedMessage(null);
                  setSelectedCategory(categoryNode.node);
                }}
                onMouseEnter={() => setHoveredNode(nodeId)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={categoryNode.x}
                  cy={categoryNode.y}
                  r={isHovered ? baseRadius + 4 : baseRadius}
                  fill={color}
                  opacity={isHovered ? 1 : 0.86}
                  filter={isHovered ? "url(#glow)" : undefined}
                  style={{ transition: "r 0.2s ease, opacity 0.2s ease" }}
                />
                <text
                  x={categoryNode.x}
                  y={categoryNode.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="hsl(var(--background))"
                  fontSize={isLeaf ? 9 : 10}
                  fontFamily="JetBrains Mono"
                  fontWeight={600}
                >
                  {categoryNode.node.category.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {selectedCategory && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md glass rounded-xl p-4 animate-fade-in z-10">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-mono font-semibold text-foreground">{selectedCategory.category.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedCategory.category.description || "Sin descripcion"}</p>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          {selectedCategory.messages.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedCategory.messages.map((message) => (
                <div key={message.id} className="text-xs bg-muted/50 rounded-lg px-3 py-2 text-foreground">
                  {message.content}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {selectedCategory.children.length} subcategorias y 0 mensajes directos
            </p>
          )}
        </div>
      )}

      {selectedMessage && (
        <div className="absolute bottom-4 left-4 right-4 max-w-md glass rounded-xl p-4 animate-fade-in z-10">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-mono font-semibold text-foreground">Elemento #{selectedMessage.id}</h3>
              <p className="text-xs text-muted-foreground">{selectedMessage.type} · {new Date(selectedMessage.created_at).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedMessage(null)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-foreground whitespace-pre-wrap">{selectedMessage.content}</p>
        </div>
      )}
    </div>
  );
};

export default MindmapView;
