import type React from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ZeusDataPart } from '@/lib/zeus-types';

type DataStreamContextValue = {
  dataStream: ZeusDataPart[];
  setDataStream: React.Dispatch<React.SetStateAction<ZeusDataPart[]>>;
};

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({ children }: { children: React.ReactNode }) {
  const [dataStream, setDataStream] = useState<ZeusDataPart[]>([]);
  const value = useMemo(() => ({ dataStream, setDataStream }), [dataStream]);
  return <DataStreamContext.Provider value={value}>{children}</DataStreamContext.Provider>;
}

export function useDataStream() {
  const ctx = useContext(DataStreamContext);
  if (!ctx) throw new Error('useDataStream must be used within a DataStreamProvider');
  return ctx;
}
