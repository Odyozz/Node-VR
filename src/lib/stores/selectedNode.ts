// src/lib/stores/selectedNode.ts
import { writable } from 'svelte/store';
import type { NodeData } from '../types';

export const selectedNode = writable<NodeData | null>(null);
