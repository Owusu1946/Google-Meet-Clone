import { useCallback } from 'react';
const COLORS = [
  '#1abc9c',
  '#c2175b',
  '#3498db',
  '#9b59b6',
  '#34495e',
  '#16a085',
  '#27ae60',
  '#2980b9',
  '#8e44ad',
  '#2c3e50',
  '#f1c40f',
  '#e67e22',
  '#e74c3c',
  '#95a5a6',
  '#f39c12',
  '#d35400',
  '#c0392b',
  '#bdc3c7',
  '#7f8c8d',
];
export default function useUserColor() {
  return useCallback((name: string) => {
    let hash = 0;
    for (const character of name || 'Participant')
      hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
    return COLORS[hash % COLORS.length];
  }, []);
}
