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
import './GraphBuilder.css';

const initialNodes = [];
const initialEdges = [];

export default function GraphBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeId, setNodeId] = useState(1);

  const isSelectionActive = nodes.some((node) => node.selected) || edges.some((edge) => edge.selected);

  const addNode = () => {
    const newNode = {
      id: `${nodeId}`,
      position: { 
        x: Math.random() * 300 + 100, 
        y: Math.random() * 300 + 100 
      },
      data: { label: `Node ${nodeId}` },
      className: 'thesis-node', 
    };
    setNodes((nds) => nds.concat(newNode));
    setNodeId((id) => id + 1);
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: '#555', strokeWidth: 2 } 
    }, eds)),
    [setEdges],
  );

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  };

  const printGraphData = () => {
    console.log("Nodes:", nodes);
    console.log("Edges:", edges);
    alert(`Exported JSON to console! (${nodes.length} nodes, ${edges.length} edges)`);
  };

  return (
    <div className="graph-container">
      
      <div className="control-panel">
        <h3 className="panel-title">Graph Tools</h3>
        
        <button className="btn btn-add" onClick={addNode}>
          <span>+</span> Add Node
        </button>
        
        <button 
          className="btn btn-delete" 
          onClick={deleteSelected}
          disabled={!isSelectionActive} 
        >
          <span>🗑️</span> Delete Selected
        </button>

        <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '5px 0'}}/>

        <button className="btn btn-export" onClick={printGraphData}>
          <span>⬇</span> Export JSON
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        defaultViewport={{ x: 0, y: 0, zoom: 1.5}} 
        minZoom={0.5} 
        maxZoom={2}   
        deleteKeyCode={['Backspace', 'Delete']} 
      >
        <Background color="#aaa" gap={20} size={1.25} />
        <Controls />
        <MiniMap style={{height: 100, border: '1px solid #ddd'}} />
      </ReactFlow>
    </div>
  );
}