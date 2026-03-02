from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dijkstra import run_classic_dijkstra

app = FastAPI(title="Dijkstra Prediction API")

#Setting for front to be able to talk with back end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Edge
class EdgeModel(BaseModel):
    id: str
    source: str 
    target: str
    weight: int

#Graph Scructure
class GraphPayload(BaseModel):
    startNode: str
    targetNodes: List[str]
    nodes: List[dict] 
    edges: List[EdgeModel]

#API Endpoint
@app.post("/solve")
def solve_shortest_path(payload: GraphPayload):
    print(f"Received Graph! Start: {payload.startNode} | Targets: {payload.targetNodes}")
    
    #dijkstra
    visited, paths, distances = run_classic_dijkstra(
        payload.nodes, 
        payload.edges, 
        payload.startNode, 
        payload.targetNodes
    )
    
    print(f"Visited Nodes Order: {visited}")
    print(f"Paths found: {paths}")
    
    return {
        "status": "success",
        "message": "Algorithms executed successfully!",
        "classic_dijkstra": {
            "visited_steps": visited, 
            "paths": paths
        },
        # TODO Add dijkstra prediction results here
        "dijkstra_prediction": {
            "visited_steps": visited, 
            "paths": paths
        }
    }