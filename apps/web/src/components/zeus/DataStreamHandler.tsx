import { useEffect } from 'react';
import { useDataStream } from './DataStreamProvider';

/**
 * Renderless component. Processes Zeus custom data stream events.
 * Extend this as Zeus begins emitting agent-routing, memory-write,
 * and task-created events from the server.
 */
export function DataStreamHandler() {
  const { dataStream, setDataStream } = useDataStream();

  useEffect(() => {
    if (!dataStream.length) return;

    const deltas = dataStream.slice();
    setDataStream([]);

    for (const delta of deltas) {
      switch (delta.type) {
        case 'data-agent-routing':
          // Future: dispatch to agent routing state
          break;
        case 'data-memory-write':
          // Future: update memory state
          break;
        case 'data-task-created':
          // Future: add task to task list
          break;
        default:
          break;
      }
    }
  }, [dataStream, setDataStream]);

  return null;
}
