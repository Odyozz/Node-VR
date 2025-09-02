<script lang="ts">
  import { notifications, removeNotification, markAsRead } from '$lib/stores/notifications';
  import { fly, fade } from 'svelte/transition';

  function getIcon(type: string) {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }

  function getColor(type: string) {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  }

  function formatTime(timestamp: number) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'maintenant';
  }
</script>

<div class="notification-container">
  {#each $notifications as notification (notification.id)}
    <div 
      class="notification"
      style="border-left-color: {getColor(notification.type)}"
      transition:fly={{ x: 300, duration: 300 }}
      on:click={() => markAsRead(notification.id)}
    >
      <div class="notification-header">
        <span class="icon">{getIcon(notification.type)}</span>
        <span class="title">{notification.title}</span>
        <span class="time">{formatTime(notification.timestamp)}</span>
        <button 
          class="close-btn"
          on:click|stopPropagation={() => removeNotification(notification.id)}
        >
          ×
        </button>
      </div>
      <div class="message">{notification.message}</div>
      {#if !notification.read}
        <div class="unread-indicator"></div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 400px;
    pointer-events: none;
  }

  .notification {
    background: rgba(30, 30, 47, 0.95);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    border-left: 4px solid;
    padding: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    cursor: pointer;
    pointer-events: all;
    position: relative;
    transition: transform 0.2s ease;
  }

  .notification:hover {
    transform: translateX(-4px);
  }

  .notification-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .icon {
    font-size: 18px;
  }

  .title {
    font-weight: 600;
    color: #fff;
    flex: 1;
  }

  .time {
    font-size: 12px;
    color: #9ca3af;
  }

  .close-btn {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #fff;
  }

  .message {
    color: #d1d5db;
    font-size: 14px;
    line-height: 1.4;
  }

  .unread-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 8px;
    height: 8px;
    background: #3b82f6;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @media (max-width: 768px) {
    .notification-container {
      right: 12px;
      left: 12px;
      max-width: none;
    }
  }
</style>