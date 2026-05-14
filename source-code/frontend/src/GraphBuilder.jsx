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
  const [isInfoPanelOpen, setInfoPanelOpen] = useState(false);

  // playback state
  const [animationData, setAnimationData] = useState(null);
  const [animationTimeline, setAnimationTimeline] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef(null);
  const [predictionStats, setPredictionStats] = useState(null);

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

  useEffect(() => {
    const handleEscClose = (event) => {
      if (event.key === 'Escape') {
        setInfoPanelOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscClose);
    return () => window.removeEventListener('keydown', handleEscClose);
  }, []);

  const addNode = () => {
    const jitter = () => (Math.random() - 0.5) * 120;
    const centerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const centerFlow = rfInstance ? rfInstance.project(centerScreen) : { x: 250, y: 250 };

    const newNode = {
      id: `${nodeId}`,
      position: { x: centerFlow.x + jitter(), y: centerFlow.y + jitter() },
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

    const minNodes = 10;
    const maxNodes = 20;
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
    if (!confirm("Generate Trap Graph? This demonstrates prediction pruning in PQ.")) return;

    const newNodes = [];
    const newEdges = [];

    // Long corridor ensures i0=10 is reached before the hub relaxes trap edges
    const corridorLength = 11; // nodes 1..11
    const corridorStartX = 120;
    const corridorStartY = 80;
    const corridorStepX = 160;

    for (let i = 1; i <= corridorLength; i++) {
      newNodes.push({
        id: `${i}`,
        position: { x: corridorStartX + (i - 1) * corridorStepX, y: corridorStartY },
        data: { label: i === 1 ? 'Start' : `Step ${i}` },
        className: i === 1 ? 'thesis-node start-node' : 'thesis-node',
      });

      if (i > 1) {
        newEdges.push({
          id: `e${i - 1}-${i}`,
          source: `${i - 1}`,
          target: `${i}`,
          animated: true,
          label: 'Cost: 1',
          style: { stroke: '#555', strokeWidth: 2 },
        });
      }
    }

    // Short target branch after the hub
    const targetId = corridorLength + 1; // node 12
    newNodes.push({
      id: `${targetId}`,
      position: { x: corridorStartX + corridorLength * corridorStepX, y: corridorStartY + 140 },
      data: { label: 'Target' },
      className: 'thesis-node target-node',
    });

    newEdges.push({
      id: `e${corridorLength}-${targetId}`,
      source: `${corridorLength}`,
      target: `${targetId}`,
      animated: true,
      label: 'Cost: 1',
      style: { stroke: '#555', strokeWidth: 2 },
    });

    // Trap fan-out with large weights (classic Dijkstra inserts all into PQ)
    const trapCount = 10;
    const trapStartId = targetId + 1; // node 13
    const trapCenterX = corridorStartX + (corridorLength - 1) * corridorStepX;
    const trapCenterY = corridorStartY + 260;
    const trapRadius = 420;

    for (let i = 0; i < trapCount; i++) {
      const angle = (2 * Math.PI * i) / trapCount;
      const trapId = trapStartId + i;

      newNodes.push({
        id: `${trapId}`,
        position: {
          x: trapCenterX + Math.cos(angle) * trapRadius,
          y: trapCenterY + Math.sin(angle) * (trapRadius * 0.4) + 220,
        },
        data: { label: `Trap ${trapId}` },
        className: 'thesis-node',
      });

      newEdges.push({
        id: `e${corridorLength}-${trapId}`,
        source: `${corridorLength}`,
        target: `${trapId}`,
        animated: true,
        label: 'Cost: 30',
        style: { stroke: '#ef4444', strokeWidth: 2 },
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    setNodeId(trapStartId + trapCount);
    setStartNodeState('1');
    setTargetNodesState(new Set([`${targetId}`]));

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
  
const resetHighlights = () => {
  setNodes((nds) => nds.map(n => ({
    ...n,
    className: n.className.replace(/ visited| path-node| queue-node/g, '')
  })));
  setEdges((eds) => eds.map(e => ({
    ...e,
    className: (e.className || '').replace(/ visited-edge| path-edge/g, '')
  })));
};

const isPredictionQueueSteps = (queueSteps) => {
  if (!queueSteps) return false;
  for (const q of queueSteps) {
    if (!q) continue;
    return !Array.isArray(q) && typeof q === 'object' && Object.prototype.hasOwnProperty.call(q, 'pq');
  }
  return false;
};

const resolveQueueSnapshot = (queueSteps, stepIndex, mode = 'last') => {
  if (!queueSteps || !queueSteps[stepIndex]) return [];
  const q = queueSteps[stepIndex];
  if (Array.isArray(q)) {
    if (q.length > 0 && Array.isArray(q[0])) {
      return mode === 'first' ? q[0] : q[q.length - 1];
    }
    if (q.length > 0 && q[0] && typeof q[0].node !== 'undefined') return q;
    return q;
  }
  if (q.pq) return q.pq;
  if (q.pq_snapshots && q.pq_snapshots.length > 0) {
    return mode === 'first' ? q.pq_snapshots[0] : q.pq_snapshots[q.pq_snapshots.length - 1];
  }
  return [];
};

const buildTimeline = (data) => {
  if (!data || !data.visited_steps) return [];
  const steps = [];
  const maxVisited = data.visited_steps.length;
  const isPrediction = isPredictionQueueSteps(data.queue_steps);
  let lastQueueKey = null;

  if (maxVisited === 0) return steps;

  for (let i = 0; i < maxVisited - 1; i++) {
    // queue state after relaxing current visited node
    const queueIndex = isPrediction ? i + 1 : i;
    const queueSnapshot = resolveQueueSnapshot(data.queue_steps, queueIndex, 'last');
    const queueKey = JSON.stringify(queueSnapshot.map(q => String(q.node)).sort());
    if (queueKey !== lastQueueKey) {
      steps.push({ type: 'queue', stepIndex: i });
      lastQueueKey = queueKey;
    }

    // visit the next node as a separate step
    steps.push({ type: 'visit', stepIndex: i + 1 });
  }

  if (maxVisited === 1) {
    const queueIndex = isPrediction ? 1 : 0;
    const queueSnapshot = resolveQueueSnapshot(data.queue_steps, queueIndex, 'last');
    const queueKey = JSON.stringify(queueSnapshot.map(q => String(q.node)).sort());
    if (queueKey !== lastQueueKey) {
      steps.push({ type: 'queue', stepIndex: 0 });
      lastQueueKey = queueKey;
    }
  }

  steps.push({ type: 'path' });
  return steps;
};

const applyStep = (timelineIndex, data, timeline) => {
  if (!data) return;
  const { visited_steps, paths, queue_steps } = data;
  const isPrediction = isPredictionQueueSteps(queue_steps);
  resetHighlights();

  if (timelineIndex < 0) return;

  const stepDef = timeline[timelineIndex];
  if (!stepDef) return;

  if (stepDef.type === 'path') {
    // show full visited set, then shortest paths
    const visitedSet = new Set(visited_steps.map(s => String(s.node)));
    const visitedEdgeSet = new Set(visited_steps.map(s => s.edge).filter(Boolean));
    const lastQueueIndex = visited_steps.length - 1;
    const finalQueueSnapshot = lastQueueIndex >= 0
      ? resolveQueueSnapshot(queue_steps, lastQueueIndex, 'last')
      : [];
    const finalQueueNodeIds = new Set(finalQueueSnapshot.map(q => String(q.node)));

    if (isPrediction && queue_steps && queue_steps[lastQueueIndex]) {
      const entry = queue_steps[lastQueueIndex];
      if (entry && entry.P !== undefined && entry.B !== undefined) {
        setPredictionStats({
          P: entry.P,
          B: entry.B,
          RCount: Array.isArray(entry.R) ? entry.R.length : 0,
        });
      }
    } else {
      setPredictionStats(null);
    }

    setNodes((nds) => nds.map((n) => {
      let cls = n.className;
      if (finalQueueNodeIds.has(n.id) && !cls.includes('start-node') && !cls.includes('target-node')) {
        cls += ' queue-node';
      }
      if (visitedSet.has(n.id) && !cls.includes('start-node') && !cls.includes('target-node')) {
        cls = cls.replace(' queue-node', '') + ' visited';
      }
      return { ...n, className: cls };
    }));

    setEdges((eds) => eds.map((e) => {
      if (visitedEdgeSet.has(e.id)) {
        return { ...e, className: (e.className || '') + ' visited-edge' };
      }
      return e;
    }));

    const pathNodesSet = new Set();
    const pathEdgesSet = new Set();
    Object.values(paths).forEach(pathArray => {
      for (let i = 0; i < pathArray.length; i++) {
        pathNodesSet.add(String(pathArray[i]));
        if (i < pathArray.length - 1) {
          const source = String(pathArray[i]);
          const target = String(pathArray[i + 1]);
          const edge = edges.find(e => e.source === source && e.target === target);
          if (edge) pathEdgesSet.add(edge.id);
        }
      }
    });

    setNodes((nds) => nds.map((n) => {
      if (pathNodesSet.has(n.id) && !n.className.includes('start-node') && !n.className.includes('target-node')) {
        const withoutVisited = n.className.replace(' visited', '');
        return { ...n, className: withoutVisited + ' path-node' };
      }
      return n;
    }));

    setEdges((eds) => eds.map((e) => {
      if (pathEdgesSet.has(e.id)) {
        return { ...e, className: (e.className || '').replace(' visited-edge', '') + ' path-edge' };
      }
      return e;
    }));

    return;
  }

  const stepIndex = stepDef.stepIndex;
  if (typeof stepIndex !== 'number') return;

  const visitedSet = new Set();
  const visitedEdgeSet = new Set();
  for (let i = 0; i <= stepIndex && i < visited_steps.length; i++) {
    const step = visited_steps[i];
    visitedSet.add(String(step.node));
    if (step.edge) visitedEdgeSet.add(step.edge);
  }

  let queueSnapshot = [];
  let predictionEntry = null;
  if (stepDef.type === 'queue') {
    const queueIndex = isPrediction ? stepIndex + 1 : stepIndex;
    queueSnapshot = resolveQueueSnapshot(queue_steps, queueIndex, 'last');
    predictionEntry = isPrediction && queue_steps ? queue_steps[queueIndex] : null;
  } else if (stepDef.type === 'visit') {
    const queueIndex = isPrediction ? stepIndex : stepIndex - 1;
    if (queueIndex >= 0) {
      queueSnapshot = resolveQueueSnapshot(queue_steps, queueIndex, 'last');
      predictionEntry = isPrediction && queue_steps ? queue_steps[queueIndex] : null;
    }
  }

  if (isPrediction && predictionEntry && predictionEntry.P !== undefined && predictionEntry.B !== undefined) {
    setPredictionStats({
      P: predictionEntry.P,
      B: predictionEntry.B,
      RCount: Array.isArray(predictionEntry.R) ? predictionEntry.R.length : 0,
    });
  } else if (!isPrediction) {
    setPredictionStats(null);
  }

  const queueNodeIds = new Set(queueSnapshot.map(q => String(q.node)));
  if (stepDef.type === 'visit') {
    queueNodeIds.delete(String(visited_steps[stepIndex].node));
  }

  setNodes((nds) => nds.map((n) => {
    let cls = n.className;
    if (queueNodeIds.has(n.id) && !cls.includes('start-node') && !cls.includes('target-node') && !cls.includes('visited')) {
      cls += ' queue-node';
    }
    if (visitedSet.has(n.id) && !cls.includes('start-node') && !cls.includes('target-node')) {
      cls = cls.replace(' queue-node', '') + ' visited';
    }
    return { ...n, className: cls };
  }));

  setEdges((eds) => eds.map((e) => {
    if (visitedEdgeSet.has(e.id)) {
      return { ...e, className: (e.className || '') + ' visited-edge' };
    }
    return e;
  }));

};

const stopPlayback = () => {
  if (playbackTimerRef.current) {
    clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;
  }
  setIsPlaying(false);
};

const startPlayback = () => {
  if (!animationData) return;
  if (isPlaying) return;
  const maxStep = animationTimeline.length - 1;
  setIsPlaying(true);
  playbackTimerRef.current = setInterval(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, maxStep);
      applyStep(next, animationData, animationTimeline);
      if (next >= maxStep) {
        stopPlayback();
      }
      return next;
    });
  }, 1000);
};

const startPlaybackWith = (data, timeline) => {
  if (!data || !timeline || timeline.length === 0) return;
  if (isPlaying) return;
  const maxStep = timeline.length - 1;
  setIsPlaying(true);
  playbackTimerRef.current = setInterval(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, maxStep);
      applyStep(next, data, timeline);
      if (next >= maxStep) {
        stopPlayback();
      }
      return next;
    });
  }, 1000);
};

const stepNext = () => {
  if (!animationData) return;
  const maxStep = animationTimeline.length - 1;
  const next = Math.min(currentStep + 1, maxStep);
  setCurrentStep(next);
  applyStep(next, animationData, animationTimeline);
};

const stepPrev = () => {
  if (!animationData) return;
  const prev = Math.max(currentStep - 1, -1);
  setCurrentStep(prev);
  applyStep(prev, animationData, animationTimeline);
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
            id: e.id, 
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

      stopPlayback();
      resetHighlights();
        const timeline = buildTimeline(resultToAnimate);
        setAnimationData(resultToAnimate);
        setAnimationTimeline(timeline);
      setCurrentStep(-1);
      setPredictionStats(null);
        startPlaybackWith(resultToAnimate, timeline);
      
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
                <button className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: '0'}} onClick={triggerLoad} title="Load from File">
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
                    <option value="prediction">Dijkstra-Prediction (MLP)</option>
                </select>
            </div>

            <button className="btn" style={{backgroundColor: '#0284c7', color: 'white', marginTop: 'auto'}} onClick={runAlgorithms}>
                <span></span> Run {selectedAlgorithm === 'classic' ? 'Classic' : 'Prediction'}
            </button>
        </div>
      </div>

      <div className="graph-legend" aria-label="Graph color legend">
        <h4 className="graph-legend-title">Legend</h4>
        <div className="graph-legend-list">
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-default"></span>
            <span>Regular node</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-start"></span>
            <span>Start node</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-target"></span>
            <span>Target node</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-visited"></span>
            <span>Visited node</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-queue"></span>
            <span>Queue node (step)</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-swatch legend-node-path"></span>
            <span>Shortest path node</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-line legend-edge-default"></span>
            <span>Regular edge</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-line legend-edge-visited"></span>
            <span>Visited edge</span>
          </div>
          <div className="graph-legend-item">
            <span className="legend-line legend-edge-path"></span>
            <span>Shortest path edge</span>
          </div>
        </div>
        {predictionStats && (
          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #eee',
              fontSize: '12px',
              fontWeight: 600,
              color: '#1f2937',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
            aria-label="Prediction stats"
          >
            <span>P: {predictionStats.P}</span>
            <span>B: {predictionStats.B}</span>
          </div>
        )}
      </div>

      <button
        className="info-toggle-btn"
        onClick={() => setInfoPanelOpen((isOpen) => !isOpen)}
        title="Open thesis notes"
        aria-label="Open thesis notes"
      >
        i
      </button>

      {isInfoPanelOpen && (
        <div
          className="thesis-info-overlay"
          onClick={() => setInfoPanelOpen(false)}
          aria-label="Thesis information overlay"
        >
          <div
            className="thesis-info-panel"
            onClick={(e) => e.stopPropagation()}
            aria-label="Thesis information panel"
          >
            <div className="thesis-info-header">
              <h4>Thesis Notes</h4>
              <button
                className="thesis-info-close"
                onClick={() => setInfoPanelOpen(false)}
                title="Close notes"
                aria-label="Close notes"
              >
                x
              </button>
            </div>
            <div className="thesis-info-content">
              TO BE FILLED
            </div>
          </div>
        </div>
      )}


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
        <MiniMap style={{ height: 100, border: '1px solid #ddd' }} />
      </ReactFlow>

      {/* Bottom playback panel */}
      <div className="bottom-panel">
        <button className="btn btn-bottom-panel" title="Previous Step" onClick={stepPrev}>
          &#9664; Previous Step
        </button>
        <button className="btn btn-bottom-panel" title="Next Step" onClick={stepNext}>
          &#9654; Next Step
        </button>
        <button className="btn btn-bottom-panel" title="Play" onClick={startPlayback}>
          &#9654;&#9654; Play
        </button>
        <button className="btn btn-bottom-panel" title="Pause" onClick={stopPlayback}>
          &#10073;&#10073; Pause
        </button>
      </div>

    </div>
  );
}