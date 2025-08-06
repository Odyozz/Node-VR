import { writable } from 'svelte/store';

export type MaxResources = {
  data: number;
  cpu: number;
  bandwidth: number;
};

export const maxResources = writable<MaxResources>({
  data: 0,
  cpu: 0,
  bandwidth: 0
});
