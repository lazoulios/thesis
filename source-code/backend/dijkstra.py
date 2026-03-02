import heapq

def run_classic_dijkstra(nodes_data, edges_data, start_node, target_nodes):
    #build the graph adjacency list
    graph = {node['id']: [] for node in nodes_data}
    for edge in edges_data:
        graph[edge.source].append((edge.target, edge.weight, edge.id))
        
    distances = {node['id']: float('inf') for node in nodes_data}
    distances[start_node] = 0

    previous_nodes = {node['id']: None for node in nodes_data}
    previous_edges = {node['id']: None for node in nodes_data}

    pq = [(0, start_node)]
    
    visited_steps = []  
    settled = set()
    targets_left = set(target_nodes)

    while pq:
        current_distance, current_node = heapq.heappop(pq)

        if current_node in settled:
            continue

        settled.add(current_node)
        
        #save visited step with edge info
        visited_steps.append({
            "node": current_node,
            "edge": previous_edges[current_node]
        })

        if current_node in targets_left:
            targets_left.remove(current_node)
            if not targets_left:
                break 

        for neighbor, weight, edge_id in graph[current_node]:
            if neighbor in settled:
                continue
            
            new_distance = current_distance + weight
            if new_distance < distances[neighbor]:
                distances[neighbor] = new_distance
                previous_nodes[neighbor] = current_node
                previous_edges[neighbor] = edge_id 
                heapq.heappush(pq, (new_distance, neighbor))

    paths = {}
    for target in target_nodes:
        if distances[target] == float('inf'):
            paths[target] = [] 
            continue
            
        path = []
        curr = target
        while curr is not None:
            path.append(curr)
            curr = previous_nodes[curr]
        path.reverse()
        paths[target] = path

    return visited_steps, paths, distances