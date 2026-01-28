import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import api from '../api/client';

interface GraphData {
  nodes: Array<{
    id: string;
    title: string;
    source_domain: string;
    tags: string[];
  }>;
  links: Array<{
    source: string;
    target: string;
    relation_type: string;
    strength: number;
  }>;
}

const relationColors: Record<string, string> = {
  SAME_TOPIC: '#6366f1',
  SAME_AUTHOR: '#22c55e',
  SAME_DOMAIN: '#eab308',
  SAME_ENTITY: '#ec4899',
  SIMILAR: '#06b6d4',
};

export default function Graph() {
  const navigate = useNavigate();
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['graph', selectedNode],
    queryFn: () =>
      selectedNode
        ? api.getArticleGraph(selectedNode, 30)
        : api.getGraph(100),
  });

  // Transform data for force-graph
  const graphData: GraphData | null = data
    ? {
        nodes: data.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          source_domain: n.source_domain,
          tags: n.tags,
        })),
        links: data.edges.map((e) => ({
          source: e.source,
          target: e.target,
          relation_type: e.relation_type,
          strength: e.strength,
        })),
      }
    : null;

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = (node: any) => {
    if (selectedNode === node.id) {
      // Navigate to article detail
      navigate(`/article/${node.id}`);
    } else {
      // Focus on this node
      setSelectedNode(node.id);
    }
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 400);
    }
  };

  const handleReset = () => {
    setSelectedNode(null);
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Knowledge Graph</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleZoomIn} className="btn btn-secondary p-2">
            <ZoomIn size={18} />
          </button>
          <button onClick={handleZoomOut} className="btn btn-secondary p-2">
            <ZoomOut size={18} />
          </button>
          <button onClick={handleReset} className="btn btn-secondary p-2">
            <Maximize2 size={18} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(relationColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-dark-400">{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="card overflow-hidden"
        style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-400">
            Failed to load graph
          </div>
        ) : graphData && graphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel={(node: any) => node.title}
            nodeColor={(node: any) =>
              node.id === selectedNode ? '#6366f1' : '#64748b'
            }
            nodeRelSize={6}
            linkColor={(link: any) =>
              relationColors[link.relation_type] || '#334155'
            }
            linkWidth={(link: any) => link.strength * 3}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={(link: any) => link.strength * 0.01}
            onNodeClick={handleNodeClick}
            cooldownTicks={100}
            onEngineStop={() => graphRef.current?.zoomToFit(400)}
            backgroundColor="#0f172a"
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.title.slice(0, 20) + (node.title.length > 20 ? '...' : '');
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(
                (n) => n + fontSize * 0.2
              );

              // Node circle
              ctx.beginPath();
              ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
              ctx.fillStyle = node.id === selectedNode ? '#6366f1' : '#64748b';
              ctx.fill();

              // Label background
              ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
              ctx.fillRect(
                node.x - bckgDimensions[0] / 2,
                node.y + 8,
                bckgDimensions[0],
                bckgDimensions[1]
              );

              // Label text
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(label, node.x, node.y + 8 + fontSize / 2);
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-dark-500">
            No connections to display. Save more articles to build your knowledge graph.
          </div>
        )}
      </div>

      {selectedNode && (
        <p className="text-sm text-dark-400">
          Click on a node again to view article details. Click "Reset" to see the full graph.
        </p>
      )}
    </div>
  );
}
