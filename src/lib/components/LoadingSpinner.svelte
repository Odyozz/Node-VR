<script lang="ts">
  export let size = 'medium'; // 'small', 'medium', 'large'
  export let color = '#3b82f6';
</script>

<div class="spinner-container" class:small={size === 'small'} class:large={size === 'large'}>
  <div class="spinner" style="border-top-color: {color}"></div>
</div>

<style>
  .spinner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .spinner-container.small {
    padding: 10px;
  }

  .spinner-container.large {
    padding: 40px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner-container.small .spinner {
    width: 20px;
    height: 20px;
    border-width: 2px;
  }

  .spinner-container.large .spinner {
    width: 48px;
    height: 48px;
    border-width: 4px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>