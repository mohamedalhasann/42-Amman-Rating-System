import {createContext, useContext} from 'react';
export const StaffContext = createContext(null);
export const useStaff = () => useContext(StaffContext);
