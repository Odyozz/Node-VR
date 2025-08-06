import { writable } from 'svelte/store';

export type Resources = {
  data: number;
  cpu: number;
  bandwidth: number;
};

const initialResources: Resources = {
  data: 0,
  cpu: 0,
  bandwidth: 0
};

export const resources = writable<Resources>(initialResources);
