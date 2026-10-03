import {createContext,useContext} from 'react';
export type Lang='en'|'hi';
export const Language=createContext<Lang>('en');
export function useText(){const lang=useContext(Language);return (en:string,hi:string)=>lang==='hi'?hi:en;}
