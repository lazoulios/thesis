// src/GraphBuilder.jsx
import React, { useCallback, useState } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';

import 'reactflow/dist/style.css'; 
import './GraphBuilder.css';

const initialNodes = [];
const initialEdges = [];

export default function GraphBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [nodeId, setNodeId] = useState(1);

  const [rfInstance, setRfInstance] = useState(null);

  const [startNode, setStartNodeState] = useState(null); 
  const [targetNodes, setTargetNodesState] = useState(new Set()); 

  const selectedNode = nodes.find((n) => n.selected);
  const isNodeSelected = !!selectedNode;

  const addNode = () => {
    const newNode = {
      id: `${nodeId}`,
      position: { x: Math.random() * 300 + 100, y: Math.random() * 300 + 100 },
      data: { label: `Node ${nodeId}` },
      className: 'thesis-node', 
    };
    setNodes((nds) => nds.concat(newNode));
    setNodeId((id) => id + 1);
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ 
      ...params, animated: true, style: { stroke: '#555', strokeWidth: 2 } 
    }, eds)),
    [setEdges],
  );

  const deleteSelected = () => {
    setNodes((nds) => nds.filter((node) => {
      if (node.selected) {
        if (node.id === startNode) setStartNodeState(null);
        const newTargets = new Set(targetNodes);
        if (newTargets.has(node.id)) {
            newTargets.delete(node.id);
            setTargetNodesState(newTargets);
        }
        return false;
      }
      return true;
    }));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  };

  const setAsStart = () => {
    if (!selectedNode) return;
    
    setStartNodeState(selectedNode.id);

    setNodes((nds) => nds.map((node) => {
      let newClass = node.className.replace(' start-node', '').replace(' target-node', '');
      
      if (node.id === selectedNode.id) {
        newClass += ' start-node';
        // Αν ήταν target, το βγάζουμε από τα targets
        if (targetNodes.has(node.id)) {
            const newTargets = new Set(targetNodes);
            newTargets.delete(node.id);
            setTargetNodesState(newTargets);
        }
      } 
      // Αν είναι target (και όχι ο νέος start), ξαναβάζουμε το target-node
      else if (targetNodes.has(node.id)) {
        newClass += ' target-node';
      }

      return { ...node, className: newClass };
    }));
  };

  const toggleTarget = () => {
    if (!selectedNode) return;
    
    // Δεν μπορείς να κάνεις target τον start node
    if (selectedNode.id === startNode) {
        alert("This node is the Start node. It cannot be a Target.");
        return;
    }

    const newTargets = new Set(targetNodes);
    let isAdding = !newTargets.has(selectedNode.id); 

    if (isAdding) newTargets.add(selectedNode.id);
    else newTargets.delete(selectedNode.id);

    setTargetNodesState(newTargets);

    setNodes((nds) => nds.map((node) => {
      if (node.id === selectedNode.id) {
        let newClass = node.className.replace(' target-node', '');
        if (isAdding) newClass += ' target-node';
        return { ...node, className: newClass };
      }
      return node;
    }));
  };

  const generateRandomGraph = () => {
    if (!confirm("This will clear the current graph. Continue?")) return;

    const minNodes = 8;
    const maxNodes = 25;
    const nodeCount = Math.floor(Math.random() * (maxNodes - minNodes + 1)) + minNodes;

    const newNodes = [];
    const newEdges = [];
    
    // Grid layout calculation
    const columns = Math.ceil(Math.sqrt(nodeCount)); 
    const spacingX = 200; 
    const spacingY = 120; 

    for (let i = 0; i < nodeCount; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;

        newNodes.push({
            id: `${i + 1}`, 
            position: { 
              x: (col * spacingX) + 50 + (Math.random() * 20), 
              y: (row * spacingY) + 50 + (Math.random() * 20)
            },
            data: { label: `Node ${i + 1}` },
            className: 'thesis-node',
        });
    }

    for (let i = 1; i <= nodeCount; i++) {
        const numEdges = Math.random() > 0.4 ? 1 : 2; 
        // 60% chance for 1 edge, 40% for 2 edges

        for (let j = 0; j < numEdges; j++) {
            let possibleTarget = i + Math.floor(Math.random() * columns) + 1;
            
            // If out of bounds, random connection elsewhere for variety (Back edge)
            if (possibleTarget > nodeCount) {
                 possibleTarget = Math.floor(Math.random() * (nodeCount - 1)) + 1;
            }

            // Check not to connect to itself
            if (possibleTarget !== i) {
                const edgeId = `e${i}-${possibleTarget}-${j}`;
                // Check if this edge already exists (to avoid duplicates)
                const exists = newEdges.some(e => 
                    (e.source === `${i}` && e.target === `${possibleTarget}`) ||
                    (e.source === `${possibleTarget}` && e.target === `${i}`)
                );

                if (!exists) {
                    newEdges.push({
                        id: edgeId,
                        source: `${i}`,
                        target: `${possibleTarget}`,
                        animated: true,
                        style: { stroke: '#555', strokeWidth: 2 },
                    });
                }
            }
        }
    }

    
    const startNodeStr = "1"; 
    
    const randomTargets = new Set();
    const numTargets = Math.floor(Math.random() * 3) + 1; // 1 or 3 targets
    
    while (randomTargets.size < numTargets) {
        const minTargetId = Math.floor(nodeCount * 0.7); 
        const r = Math.floor(Math.random() * (nodeCount - minTargetId)) + minTargetId + 1;
        
        if (`${r}` !== startNodeStr) {
            randomTargets.add(`${r}`);
        }
    }

    const coloredNodes = newNodes.map(node => {
        let cls = 'thesis-node';
        if (node.id === startNodeStr) cls += ' start-node';
        if (randomTargets.has(node.id)) cls += ' target-node';
        return { ...node, className: cls };
    });

    // Update State
    setNodes(coloredNodes);
    setEdges(newEdges);
    setNodeId(nodeCount + 1); 
    setStartNodeState(startNodeStr);
    setTargetNodesState(randomTargets);

    // Auto Focus
    if (rfInstance) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.4, duration: 800 });
      }, 100);
    }
  };

  // Generating trap graph which outlines the advantage of our algorithm
  const generateTrapGraph = () => {
    if (!confirm("Generate Trap Graph? This demonstrates Dijkstra inefficiency.")) return;

    const newNodes = [];
    const newEdges = [];
    
    // the main path
    // Nodes 1 -> 2 -> 3 -> 4 (Target)
    // Αυτά θα τα βάλουμε πάνω ψηλά (y=50)
    // Θα έχουν μεγάλο βάρος σύνδεσης (π.χ. Cost=10)
    [1, 2, 3, 4].forEach((id, index) => {
        newNodes.push({
            id: `${id}`,
            position: { x: 100 + (index * 200), y: 50 },
            data: { label: id === 4 ? 'Target' : `Path ${id}` },
            className: id === 4 ? 'thesis-node target-node' : (id === 1 ? 'thesis-node start-node' : 'thesis-node'),
        });
        
        // Σύνδεση με τον προηγούμενο
        if (index > 0) {
            newEdges.push({
                id: `e${id-1}-${id}`,
                source: `${id-1}`,
                target: `${id}`,
                animated: true,
                label: 'Cost: 10',
                style: { stroke: '#555', strokeWidth: 2 },
            });
        }
    });

    // the trap part
    // Nodes 1 -> 5 -> 6 -> 7 -> 8
    // Αυτά θα τα βάλουμε κάτω (y=250)
    // Θα έχουν πολύ μικρό βάρος (π.χ. Cost=1), άρα ο Dijkstra θα έρθει εδώ ΠΡΩΤΑ
    [5, 6, 7, 8].forEach((id, index) => {
        newNodes.push({
            id: `${id}`,
            position: { x: 100 + (index * 200), y: 250 }, 
            data: { label: `Trap ${id}` },
            className: 'thesis-node',
        });
    });

    // Connection from Start (1) to the beginning of the trap (5)
    newEdges.push({
        id: `e1-5`, source: '1', target: '5', 
        animated: true, label: 'Cost: 1', 
        style: { stroke: '#ef4444', strokeWidth: 2 } 
    });

    // Συνδέσεις μέσα στην παγίδα (5->6->7->8)
    const trapNodes = [5, 6, 7, 8];
    for (let i = 0; i < trapNodes.length - 1; i++) {
        newEdges.push({
            id: `e${trapNodes[i]}-${trapNodes[i+1]}`,
            source: `${trapNodes[i]}`,
            target: `${trapNodes[i+1]}`,
            animated: true,
            label: 'Cost: 1',
            style: { stroke: '#ef4444', strokeWidth: 2 }
        });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    setNodeId(9);
    setStartNodeState("1");
    setTargetNodesState(new Set(["4"])); 

    // Auto Focus
    if (rfInstance) {
      setTimeout(() => rfInstance.fitView({ padding: 0.8, duration: 800 }), 100);
    }
  };

  // --- Export με ρόλους ---
  const printGraphData = () => {
    const graphData = {
        startNode: startNode,
        targetNodes: Array.from(targetNodes),
        nodes: nodes,
        edges: edges
    };
    console.log("Graph Data:", graphData);
    alert(`Exported!\nStart: ${startNode}\nTargets: ${targetNodes.size}\nCheck Console.`);
  };

  return (
    <div className="graph-container">
      <div className="control-panel">
        <h3 className="panel-title">Graph Tools</h3>
        
        <button className="btn btn-add" onClick={addNode}><span>+</span> Add Node</button>
        
        <button 
            className="btn btn-start" 
            onClick={setAsStart} 
            disabled={!isNodeSelected}
            title="Set selected node as Start (Source)"
        >
          <span>🚩</span> Set Start
        </button>
        
        <button 
            className="btn btn-target" 
            onClick={toggleTarget} 
            disabled={!isNodeSelected}
            title="Toggle selected node as Target"
        >
          <span>🎯</span> Toggle Target
        </button>

        <button 
            className="btn btn-delete" 
            onClick={deleteSelected}
            disabled={!nodes.some(n => n.selected) && !edges.some(e => e.selected)}
        >
          <span>🗑️</span> Delete Selected
        </button>

        <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '10px 0'}}/>

        <button className="btn btn-random" onClick={generateRandomGraph}>
          <span>🎲</span> Random Graph
        </button>

        <button className="btn btn-random" style={{marginTop: '5px', backgroundColor: '#e11d48'}} onClick={generateTrapGraph}>
          <span>🪤</span> Trap Scenario
        </button>

        <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '5px 0'}}/>

        <button className="btn btn-export" onClick={printGraphData}><span>⬇</span> Export JSON</button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.5}
        maxZoom={2} 
        deleteKeyCode={['Backspace', 'Delete']} 
      >
        <Background color="#aaa" gap={20} size={1} />
        <Controls />
        <MiniMap style={{height: 100, border: '1px solid #ddd'}} />
      </ReactFlow>
    </div>
  );
}