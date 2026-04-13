
import { delay } from './geminiService';
import { useConfigStore } from '../stores/useConfigStore';

type Task<T> = () => Promise<T>;

interface QueuedTask<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  priority: number;
  timestamp: number;
}

class RequestScheduler {
  private static instance: RequestScheduler;
  private queue: QueuedTask<any>[] = [];
  private isProcessing: boolean = false;
  
  private lastRequestTime: number = 0;
  private cooldownUntil: number = 0;

  private constructor() {}

  public static getInstance(): RequestScheduler {
    if (!RequestScheduler.instance) {
      RequestScheduler.instance = new RequestScheduler();
    }
    return RequestScheduler.instance;
  }

  public async schedule<T>(task: Task<T>, priority: number = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject, priority, timestamp: Date.now() });
      // Sort by priority (higher first), then by timestamp (earlier first)
      this.queue.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.timestamp - b.timestamp;
      });
      
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      
      // Check if we are in a cooldown period (e.g. after a 429 error)
      const storeCooldown = useConfigStore.getState().cooldownUntil || 0;
      const effectiveCooldown = Math.max(this.cooldownUntil, storeCooldown);
      
      if (now < effectiveCooldown) {
        const waitTime = effectiveCooldown - now;
        console.warn(`System is in cooldown. Waiting ${Math.round(waitTime/1000)}s...`);
        await delay(Math.min(waitTime, 2000));
        continue;
      }

      // Determine interval based on tier and model
      const config = useConfigStore.getState().config;
      const tier = config?.tier || 'free';
      const model = config?.model || 'gemini-3.1-flash-lite-preview';
      
      let dynamicInterval = 2500;
      if (tier === 'paid') {
        // Paid tier is much faster but still has limits for Pro (25 RPM)
        if (model.includes('pro')) {
          dynamicInterval = 2500; // 25 RPM safety
        } else {
          dynamicInterval = 1500;  // ~40 RPM safety for paid non-Pro models
        }
      } else {
        // Free tier model-specific RPM logic
        // 15 RPM → 60000/15 = 4000ms minimum; use 4200ms for safety margin
        if (model.includes('pro')) {
          dynamicInterval = 12000;  // 5 RPM for pro models
        } else if (model.includes('flash-lite')) {
          dynamicInterval = 4200;  // 15 RPM → 4s + 200ms margin
        } else if (model.includes('flash')) {
          dynamicInterval = 4200;  // 15 RPM
        } else {
          dynamicInterval = 4200;  // Default safety
        }
      }
      
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
          this.cooldownUntil = 0;
          if (useConfigStore.getState().cooldownUntil) {
            useConfigStore.getState().setCooldownUntil(0);
          }
          item.resolve(result);
        } catch (error: any) {
          const errStr = String(error?.message || error || '');
          const isQuota = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.toLowerCase().includes('quota');
          
          if (isQuota) {
            const tier = useConfigStore.getState().config?.tier || 'free';
            const cooldownDuration = tier === 'paid' ? 1000 : 2000;
            const newCooldown = Date.now() + cooldownDuration;
            
            // Only update if the new cooldown is significantly further in the future
            if (newCooldown > effectiveCooldown + 500) {
              this.cooldownUntil = newCooldown;
              // Remove the store-level global freeze so the UI doesn't visually lock up, 
              // but the scheduler waits briefly to alleviate the surge.
            }
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

  public reset() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.cooldownUntil = 0;
  }
}

export const requestScheduler = RequestScheduler.getInstance();
