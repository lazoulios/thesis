// src/GraphBuilder.jsx
import React, { useCallback, useState } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css'; 

const initialNodes = [];
const initialEdges = [];

export default function GraphBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeId, setNodeId] = useState(1);

  const addNode = () => {
    const newNode = {
      id: `${nodeId}`,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: `Node ${nodeId}` },
      style: { background: '#fff', border: '1px solid #777', borderRadius: '50%', width: 60, height: 60, display: 'flex', justifyContent: 'center', alignItems: 'center' },
    };
    setNodes((nds) => nds.concat(newNode));
    setNodeId((id) => id + 1);
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const printGraphData = () => {
    console.log("Nodes:", nodes);
    console.log("Edges:", edges);
    alert(`Graph has ${nodes.length} nodes and ${edges.length} edges.`);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', background: '#f0f0f0', borderBottom: '1px solid #ccc', display: 'flex', gap: '10px' }}>
        <button onClick={addNode} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}>
          + Add Node
        </button>
        <button onClick={printGraphData} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#008CBA', color: 'white', border: 'none', borderRadius: '5px' }}>
          Export JSON
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}