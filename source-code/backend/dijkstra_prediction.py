import heapq
import numpy as np
from pathlib import Path

from joblib import load

#loading the model
MODEL_FILENAME = 'dijkstra_mlp_16x16.joblib'

#had some errors with loading so some failsafes
def _find_model_file():
    here = Path(__file__).resolve().parent
    candidates = [
        here / 'models' / MODEL_FILENAME,            
        here.parent / 'models' / MODEL_FILENAME,     
        here.parent.parent / 'models' / MODEL_FILENAME,  
        Path.cwd() / 'models' / MODEL_FILENAME,      
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

model_path = _find_model_file()
if model_path is None:
    tried = [str(p) for p in [
        Path(__file__).resolve().parent / 'models' / MODEL_FILENAME,
        Path(__file__).resolve().parent.parent / 'models' / MODEL_FILENAME,
        Path(__file__).resolve().parent.parent.parent / 'models' / MODEL_FILENAME,
        Path.cwd() / 'models' / MODEL_FILENAME,
    ]]
    raise FileNotFoundError(f"Model file '{MODEL_FILENAME}' not found. Tried locations: {', '.join(tried)}")

mlp_model = load(model_path)

def mlp_predict(trace):
    trace_array = np.array([trace]) 
    return mlp_model.predict(trace_array)[0]

def run_prediction_dijkstra(nodes_data, edges_data, start_node, target_nodes, i0=10, alpha=1.1, beta=1.2, collect_stats=False):
    graph = {node['id']: [] for node in nodes_data}
    for edge in edges_data:
        graph[edge.source].append((edge.target, edge.weight, edge.id))
        
    distances = {node['id']: float('inf') for node in nodes_data}
    distances[start_node] = 0

    previous_nodes = {node['id']: None for node in nodes_data}
    previous_edges = {node['id']: None for node in nodes_data}

    pq = [(0, start_node)]
    
    B = float('inf')  # Pruning bound (shortest path to target found so far
    P = float('inf')  # Prediction value
    R = {}            # Reserve set
    trace = []
    iteration = 0

    visited_steps = []
    queue_steps = []  # to record PQ, R, P, and B
    settled = set()
    targets_set = set(target_nodes)
    found_target = None

    pq_pushes = 1  # initial push
    pq_pops = 0
    pq_skips = 0
    r_inserts = 0
    r_rescues = 0

    while pq or R:
        
        # If PQ is empty OR the minimum distance in PQ exceeds P, we need to inflate P
        # and rescue valid nodes from the Reserve Set R.
        while (not pq or pq[0][0] > P) and R:
            P = P * beta if P != float('inf') else float('inf')
            
            nodes_to_rescue = []
            for r_node, r_dist in R.items():
                if r_dist <= P and r_dist <= B:
                    heapq.heappush(pq, (r_dist, r_node))
                    pq_pushes += 1
                    r_rescues += 1
                    nodes_to_rescue.append(r_node)
            
            for r_node in nodes_to_rescue:
                del R[r_node]
                
        if not pq:
            break

        # Record a snapshot of the queue, the reserve set, and the bounds before popping
        current_pq = [{"distance": d, "node": n} for d, n in sorted(pq)]
        current_R = [{"distance": d, "node": n} for n, d in R.items()]
        queue_steps.append({
            "pq": current_pq, 
            "R": current_R, 
            "P": P if P != float('inf') else "Infinity", 
            "B": B if B != float('inf') else "Infinity"
        })

        current_distance, current_node = heapq.heappop(pq)
        pq_pops += 1

        if current_node in settled:
            pq_skips += 1
            continue

        settled.add(current_node)
        iteration += 1

        visited_steps.append({
            "node": current_node,
            "edge": previous_edges[current_node]
        })

        if iteration <= i0:
            formatted_B = 0 if B == float('inf') else B
            trace.extend([current_distance, formatted_B])

        if current_node in targets_set:
            found_target = current_node
            break

        if iteration == i0:
            while len(trace) < i0 * 2:
                formatted_B = 0 if B == float('inf') else B
                trace.extend([current_distance, formatted_B])
                
            raw_prediction = mlp_predict(trace)
            P = raw_prediction * alpha  #inflate prediction to be more conservative

        # relax routine
        for neighbor, weight, edge_id in graph[current_node]:
            if neighbor in settled:
                continue

            new_distance = current_distance + weight

            if new_distance > B:
                continue

            if neighbor in targets_set:
                B = min(B, new_distance)

            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                previous_nodes[neighbor] = current_node
                previous_edges[neighbor] = edge_id
                
                if new_distance <= P:
                    heapq.heappush(pq, (new_distance, neighbor))
                    pq_pushes += 1
                    if neighbor in R:
                        del R[neighbor]
                else:
                    R[neighbor] = new_distance
                    r_inserts += 1

    current_pq = [{"distance": d, "node": n} for d, n in sorted(pq)]
    current_R = [{"distance": d, "node": n} for n, d in R.items()]
    queue_steps.append({
        "pq": current_pq, 
        "R": current_R, 
        "P": P if P != float('inf') else "Infinity", 
        "B": B if B != float('inf') else "Infinity"
    })

    remaining_queue = [{"distance": d, "node": n} for d, n in sorted(pq)]

    paths = {}
    for target in target_nodes:
        if target != found_target or distances[target] == float('inf'):
            paths[target] = []
            continue

        path = []
        curr = target
        while curr is not None:
            path.append(curr)
            curr = previous_nodes[curr]
        path.reverse()
        paths[target] = path

    if collect_stats:
        stats = {
            "pq_pushes": pq_pushes,
            "pq_pops": pq_pops,
            "pq_skips": pq_skips,
            "r_inserts": r_inserts,
            "r_rescues": r_rescues,
        }
        return visited_steps, paths, distances, remaining_queue, queue_steps, stats

    return visited_steps, paths, distances, remaining_queue, queue_steps