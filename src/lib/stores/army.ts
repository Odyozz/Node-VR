import { writable } from 'svelte/store';

export type ArmyQueueItem = {
  key: string;
  qty: number;
  endsAt: number;
};

export const armyQueue = writable<ArmyQueueItem[]>([]);
