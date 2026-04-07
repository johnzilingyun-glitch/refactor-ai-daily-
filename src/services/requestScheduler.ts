
import { delay } from './geminiService';
import { useConfigStore } from '../stores/useConfigStore';

type Task<T> = () => Promise<T>;

interface QueuedTask<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  priority: number;
}

class RequestScheduler {
  private static instance: RequestScheduler;
  private queue: QueuedTask<any>[] = [];
  private isProcessing: boolean = false;
  
  // Gemini Free Tier: ~15 RPM is safe. Let's target 12 RPM (5s interval).
  private minIntervalMs: number = 4500; 
  private lastRequestTime: number = 0;

  private constructor() {}

  public static getInstance(): RequestScheduler {
    if (!RequestScheduler.instance) {
      RequestScheduler.instance = new RequestScheduler();
    }
    return RequestScheduler.instance;
  }

  public async schedule<T>(task: Task<T>, priority: number = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject, priority });
      // Sort by priority (higher first)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      
      // Check if we are in a cooldown period (e.g. after a 429 error)
      const cooldownUntil = useConfigStore.getState().cooldownUntil || 0;
      if (now < cooldownUntil) {
        const waitTime = cooldownUntil - now;
        console.warn(`System is in cooldown. Waiting ${Math.round(waitTime/1000)}s...`);
        await delay(Math.min(waitTime, 5000)); // Wait in small chunks to check length/abort
        continue;
      }

      // Determine interval based on tier
      const tier = useConfigStore.getState().config?.tier || 'free';
      const dynamicInterval = tier === 'paid' ? 400 : 4500;
      
      const timeSinceLast = now - this.lastRequestTime;
      
      if (timeSinceLast < dynamicInterval) {
        const waitTime = dynamicInterval - timeSinceLast;
        await delay(waitTime);
      }

      const item = this.queue.shift();
      if (item) {
        this.lastRequestTime = Date.now();
        try {
          const result = await item.task();
          // Reset cooldown on successful request
          if (useConfigStore.getState().cooldownUntil) {
            useConfigStore.getState().setCooldownUntil(0);
          }
          item.resolve(result);
        } catch (error: any) {
          const errStr = String(error?.message || error || '');
          const isQuota = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('quota');
          
          if (isQuota) {
            // Set a 60-second cooldown on 429
            const newCooldown = Date.now() + 60000;
            useConfigStore.getState().setCooldownUntil(newCooldown);
            console.error("Quota reached, entering 60s cooldown...");
          }
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public reset(minInterval: number = 4500) {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minIntervalMs = minInterval;
  }
}

export const requestScheduler = RequestScheduler.getInstance();
