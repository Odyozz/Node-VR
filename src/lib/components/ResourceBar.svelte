<script lang="ts">
  import { resources } from '$lib/stores/resources';
  import { maxResources } from '$lib/stores/maxResources';

  export let compact = false;

  function getPercentage(current: number, max: number): number {
    return max > 0 ? Math.min((current / max) * 100, 100) : 0;
  }

  function getBarColor(percentage: number): string {
    if (percentage >= 90) return '#ef4444'; // Rouge si presque plein
    if (percentage >= 70) return '#f59e0b'; // Orange
    return '#10b981'; // Vert
  }
</script>

<div class="resource-bars" class:compact>
  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-icon">💾</span>
      <span class="resource-label">Data</span>
      <span class="resource-values">{$resources.data} / {$maxResources.data}</span>
    </div>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        style="width: {getPercentage($resources.data, $maxResources.data)}%; background-color: {getBarColor(getPercentage($resources.data, $maxResources.data))}"
      ></div>
    </div>
  </div>

  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-icon">⚡</span>
      <span class="resource-label">CPU</span>
      <span class="resource-values">{$resources.cpu} / {$maxResources.cpu}</span>
    </div>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        style="width: {getPercentage($resources.cpu, $maxResources.cpu)}%; background-color: {getBarColor(getPercentage($resources.cpu, $maxResources.cpu))}"
      ></div>
    </div>
  </div>

  <div class="resource-item">
    <div class="resource-header">
      <span class="resource-icon">📡</span>
      <span class="resource-label">Bandwidth</span>
      <span class="resource-values">{$resources.bandwidth} / {$maxResources.bandwidth}</span>
    </div>
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        style="width: {getPercentage($resources.bandwidth, $maxResources.bandwidth)}%; background-color: {getBarColor(getPercentage($resources.bandwidth, $maxResources.bandwidth))}"
      ></div>
    </div>
  </div>
</div>

<style>
  .resource-bars {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .resource-bars.compact {
    gap: 12px;
  }

  .resource-item {
    flex: 1;
    min-width: 180px;
    background: rgba(30, 30, 47, 0.8);
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(90, 127, 168, 0.3);
  }

  .compact .resource-item {
    min-width: 140px;
    padding: 8px 12px;
  }

  .resource-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .resource-icon {
    font-size: 1.2rem;
  }

  .compact .resource-icon {
    font-size: 1rem;
  }

  .resource-label {
    font-weight: 600;
    color: #fff;
    flex: 1;
  }

  .resource-values {
    font-size: 0.9rem;
    color: #d1d5db;
    font-weight: 500;
  }

  .compact .resource-values {
    font-size: 0.8rem;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(55, 65, 81, 0.8);
    border-radius: 3px;
    overflow: hidden;
  }

  .compact .progress-bar {
    height: 4px;
  }

  .progress-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .resource-bars {
      flex-direction: column;
      gap: 8px;
    }
    
    .resource-item {
      min-width: unset;
    }
  }
</style>