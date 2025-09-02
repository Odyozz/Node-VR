<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { CombatResult } from '$lib/utils/combatSimulator';

  export let battleResult: CombatResult | null = null;
  export let show = false;

  const dispatch = createEventDispatcher();

  function close() {
    show = false;
    dispatch('close');
  }

  function formatUnits(units: Record<string, number>): string {
    return Object.entries(units)
      .filter(([_, count]) => count > 0)
      .map(([unit, count]) => `${unit} x${count}`)
      .join(', ') || 'Aucune unité';
  }
</script>

{#if show && battleResult}
  <div class="modal-backdrop" on:click={close} transition:fly={{ y: -50, duration: 300 }}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Rapport de Combat</h2>
        <button class="close-btn" on:click={close}>×</button>
      </div>
      
      <div class="battle-result">
        <div class="winner">
          🏆 Victoire: {battleResult.winner === 'attacker' ? 'Attaquant' : 'Défenseur'}
        </div>
        
        <div class="casualties">
          <div class="casualty-section">
            <h3>💀 Pertes Attaquant</h3>
            <div class="casualty-list">
              {formatUnits(battleResult.casualties.attacker)}
            </div>
          </div>
          
          <div class="casualty-section">
            <h3>💀 Pertes Défenseur</h3>
            <div class="casualty-list">
              {formatUnits(battleResult.casualties.defender)}
            </div>
          </div>
        </div>

        <div class="survivors">
          <div class="survivor-section">
            <h3>✅ Survivants Attaquant</h3>
            <div class="survivor-list">
              {formatUnits(battleResult.attackerRemaining)}
            </div>
          </div>
          
          <div class="survivor-section">
            <h3>✅ Survivants Défenseur</h3>
            <div class="survivor-list">
              {formatUnits(battleResult.defenderRemaining)}
            </div>
          </div>
        </div>
      </div>

      <div class="battle-log">
        <h3>📜 Journal de Combat</h3>
        <div class="log-content">
          {#each battleResult.battleLog as logEntry}
            <div class="log-entry">{logEntry}</div>
          {/each}
        </div>
      </div>

      <button class="confirm-btn" on:click={close}>Fermer</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal {
    background: #1a1f2e;
    border-radius: 16px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    border: 2px solid #3b82f6;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #374151;
  }

  .modal-header h2 {
    color: #fff;
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .close-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #fff;
  }

  .battle-result {
    padding: 24px;
  }

  .winner {
    text-align: center;
    font-size: 1.3rem;
    font-weight: 700;
    color: #10b981;
    margin-bottom: 24px;
    padding: 12px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 8px;
  }

  .casualties, .survivors {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }

  .casualty-section, .survivor-section {
    background: rgba(30, 30, 47, 0.5);
    padding: 16px;
    border-radius: 8px;
  }

  .casualty-section h3 {
    color: #ef4444;
    margin: 0 0 8px 0;
    font-size: 1rem;
  }

  .survivor-section h3 {
    color: #10b981;
    margin: 0 0 8px 0;
    font-size: 1rem;
  }

  .casualty-list, .survivor-list {
    color: #d1d5db;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .battle-log {
    padding: 0 24px 24px;
  }

  .battle-log h3 {
    color: #fff;
    margin: 0 0 12px 0;
    font-size: 1.1rem;
  }

  .log-content {
    background: #111827;
    border-radius: 8px;
    padding: 16px;
    max-height: 200px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .log-entry {
    color: #d1d5db;
    margin-bottom: 4px;
    white-space: pre-wrap;
  }

  .confirm-btn {
    width: calc(100% - 48px);
    margin: 0 24px 24px;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .confirm-btn:hover {
    background: #2563eb;
  }

  @media (max-width: 768px) {
    .casualties, .survivors {
      grid-template-columns: 1fr;
    }
  }
</style>