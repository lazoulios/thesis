import random
import math
import heapq
import csv
from pydantic import BaseModel
from typing import List

class EdgeModel(BaseModel):
    id: str
    source: str 
    target: str
    weight: int

class GraphPayload(BaseModel):
    startNode: str
    targetNodes: List[str]
    nodes: List[dict] 
    edges: List[EdgeModel]

def generate_random_graph() -> GraphPayload:
    node_count = 100
    
    columns = math.ceil(math.sqrt(node_count))
    nodes = [{'id': str(i)} for i in range(1, node_count + 1)]
    edges = []


    for i in range(1, node_count + 1):
        num_edges = 1 if random.random() > 0.4 else 2
        
        for j in range(num_edges):
            possible_target = i + random.randint(0, columns - 1) + 1
            
            if possible_target > node_count:
                possible_target = random.randint(1, node_count - 1)
                
            if possible_target != i:
                exists = any(
                    (e.source == str(i) and e.target == str(possible_target)) or
                    (e.source == str(possible_target) and e.target == str(i))
                    for e in edges
                )
                
                if not exists:
                    weight = random.randint(1, 10)
                    edges.append(EdgeModel(
                        id=f"e{i}-{possible_target}-{j}",
                        source=str(i),
                        target=str(possible_target),
                        weight=weight
                    ))

    start_node = "1"
    random_targets = set()
    num_targets = random.randint(1, 3)
    
    while len(random_targets) < num_targets:
        min_target_id = int(node_count * 0.7)
        if node_count - min_target_id <= 0:
            r = random.randint(2, node_count)
        else:
            r = random.randint(min_target_id + 1, node_count)
            
        if str(r) != start_node:
            random_targets.add(str(r))

    return GraphPayload(
        startNode=start_node,
        targetNodes=list(random_targets),
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
            formatted_B = 0 if B == float('inf') else B
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

    if final_distance is None:
        return None

    while len(trace) < i0 * 2:
        formatted_B = 0 if B == float('inf') else B
        trace.extend([current_distance, formatted_B])

    return {"trace": trace, "y": final_distance}

def generate_dataset(num_graphs, i0, filename="training_data.csv"):
    print(f"Generating {num_graphs} graphs... This might take a minute.")
    
    with open(filename, mode='w', newline='') as file:
        writer = csv.writer(file)
        
        headers = []
        for i in range(1, i0 + 1):
            headers.extend([f"d_{i}", f"B_{i}"])
        headers.append("True_Distance_y")
        writer.writerow(headers)

        valid_graphs = 0
        while valid_graphs < num_graphs:
            payload = generate_random_graph()
            result = extract_trace_and_distance(payload, i0)

            if result is not None:
                row = result["trace"] + [result["y"]]
                writer.writerow(row)
                valid_graphs += 1
                
                if valid_graphs % 1000 == 0:
                    print(f"Generated {valid_graphs} valid graphs...")

    print(f"Done! Dataset saved to {filename}")

if __name__ == "__main__":
    generate_dataset(num_graphs=20000, i0=10)