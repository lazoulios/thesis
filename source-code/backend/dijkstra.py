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
    queue_steps = []  # record a list per visited step; each element is an array of snapshots
    settled = set()
    targets_set = set(target_nodes)
    found_target = None

    while pq:
        # Take a snapshot before popping, but only append snapshots for actual (non-duplicate) pops
        snapshot_before = [{"distance": d, "node": n} for d, n in sorted(pq)]

        current_distance, current_node = heapq.heappop(pq)

        if current_node in settled:
            # skip duplicates introduced in the heap
            continue

        settled.add(current_node)

        # start a list of snapshots for this visited step
        current_step_snapshots = [snapshot_before]

        # save visited step with edge info
        visited_steps.append({
            "node": current_node,
            "edge": previous_edges[current_node]
        })

        if current_node in targets_set:
            found_target = current_node
            # append snapshots for this last visited node and break
            queue_steps.append(current_step_snapshots)
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

                current_step_snapshots.append([
                    {"distance": d, "node": n} for d, n in sorted(pq)
                ])

        queue_steps.append(current_step_snapshots)

    remaining_queue = [
        {"distance": distance, "node": node}
        for distance, node in sorted(pq)
    ]

    paths = {}
    for target in target_nodes:
        if target != found_target:
            paths[target] = []
            continue

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

    return visited_steps, paths, distances, remaining_queue, queue_steps