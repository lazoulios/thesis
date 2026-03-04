import React, { useCallback, useState, useEffect, useRef } from 'react';
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
  const fileInputRef = useRef(null);
  
  // sidebar states
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const [startNode, setStartNodeState] = useState(null); 
  const [targetNodes, setTargetNodesState] = useState(new Set()); 

  const selectedNode = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);
  const isNodeSelected = !!selectedNode;

  const [edgeWeight, setEdgeWeight] = useState('');

  const [selectedAlgorithm, setSelectedAlgorithm] = useState('classic'); // state for choice of algorithm 

  useEffect(() => {
    if (selectedEdge) {
      const labelStr = selectedEdge.label || 'Cost: 1';
      // Replaces "Cost: 9" with "9"
      const numericPart = labelStr.replace('Cost: ', ''); 
      setEdgeWeight(numericPart);
    } else {
      setEdgeWeight('');
    }
  }, [selectedEdge]);

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
      ...params, 
      animated: true, 
      label: 'Cost: 1', 
      style: { stroke: '#555', strokeWidth: 2 } 
    }, eds)),
    [setEdges],
  );

  const handleWeightChange = (e) => {
    const newVal = e.target.value;
    setEdgeWeight(newVal);
    
    if (selectedEdge) {
      setEdges((eds) => eds.map((edge) => {
        if (edge.id === selectedEdge.id) {
          // Add the prefix back before saving to the graph
          return { ...edge, label: `Cost: ${newVal}` };
        }
        return edge;
      }));
    }
  };

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

  const clearGraph = () => {
    if (nodes.length === 0) return; 
    if (!confirm("Are you sure you want to clear the entire graph?")) return;

    setNodes([]);
    setEdges([]);
    setNodeId(1);
    setStartNodeState(null);
    setTargetNodesState(new Set());
    setEdgeWeight('');
  };

  const downloadGraph = async () => {
    // 1. Ετοιμάζουμε τα δεδομένα
    const graphData = {
        nodes,
        edges,
        startNode,
        targetNodes: Array.from(targetNodes),
        nodeId
    };

    const jsonString = JSON.stringify(graphData, null, 2);

    try {
        // 2. Δοκιμάζουμε το μοντέρνο API που ανοίγει το παράθυρο "Save As"
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'thesis_graph.json',
                types: [{
                    description: 'JSON Graph File',
                    accept: { 'application/json': ['.json'] },
                }],
            });
            const writable = await handle.createWritable();
            await writable.write(jsonString);
            await writable.close();
        } else {
            // Fallback (για παλιούς browsers): Κατεβαίνει αυτόματα στα Downloads
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "thesis_graph.json";
            link.click();
            URL.revokeObjectURL(url);
        }
    } catch (err) {
        // Αν ο χρήστης πατήσει Cancel στο παράθυρο, το αγνοούμε
        if (err.name !== 'AbortError') {
            console.error("Save failed:", err);
            alert("Could not save file.");
        }
    }
  };

  const triggerLoad = () => {
    // Πατάμε προγραμματιστικά το κρυφό input file
    fileInputRef.current.click();
  };

  // --- NEW: HANDLE FILE UPLOAD ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        
        // Restore state
        setNodes(parsed.nodes || []);
        setEdges(parsed.edges || []);
        setStartNodeState(parsed.startNode || null);
        setTargetNodesState(new Set(parsed.targetNodes || [])); 
        setNodeId(parsed.nodeId || 1);
        
        // Reset view to fit graph
        if (rfInstance) {
            setTimeout(() => rfInstance.fitView({ padding: 0.2, duration: 800 }), 100);
        }
        alert("Graph loaded successfully!");
      } catch (err) {
        console.error("Error parsing JSON:", err);
        alert("Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    
    // Καθαρίζουμε το input για να μπορούμε να ξαναφορτώσουμε το ίδιο αρχείο αν χρειαστεί
    event.target.value = null; 
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
                  const weight = Math.floor(Math.random() * 10) + 1;

                  newEdges.push({
                      id: edgeId,
                      source: `${i}`,
                      target: `${possibleTarget}`,
                      animated: true,
                      label: `Cost: ${weight}`,
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
    [1, 2, 3, 4].forEach((id, index) => {
        newNodes.push({
            id: `${id}`,
            position: { x: 100 + (index * 200), y: 50 },
            data: { label: id === 4 ? 'Target' : `Path ${id}` },
            className: id === 4 ? 'thesis-node target-node' : (id === 1 ? 'thesis-node start-node' : 'thesis-node'),
        });
        
        // connect to the previous
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

    [5, 6, 7, 8].forEach((id, index) => {
        newNodes.push({
            id: `${id}`,
            position: { x: 100 + (index * 200), y: 250 }, 
            data: { label: `Trap ${id}` },
            className: 'thesis-node',
        });
    });

    // trap edge from 1 to 5
    newEdges.push({
        id: `e1-5`, source: '1', target: '5', 
        animated: true, label: 'Cost: 1', 
        style: { stroke: '#ef4444', strokeWidth: 2 } 
    });

    // trap edges from 5 to 8
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

  // export for backend
  const printGraphData = () => {
    const graphData = {
        startNode: startNode,
        targetNodes: Array.from(targetNodes),
        nodes: nodes,
        edges: edges.map(e => ({ 
            source: e.source, 
            target: e.target, 
            weight: e.label ? parseInt(e.label.replace('Cost: ', '')) : 1 
        }))
    };
    console.log("Graph Data:", graphData);
    alert(`Exported!\nStart: ${startNode}\nTargets: ${targetNodes.size}\nCheck Console.`);
  };
  
const animateDijkstra = (visitedSteps, pathsDict) => {
    setNodes((nds) => nds.map(n => ({ 
      ...n, className: n.className.replace(/ visited| path-node/g, '') 
    })));
    setEdges((eds) => eds.map(e => ({ 
      ...e, className: (e.className || '').replace(/ visited-edge| path-edge/g, '') 
    })));

    let delay = 0;
    const timePerStep = 1000;

    //color steps
    visitedSteps.forEach((step) => {
        setTimeout(() => {
            //color node
            setNodes((nds) => nds.map((n) => {
                if (n.id === String(step.node) && !n.className.includes('start-node') && !n.className.includes('target-node')) {
                    return { ...n, className: n.className + ' visited' };
                }
                return n;
            }));
            
            //color edge
            if (step.edge) {
                setEdges((eds) => eds.map((e) => {
                    if (e.id === step.edge) {
                        return { ...e, className: (e.className || '') + ' visited-edge' };
                    }
                    return e;
                }));
            }
        }, delay);
        delay += timePerStep;
    });

    // coloring
    setTimeout(() => {
        const pathNodesSet = new Set();
        const pathEdgesSet = new Set();

        Object.values(pathsDict).forEach(pathArray => {
            for (let i = 0; i < pathArray.length; i++) {
                pathNodesSet.add(String(pathArray[i]));
                if (i < pathArray.length - 1) {
                    const source = String(pathArray[i]);
                    const target = String(pathArray[i+1]);
                    const edge = edges.find(e => e.source === source && e.target === target);
                    if (edge) pathEdgesSet.add(edge.id);
                }
            }
        });

        setNodes((nds) => nds.map((n) => {
            if (pathNodesSet.has(n.id) && !n.className.includes('start-node') && !n.className.includes('target-node')) {
                return { ...n, className: n.className.replace(' visited', '') + ' path-node' };
            }
            return n;
        }));

        setEdges((eds) => eds.map((e) => {
            if (pathEdgesSet.has(e.id)) {
                return { ...e, className: (e.className || '').replace(' visited-edge', '') + ' path-edge' };
            }
            return e;
        }));

    }, delay + 500);
  };

  const runAlgorithms = async () => {
    if (!startNode || targetNodes.size === 0) {
      alert("Please select a Start Node and at least one Target Node!");
      return;
    }

    const graphData = {
        startNode: startNode,
        targetNodes: Array.from(targetNodes),
        nodes: nodes,
        edges: edges.map(e => ({ 
            id: e.id, // <--- ΣΗΜΑΝΤΙΚΟ: Στέλνουμε το ID στο backend πλέον
            source: e.source, 
            target: e.target, 
            weight: e.label ? parseInt(e.label.replace('Cost: ', '')) : 1 
        }))
    };

    try {
      const response = await fetch("http://127.0.0.1:8000/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(graphData),
      });

      const data = await response.json();
      
      //select which result to animate based on user choice
      const resultToAnimate = selectedAlgorithm === 'classic' 
          ? data.classic_dijkstra 
          : data.dijkstra_prediction;

      animateDijkstra(resultToAnimate.visited_steps, resultToAnimate.paths);
      
      // debugging logs
      console.log(`Classic explored: ${data.classic_dijkstra.visited_steps.length} nodes`);
      console.log(`Prediction explored: ${data.dijkstra_prediction.visited_steps.length} nodes`);
      
    } catch (error) {
      console.error("Error connecting to backend:", error);
      alert("Failed to connect to Python backend.");
    }
  };

  // side buttons
  return (
    <div className="graph-container">
      
      <input 
        type="file" 
        accept=".json" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileUpload} />

      {!isSidebarOpen && (
        <button 
          className="toggle-sidebar-btn" 
          onClick={() => setSidebarOpen(true)}
          title="Open Tools"
        >
          <span>☰</span>
        </button>
      )}

      <div className={`control-panel ${isSidebarOpen ? 'open' : 'closed'}`}>
        
        <div className="panel-content">
            
            <div className="panel-header">
                <h3 className="panel-title">Graph Tools</h3>
                <button 
                  className="btn-close-panel" 
                  onClick={() => setSidebarOpen(false)}
                  title="Close Tools"
                >
                  ✕
                </button>
            </div>
            
            <div className={`edge-weight-container ${selectedEdge ? 'active' : 'disabled'}`}>
                <label className={`edge-weight-label ${selectedEdge ? 'active' : 'disabled'}`}>
                    Edge Weight
                </label>
                <input 
                    type={selectedEdge ? "number" : "text"} 
                    min="1"
                    value={selectedEdge ? edgeWeight : ""}
                    placeholder={selectedEdge ? "" : "Select an edge"}
                    onChange={handleWeightChange}
                    disabled={!selectedEdge}
                    className={`weight-input ${selectedEdge ? 'active' : 'disabled'}`}
                />
            </div>

            <div style={{margin: '10px 0', borderTop: '1px solid #eee'}}></div>

            <button className="btn btn-add" onClick={addNode}><span>+</span> Add Node</button>
            
            <button 
                className="btn btn-start" 
                onClick={setAsStart} 
                disabled={!isNodeSelected}
                title="Set selected node as Start (Source)"
            >
                Set Start
            </button>
            
            <button 
                className="btn btn-target" 
                onClick={toggleTarget} 
                disabled={!isNodeSelected}
                title="Toggle selected node as Target"
            >
                Toggle Target
            </button>

            <button 
                className="btn btn-delete" 
                onClick={deleteSelected}
                disabled={!nodes.some(n => n.selected) && !edges.some(e => e.selected)}
            >
                <span></span> Delete Selected
            </button>

            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '10px 0'}}/>

            <button className="btn btn-clear" onClick={clearGraph}>
                Clear All
            </button>

            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '10px 0'}}/>

            <div style={{display: 'flex', gap: '5px', marginTop: '5px'}}>
                <button className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: '0'}} onClick={downloadGraph} title="Save to File">
                    Save
                </button>
                <button className="btn" style={{backgroundColor: '#475569', color: 'white', marginTop: '0'}} onClick={triggerLoad} title="Load from File">
                    Load
                </button>
            </div>

            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '10px 0'}}/>

            <button className="btn btn-random" onClick={generateRandomGraph}>
                <span></span> Random Graph
            </button>

            <button className="btn btn-random" style={{marginTop: '5px', backgroundColor: '#e11d48'}} onClick={generateTrapGraph}>
                <span></span> Trap Scenario
            </button>

            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '5px 0'}}/>

            <hr style={{width: '100%', border: '0', borderTop: '1px solid #eee', margin: '10px 0'}}/>

            <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '5px', display: 'block' }}>
                    Select Algorithm:
                </label>
                <select 
                    value={selectedAlgorithm} 
                    onChange={(e) => setSelectedAlgorithm(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
                >
                    <option value="classic">Classic Dijkstra</option>
                    <option value="prediction">Dijkstra-Prediction (GNN)</option>
                </select>
            </div>

            <button className="btn" style={{backgroundColor: '#0284c7', color: 'white', marginTop: 'auto'}} onClick={runAlgorithms}>
                <span></span> Run {selectedAlgorithm === 'classic' ? 'Classic' : 'Prediction'}
            </button>
        </div>
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
        <Controls position="top-right" />
        <MiniMap style={{height: 100, border: '1px solid #ddd'}} />
      </ReactFlow>
    </div>
  );
}