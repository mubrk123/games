import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_USER, User } from './mockData';

interface UserContextType {
  user: User;
  setUser: (user: User) => void;
  toggleRole: () => void;
  addFunds: (amount: number) => void;
  updateBalance: (amount: number) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(MOCK_USER);

  const toggleRole = () => {
    setUser(prev => ({
      ...prev,
      role: prev.role === 'ADMIN' ? 'USER' : 'ADMIN',
      username: prev.role === 'ADMIN' ? 'demo_user' : 'admin_master'
    }));
  };

  const addFunds = (amount: number) => {
    setUser(prev => ({
      ...prev,
      balance: prev.balance + amount
    }));
  };

  // Generic update balance (can be negative for bets)
  const updateBalance = (amount: number) => {
    setUser(prev => ({
      ...prev,
      balance: prev.balance + amount
    }));
  };

  return (
    <UserContext.Provider value={{ user, setUser, toggleRole, addFunds, updateBalance }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
