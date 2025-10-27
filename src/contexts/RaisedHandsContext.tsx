import { createContext, ReactNode, useContext } from 'react';

export type RaisedHandsContextType = {
  raisedUserIds: string[];
};

const RaisedHandsContext = createContext<RaisedHandsContextType>({ raisedUserIds: [] });

export const useRaisedHands = () => useContext(RaisedHandsContext);

export const RaisedHandsProvider = ({ children, value }: { children: ReactNode; value: RaisedHandsContextType }) => {
  return <RaisedHandsContext.Provider value={value}>{children}</RaisedHandsContext.Provider>;
};
