import random
import heapq
import csv
import numpy as np
from pydantic import BaseModel
from typing import List

# 1. ΠΡΟΣΟΧΗ: Το weight έγινε float!
class EdgeModel(BaseModel):
    id: str
    source: str 
    target: str
    weight: float 

class GraphPayload(BaseModel):
    startNode: str
    targetNodes: List[str]
    nodes: List[dict] 
    edges: List[EdgeModel]

def generate_erdos_renyi_graph() -> GraphPayload:
    n = 1000
    c = 8
    f = 20
    p = c / n
    q = f / n
    
    nodes = [{'id': str(i)} for i in range(n)]
    
    start_node = str(random.randint(0, n - 1))
    
    target_nodes = [str(i) for i in range(n) if random.random() < q and str(i) != start_node]
    
    if not target_nodes:
        fallback = start_node
        while fallback == start_node:
            fallback = str(random.randint(0, n - 1))
        target_nodes.append(fallback)

    edges = []
    edge_id_counter = 0
    
    for i in range(n):
        out_degree = np.random.binomial(n - 1, p)
        
        if out_degree > 0:
            possible_targets = [x for x in range(n) if x != i]
            targets = random.sample(possible_targets, out_degree)
            
            for t in targets:
                weight = random.uniform(0.0, 1.0)
                edges.append(EdgeModel(
                    id=f"e{edge_id_counter}",
                    source=str(i),
                    target=str(t),
                    weight=weight
                ))
                edge_id_counter += 1

    return GraphPayload(
        startNode=start_node,
        targetNodes=target_nodes,
        nodes=nodes,
        edges=edges
    )

def extract_trace_and_distance(payload: GraphPayload, i0=10):
    graph = {node['id']: [] for node in payload.nodes}
    for edge in payload.edges:
        graph[edge.source].append((edge.target, edge.weight))

    distances = {node['id']: float('inf') for node in payload.nodes}
    distances[payload.startNode] = 0

    pq = [(0, payload.startNode)]
    settled = set()
    targets_set = set(payload.targetNodes)

    B = float('inf')
    trace = []
    final_distance = None
    iterations = 0

    while pq:
        current_distance, current_node = heapq.heappop(pq)

        if current_node in settled:
            continue

        settled.add(current_node)
        iterations += 1

        if iterations <= i0:
            formatted_B = 0.0 if B == float('inf') else B
            trace.extend([current_distance, formatted_B])

        if current_node in targets_set:
            final_distance = current_distance
            break

        for neighbor, weight in graph[current_node]:
            if neighbor in settled:
                continue

            new_distance = current_distance + weight

            if neighbor in targets_set:
                B = min(B, new_distance)

            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                heapq.heappush(pq, (new_distance, neighbor))

    if final_distance is None or iterations <= i0:
        return None

    return {"trace": trace, "y": final_distance}

def generate_dataset(num_graphs, i0, filename="training_data.csv"):
    print(f"Generating {num_graphs} Erdos-Renyi graphs... This might take a while.")
    
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        headers = []
        for i in range(1, i0 + 1):
            headers.extend([f"d_{i}", f"B_{i}"])
        headers.append("True_Distance_y")
        writer.writerow(headers)

        valid_graphs = 0
        while valid_graphs < num_graphs:
            payload = generate_erdos_renyi_graph()
            result = extract_trace_and_distance(payload, i0)

            if result is not None:
                row = result["trace"] + [result["y"]]
                writer.writerow(row)
                valid_graphs += 1
                
                if valid_graphs % 1000 == 0:
                    print(f"Generated {valid_graphs} valid graphs...")

    print(f"Done! Dataset saved to {filename}")

if __name__ == "__main__":
    generate_dataset(num_graphs=80000, i0=10)