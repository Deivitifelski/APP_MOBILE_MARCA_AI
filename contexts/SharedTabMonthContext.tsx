import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface SharedTabMonthContextValue {
  /** Mês/ano exibidos na Agenda e no Financeiro (sempre dia 1). */
  viewedMonthDate: Date;
  setViewedMonthDate: (date: Date) => void;
  navigateMonth: (direction: 'prev' | 'next') => void;
}

const SharedTabMonthContext = createContext<SharedTabMonthContextValue | null>(
  null
);

export const SharedTabMonthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [viewedMonthDate, setViewedMonthDateState] = useState(() =>
    startOfMonth(new Date())
  );

  const setViewedMonthDate = useCallback((date: Date) => {
    setViewedMonthDateState(startOfMonth(date));
  }, []);

  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    setViewedMonthDateState((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const next = new Date(y, m, 1);
      if (direction === 'prev') {
        next.setMonth(m - 1);
      } else {
        next.setMonth(m + 1);
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      viewedMonthDate,
      setViewedMonthDate,
      navigateMonth,
    }),
    [viewedMonthDate, setViewedMonthDate, navigateMonth]
  );

  return (
    <SharedTabMonthContext.Provider value={value}>
      {children}
    </SharedTabMonthContext.Provider>
  );
};

export function useSharedTabMonth(): SharedTabMonthContextValue {
  const ctx = useContext(SharedTabMonthContext);
  if (!ctx) {
    throw new Error(
      'useSharedTabMonth deve ser usado dentro de SharedTabMonthProvider'
    );
  }
  return ctx;
}
