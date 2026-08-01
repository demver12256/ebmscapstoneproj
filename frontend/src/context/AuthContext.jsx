import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('ebms_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem('ebms_token');
    if (storedToken) {
      setAuthToken(storedToken);
    }
    return storedToken;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const { token: jwtToken, user: authUser } = response.data;
      setToken(jwtToken);
      setUser(authUser);
      localStorage.setItem('ebms_token', jwtToken);
      localStorage.setItem('ebms_user', JSON.stringify(authUser));
      setAuthToken(jwtToken);
      return authUser;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ebms_token');
    localStorage.removeItem('ebms_user');
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
