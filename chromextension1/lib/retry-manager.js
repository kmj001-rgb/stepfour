// retry-manager.js - Advanced Retry System for STEPTHREE Chrome Extension
// Phase 1b: Implements exponential backoff, circuit breaker patterns, and error-aware retry policies
// Integrates with ErrorHandlingSystem and chrome.alarms for service worker suspension survival

console.log('🔄 Loading RetryManager System...');

/**
 * RetryManager - Advanced retry system with exponential backoff and circuit breaker patterns
 * Provides robust retry mechanisms for downloads, network operations, and exports
 */
class RetryManager {
  constructor(options = {}) {
    this.options = {
      // Default retry policies
      defaultMaxAttempts: options.defaultMaxAttempts || 3,
      defaultBaseDelay: options.defaultBaseDelay || 1000, // 1 second
      defaultMaxDelay: options.defaultMaxDelay || 30000, // 30 seconds
      defaultJitterEnabled: options.defaultJitterEnabled !== false,
      
      // Circuit breaker settings
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerCooldown: options.circuitBreakerCooldown || 60000, // 1 minute
      circuitBreakerResetTimeout: options.circuitBreakerResetTimeout || 300000, // 5 minutes
      
      // State persistence
      stateKey: options.stateKey || 'stepthree_retry_state',
      stateSaveInterval: options.stateSaveInterval || 5000,
      
      // Performance settings
      maxConcurrentRetries: options.maxConcurrentRetries || 10,
      maxQueueSize: options.maxQueueSize || 1000,
      alarmNamePrefix: options.alarmNamePrefix || 'stepthree_retry_',
      
      // Integration settings
      enableBroadcasting: options.enableBroadcasting !== false,
      enableStateLogging: options.enableStateLogging !== false,
      
      ...options
    };

    // Error classification policies based on ErrorHandlingSystem
    this.errorPolicies = {
      // Network errors - retryable with exponential backoff
      network: {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        jitter: true,
        backoffMultiplier: 2.0,
        retryable: true
      },
      
      // Timeout errors - retryable with moderate backoff
      timeout: {
        maxAttempts: 4,
        baseDelay: 3000,
        maxDelay: 45000,
        jitter: true,
        backoffMultiplier: 1.8,
        retryable: true
      },
      
      // Server errors - retryable with aggressive backoff
      server: {
        maxAttempts: 4,
        baseDelay: 5000,
        maxDelay: 120000,
        jitter: true,
        backoffMultiplier: 2.5,
        retryable: true
      },
      
      // Rate limiting - retryable with extended delays
      rateLimit: {
        maxAttempts: 6,
        baseDelay: 10000,
        maxDelay: 300000, // 5 minutes
        jitter: true,
        backoffMultiplier: 3.0,
        retryable: true
      },
      
      // CORS errors - limited retry attempts
      cors: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        jitter: false,
        backoffMultiplier: 1.5,
        retryable: true
      },
      
      // Permission errors - not retryable
      permission: {
        maxAttempts: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
        backoffMultiplier: 1.0,
        retryable: false
      },
      
      // Not found errors - not retryable
      notFound: {
        maxAttempts: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
        backoffMultiplier: 1.0,
        retryable: false
      },
      
      // Extension errors - limited retry
      extension: {
        maxAttempts: 2,
        baseDelay: 2000,
        maxDelay: 10000,
        jitter: false,
        backoffMultiplier: 2.0,
        retryable: true
      },
      
      // Memory errors - not retryable
      memory: {
        maxAttempts: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
        backoffMultiplier: 1.0,
        retryable: false
      },
      
      // Validation errors - not retryable
      validation: {
        maxAttempts: 0,
        baseDelay: 0,
        maxDelay: 0,
        jitter: false,
        backoffMultiplier: 1.0,
        retryable: false
      },
      
      // Default policy for unknown errors
      default: {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        jitter: true,
        backoffMultiplier: 2.0,
        retryable: true
      }
    };

    // State management
    this.retryQueue = new Map(); // Map<taskId, RetryTask>
    this.circuitBreakers = new Map(); // Map<errorCategory, CircuitBreakerState>
    this.activeRetries = new Set(); // Set<taskId>
    this.cancelledTasks = new Set(); // Set<taskId>
    this.pausedCategories = new Set(); // Set<errorCategory>
    
    // Statistics
    this.stats = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      circuitBreakersTriggered: 0,
      tasksCompleted: 0,
      tasksCancelled: 0,
      currentQueueSize: 0,
      averageRetryTime: 0,
      errorCategoryCounts: {},
      lastStateUpdate: Date.now()
    };

    // Event callbacks
    this.callbacks = {
      onRetryAttempt: null,
      onRetrySuccess: null,
      onRetryFailure: null,
      onTaskComplete: null,
      onTaskCancelled: null,
      onCircuitBreakerTriggered: null,
      onCircuitBreakerReset: null,
      onStateChange: null
    };

    // Integration references
    this.errorHandler = null;
    this.proxyRouter = null;
    this.isInitialized = false;
    
    // State persistence
    this.lastStateSave = 0;
    this.pendingStateChanges = false;

    // Bind alarm handler once to avoid multiple listener registrations
    this.handleAlarmBound = this.handleAlarm.bind(this);

    console.log('✅ RetryManager initialized');
  }

  /**
   * Initialize the RetryManager system
   */
  async initialize(errorHandler = null, proxyRouter = null) {
    try {
      console.log('🚀 Initializing RetryManager...');
      
      // Set integration references
      this.errorHandler = errorHandler;
      this.proxyRouter = proxyRouter;
      
      // Load persisted state
      await this.loadState();
      
      // Set up chrome.alarms listener for delayed retries
      await this.setupAlarmListener();
      
      // Start state persistence
      this.startStatePersistence();
      
      // Clean up any stale alarms
      await this.cleanupStaleAlarms();
      
      this.isInitialized = true;
      
      console.log('✅ RetryManager initialized successfully');
      this.broadcastStateChange('retry_manager_initialized', { stats: this.getStats() });
      
      return true;
      
    } catch (error) {
      console.error('❌ RetryManager initialization failed:', error);
      this.broadcastStateChange('retry_manager_error', { error: error.message });
      
      const enhancedError = new Error(`[RetryManager Initialization] ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'initialize';
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Set up chrome.alarms listener for delayed retry attempts
   */
  async setupAlarmListener() {
    try {
      // Remove existing listener if any using bound reference
      if (chrome.alarms && chrome.alarms.onAlarm) {
        chrome.alarms.onAlarm.removeListener(this.handleAlarmBound);
        chrome.alarms.onAlarm.addListener(this.handleAlarmBound);
        console.log('✅ Chrome alarms listener set up for delayed retries');
      } else {
        console.warn('⚠️ Chrome alarms API not available');
      }
    } catch (error) {
      console.error('❌ Failed to setup alarm listener:', error);
      throw error;
    }
  }

  /**
   * Handle chrome.alarms events for scheduled retries
   */
  async handleAlarm(alarm) {
    try {
      // Check if this is a state persistence alarm
      if (alarm.name === 'retrymanager-state-save') {
        this.handleAlarmEvent(alarm);
        return;
      }
      
      // Check if this is a retry alarm
      if (alarm.name && alarm.name.startsWith(this.options.alarmNamePrefix)) {
        const taskId = alarm.name.replace(this.options.alarmNamePrefix, '');
        console.log(`⏰ Retry alarm triggered for task: ${taskId}`);
        
        await this.executeScheduledRetry(taskId);
      }
    } catch (error) {
      console.error(`❌ Error handling retry alarm for ${alarm.name}:`, error);
    }
  }

  /**
   * Execute a scheduled retry attempt
   */
  async executeScheduledRetry(taskId) {
    try {
      const retryTask = this.retryQueue.get(taskId);
      if (!retryTask) {
        console.warn(`⚠️ No retry task found for ID: ${taskId}`);
        return;
      }

      // Check if task was cancelled
      if (this.cancelledTasks.has(taskId)) {
        console.log(`🚫 Task ${taskId} was cancelled, skipping retry`);
        this.cleanupTask(taskId);
        return;
      }

      // Check circuit breaker status
      const circuitBreakerState = this.circuitBreakers.get(retryTask.errorCategory);
      if (circuitBreakerState && circuitBreakerState.isOpen) {
        console.log(`🔴 Circuit breaker open for ${retryTask.errorCategory}, deferring retry`);
        await this.scheduleRetryAfterCircuitBreakerCooldown(taskId, retryTask);
        return;
      }

      // Check if category is paused
      if (this.pausedCategories.has(retryTask.errorCategory)) {
        console.log(`⏸️ Category ${retryTask.errorCategory} is paused, deferring retry`);
        await this.scheduleRetry(taskId, this.calculateNextDelay(retryTask));
        return;
      }

      // Execute the retry
      await this.attemptRetry(retryTask);
      
    } catch (error) {
      console.error(`❌ Error executing scheduled retry for ${taskId}:`, error);
      this.handleRetryError(taskId, error);
    }
  }

  /**
   * Retry a task with automatic policy determination
   */
  async retryTask(taskId, operation, options = {}) {
    try {
      // Validate inputs
      if (!taskId || typeof taskId !== 'string') {
        throw new Error('Invalid task ID provided');
      }

      if (!operation || typeof operation !== 'function') {
        throw new Error('Invalid operation function provided');
      }

      // Check if already retrying
      if (this.retryQueue.has(taskId)) {
        console.warn(`⚠️ Task ${taskId} is already in retry queue`);
        return false;
      }

      // Check queue size limits
      if (this.retryQueue.size >= this.options.maxQueueSize) {
        throw new Error('Retry queue is full');
      }

      // Create retry task
      const retryTask = this.createRetryTask(taskId, operation, options);
      
      // Add to queue
      this.retryQueue.set(taskId, retryTask);
      this.updateStats();
      
      // Start immediate retry attempt
      await this.attemptRetry(retryTask);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to start retry for task ${taskId}:`, error);
      this.broadcastStateChange('retry_task_error', { 
        taskId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a retry task with appropriate policies
   */
  createRetryTask(taskId, operation, options = {}) {
    // Determine error category if provided
    const errorCategory = options.errorCategory || 'default';
    
    // Get retry policy for error category
    const policy = this.getRetryPolicy(errorCategory, options.policyOverride);
    
    // Create retry task
    const retryTask = {
      taskId,
      operation,
      errorCategory,
      policy,
      attemptCount: 0,
      maxAttempts: policy.maxAttempts,
      baseDelay: policy.baseDelay,
      maxDelay: policy.maxDelay,
      jitter: policy.jitter,
      backoffMultiplier: policy.backoffMultiplier,
      retryable: policy.retryable,
      startTime: Date.now(),
      lastAttemptTime: null,
      nextRetryAt: null,
      lastError: null,
      context: options.context || {},
      metadata: options.metadata || {},
      priority: options.priority || 'medium'
    };

    return retryTask;
  }

  /**
   * Get retry policy for error category
   */
  getRetryPolicy(errorCategory, policyOverride = {}) {
    const basePolicy = this.errorPolicies[errorCategory] || this.errorPolicies.default;
    
    // Apply policy overrides
    return {
      ...basePolicy,
      ...policyOverride
    };
  }

  /**
   * Attempt to execute a retry task
   */
  async attemptRetry(retryTask) {
    try {
      // Check if task is retryable
      if (!retryTask.retryable) {
        console.log(`🚫 Task ${retryTask.taskId} is not retryable`);
        await this.handleTaskFailure(retryTask, 'Task is not retryable');
        return;
      }

      // Check attempt limits
      if (retryTask.attemptCount >= retryTask.maxAttempts) {
        console.log(`🚫 Task ${retryTask.taskId} exceeded max attempts (${retryTask.maxAttempts})`);
        await this.handleTaskFailure(retryTask, 'Maximum retry attempts exceeded');
        return;
      }

      // Check if cancelled
      if (this.cancelledTasks.has(retryTask.taskId)) {
        console.log(`🚫 Task ${retryTask.taskId} was cancelled`);
        await this.handleTaskCancellation(retryTask);
        return;
      }

      // Increment attempt count
      retryTask.attemptCount++;
      retryTask.lastAttemptTime = Date.now();
      this.activeRetries.add(retryTask.taskId);

      // Broadcast retry attempt
      this.broadcastStateChange('retry_attempt', {
        taskId: retryTask.taskId,
        attemptCount: retryTask.attemptCount,
        maxAttempts: retryTask.maxAttempts,
        errorCategory: retryTask.errorCategory
      });

      console.log(`🔄 Retry attempt ${retryTask.attemptCount}/${retryTask.maxAttempts} for task ${retryTask.taskId}`);

      // Execute the operation
      const result = await retryTask.operation();
      
      // Success - complete the task
      await this.handleTaskSuccess(retryTask, result);
      
    } catch (error) {
      console.error(`❌ Retry attempt failed for task ${retryTask.taskId}:`, error);
      await this.handleRetryAttemptFailure(retryTask, error);
    }
  }

  /**
   * Handle retry attempt failure
   */
  async handleRetryAttemptFailure(retryTask, error) {
    try {
      // Remove from active retries
      this.activeRetries.delete(retryTask.taskId);
      
      // Store the error
      retryTask.lastError = error;
      
      // Classify the error using ErrorHandlingSystem if available
      let errorCategory = retryTask.errorCategory;
      if (this.errorHandler && this.errorHandler.classifyError) {
        const classification = this.errorHandler.classifyError(error);
        if (classification && classification.category) {
          errorCategory = classification.category;
          retryTask.errorCategory = errorCategory;
        }
      }

      // Update circuit breaker
      await this.updateCircuitBreaker(errorCategory, false);
      
      // Check if should retry
      if (retryTask.attemptCount < retryTask.maxAttempts && retryTask.retryable) {
        // Calculate next retry delay
        const delay = this.calculateNextDelay(retryTask);
        retryTask.nextRetryAt = Date.now() + delay;
        
        // Schedule next retry
        await this.scheduleRetry(retryTask.taskId, delay);
        
        // Broadcast retry scheduled
        this.broadcastStateChange('retry_scheduled', {
          taskId: retryTask.taskId,
          nextRetryAt: retryTask.nextRetryAt,
          delay,
          errorCategory,
          error: error.message
        });
        
      } else {
        // Task failed permanently
        await this.handleTaskFailure(retryTask, error.message);
      }
      
    } catch (handlingError) {
      console.error(`❌ Error handling retry failure for ${retryTask.taskId}:`, handlingError);
    }
  }

  /**
   * Handle successful task completion
   */
  async handleTaskSuccess(retryTask, result) {
    try {
      // Remove from active sets
      this.activeRetries.delete(retryTask.taskId);
      this.retryQueue.delete(retryTask.taskId);
      
      // Update circuit breaker
      await this.updateCircuitBreaker(retryTask.errorCategory, true);
      
      // Update statistics
      this.stats.successfulRetries++;
      this.stats.tasksCompleted++;
      this.updateStats();
      
      // Clean up any scheduled alarms
      await this.clearRetryAlarm(retryTask.taskId);
      
      // Broadcast success
      this.broadcastStateChange('retry_success', {
        taskId: retryTask.taskId,
        attemptCount: retryTask.attemptCount,
        totalTime: Date.now() - retryTask.startTime,
        result
      });
      
      console.log(`✅ Task ${retryTask.taskId} completed successfully after ${retryTask.attemptCount} attempts`);
      
      // Call success callback
      if (this.callbacks.onRetrySuccess) {
        this.callbacks.onRetrySuccess(retryTask, result);
      }
      
    } catch (error) {
      console.error(`❌ Error handling task success for ${retryTask.taskId}:`, error);
    }
  }

  /**
   * Handle permanent task failure
   */
  async handleTaskFailure(retryTask, reason) {
    try {
      // Remove from active sets
      this.activeRetries.delete(retryTask.taskId);
      this.retryQueue.delete(retryTask.taskId);
      
      // Update statistics
      this.stats.failedRetries++;
      this.updateStats();
      
      // Clean up any scheduled alarms
      await this.clearRetryAlarm(retryTask.taskId);
      
      // Broadcast failure
      this.broadcastStateChange('retry_failure', {
        taskId: retryTask.taskId,
        attemptCount: retryTask.attemptCount,
        totalTime: Date.now() - retryTask.startTime,
        reason,
        lastError: retryTask.lastError?.message
      });
      
      console.log(`❌ Task ${retryTask.taskId} failed permanently: ${reason}`);
      
      // Call failure callback
      if (this.callbacks.onRetryFailure) {
        this.callbacks.onRetryFailure(retryTask, reason);
      }
      
    } catch (error) {
      console.error(`❌ Error handling task failure for ${retryTask.taskId}:`, error);
    }
  }

  /**
   * Handle task cancellation
   */
  async handleTaskCancellation(retryTask) {
    try {
      // Remove from active sets
      this.activeRetries.delete(retryTask.taskId);
      this.retryQueue.delete(retryTask.taskId);
      this.cancelledTasks.delete(retryTask.taskId); // Clean up cancelled tracking
      
      // Update statistics
      this.stats.tasksCancelled++;
      this.updateStats();
      
      // Clean up any scheduled alarms
      await this.clearRetryAlarm(retryTask.taskId);
      
      // Broadcast cancellation
      this.broadcastStateChange('retry_cancelled', {
        taskId: retryTask.taskId,
        attemptCount: retryTask.attemptCount,
        totalTime: Date.now() - retryTask.startTime
      });
      
      console.log(`🚫 Task ${retryTask.taskId} was cancelled`);
      
      // Call cancellation callback
      if (this.callbacks.onTaskCancelled) {
        this.callbacks.onTaskCancelled(retryTask);
      }
      
    } catch (error) {
      console.error(`❌ Error handling task cancellation for ${retryTask.taskId}:`, error);
    }
  }

  /**
   * Calculate next retry delay with exponential backoff and jitter
   */
  calculateNextDelay(retryTask) {
    let delay = retryTask.baseDelay * Math.pow(retryTask.backoffMultiplier, retryTask.attemptCount - 1);
    
    // Apply maximum delay limit
    delay = Math.min(delay, retryTask.maxDelay);
    
    // Apply jitter if enabled (full jitter)
    if (retryTask.jitter) {
      delay = Math.random() * delay;
    }
    
    // Ensure minimum delay
    delay = Math.max(delay, 100);
    
    return Math.floor(delay);
  }

  /**
   * Schedule retry using chrome.alarms
   */
  async scheduleRetry(taskId, delayMs) {
    try {
      const alarmName = this.options.alarmNamePrefix + taskId;
      const when = Date.now() + delayMs;
      
      // Clear any existing alarm for this task
      await this.clearRetryAlarm(taskId);
      
      // Create new alarm
      if (chrome.alarms && chrome.alarms.create) {
        await chrome.alarms.create(alarmName, { when });
        console.log(`⏰ Scheduled retry for ${taskId} in ${delayMs}ms`);
      } else {
        // Fallback to setTimeout (less reliable in service worker)
        console.warn('⚠️ Chrome alarms not available, using setTimeout fallback');
        setTimeout(() => {
          this.executeScheduledRetry(taskId);
        }, delayMs);
      }
      
    } catch (error) {
      console.error(`❌ Failed to schedule retry for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Clear retry alarm for a task
   */
  async clearRetryAlarm(taskId) {
    try {
      const alarmName = this.options.alarmNamePrefix + taskId;
      
      if (chrome.alarms && chrome.alarms.clear) {
        await chrome.alarms.clear(alarmName);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to clear retry alarm for ${taskId}:`, error);
    }
  }

  /**
   * Update circuit breaker state
   */
  async updateCircuitBreaker(errorCategory, success) {
    try {
      let circuitBreaker = this.circuitBreakers.get(errorCategory);
      
      if (!circuitBreaker) {
        circuitBreaker = {
          errorCategory,
          failureCount: 0,
          successCount: 0,
          isOpen: false,
          openedAt: null,
          lastFailureAt: null,
          lastSuccessAt: null
        };
        this.circuitBreakers.set(errorCategory, circuitBreaker);
      }
      
      const now = Date.now();
      
      if (success) {
        circuitBreaker.successCount++;
        circuitBreaker.lastSuccessAt = now;
        
        // Reset failure count on success
        if (circuitBreaker.failureCount > 0) {
          circuitBreaker.failureCount = 0;
        }
        
        // Close circuit breaker if it was open
        if (circuitBreaker.isOpen) {
          circuitBreaker.isOpen = false;
          circuitBreaker.openedAt = null;
          
          console.log(`🟢 Circuit breaker reset for ${errorCategory}`);
          this.broadcastStateChange('circuit_breaker_reset', {
            errorCategory,
            successCount: circuitBreaker.successCount
          });
          
          if (this.callbacks.onCircuitBreakerReset) {
            this.callbacks.onCircuitBreakerReset(errorCategory, circuitBreaker);
          }
        }
        
      } else {
        circuitBreaker.failureCount++;
        circuitBreaker.lastFailureAt = now;
        
        // Check if should open circuit breaker
        if (!circuitBreaker.isOpen && 
            circuitBreaker.failureCount >= this.options.circuitBreakerThreshold) {
          
          circuitBreaker.isOpen = true;
          circuitBreaker.openedAt = now;
          this.stats.circuitBreakersTriggered++;
          
          console.log(`🔴 Circuit breaker opened for ${errorCategory} after ${circuitBreaker.failureCount} failures`);
          this.broadcastStateChange('circuit_breaker_opened', {
            errorCategory,
            failureCount: circuitBreaker.failureCount,
            threshold: this.options.circuitBreakerThreshold,
            cooldownMs: this.options.circuitBreakerCooldown
          });
          
          if (this.callbacks.onCircuitBreakerTriggered) {
            this.callbacks.onCircuitBreakerTriggered(errorCategory, circuitBreaker);
          }
          
          // Schedule circuit breaker reset
          await this.scheduleCircuitBreakerReset(errorCategory);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error updating circuit breaker for ${errorCategory}:`, error);
    }
  }

  /**
   * Schedule circuit breaker reset after cooldown
   */
  async scheduleCircuitBreakerReset(errorCategory) {
    try {
      const alarmName = `${this.options.alarmNamePrefix}cb_reset_${errorCategory}`;
      const when = Date.now() + this.options.circuitBreakerResetTimeout;
      
      if (chrome.alarms && chrome.alarms.create) {
        await chrome.alarms.create(alarmName, { when });
        console.log(`⏰ Scheduled circuit breaker reset for ${errorCategory} in ${this.options.circuitBreakerResetTimeout}ms`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to schedule circuit breaker reset for ${errorCategory}:`, error);
    }
  }

  /**
   * Schedule retry after circuit breaker cooldown
   */
  async scheduleRetryAfterCircuitBreakerCooldown(taskId, retryTask) {
    try {
      const delay = this.options.circuitBreakerCooldown;
      retryTask.nextRetryAt = Date.now() + delay;
      
      await this.scheduleRetry(taskId, delay);
      
      this.broadcastStateChange('retry_deferred_circuit_breaker', {
        taskId,
        errorCategory: retryTask.errorCategory,
        nextRetryAt: retryTask.nextRetryAt,
        cooldownMs: delay
      });
      
    } catch (error) {
      console.error(`❌ Failed to schedule retry after circuit breaker cooldown:`, error);
    }
  }

  /**
   * Cancel a retry task
   */
  async cancelTask(taskId) {
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new Error('Invalid task ID provided');
      }

      // Add to cancelled set
      this.cancelledTasks.add(taskId);
      
      // Clear any scheduled alarm
      await this.clearRetryAlarm(taskId);
      
      // If task is in queue, handle cancellation
      const retryTask = this.retryQueue.get(taskId);
      if (retryTask) {
        await this.handleTaskCancellation(retryTask);
      }
      
      console.log(`🚫 Task ${taskId} marked for cancellation`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to cancel task ${taskId}:`, error);
      
      const enhancedError = new Error(`[RetryManager Cancel Task] Failed to cancel task ${taskId}: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'cancelTask';
      enhancedError.taskId = taskId;
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Pause retry operations for a specific error category
   */
  pauseCategory(errorCategory) {
    try {
      this.pausedCategories.add(errorCategory);
      
      this.broadcastStateChange('category_paused', {
        errorCategory,
        pausedCategories: Array.from(this.pausedCategories)
      });
      
      console.log(`⏸️ Paused retry operations for category: ${errorCategory}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to pause category ${errorCategory}:`, error);
      
      const enhancedError = new Error(`[RetryManager Pause Category] Failed to pause ${errorCategory}: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'pauseCategory';
      enhancedError.errorCategory = errorCategory;
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Resume retry operations for a specific error category
   */
  resumeCategory(errorCategory) {
    try {
      this.pausedCategories.delete(errorCategory);
      
      this.broadcastStateChange('category_resumed', {
        errorCategory,
        pausedCategories: Array.from(this.pausedCategories)
      });
      
      console.log(`▶️ Resumed retry operations for category: ${errorCategory}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to resume category ${errorCategory}:`, error);
      
      const enhancedError = new Error(`[RetryManager Resume Category] Failed to resume ${errorCategory}: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'resumeCategory';
      enhancedError.errorCategory = errorCategory;
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Pause all retry operations
   */
  pauseAll() {
    try {
      // Add all error categories to paused set
      Object.keys(this.errorPolicies).forEach(category => {
        if (category !== 'default') {
          this.pausedCategories.add(category);
        }
      });
      
      this.broadcastStateChange('all_paused', {
        pausedCategories: Array.from(this.pausedCategories)
      });
      
      console.log('⏸️ Paused all retry operations');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to pause all operations:', error);
      
      const enhancedError = new Error(`[RetryManager Pause All] Failed to pause all retry operations: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'pauseAll';
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Resume all retry operations
   */
  resumeAll() {
    try {
      this.pausedCategories.clear();
      
      this.broadcastStateChange('all_resumed', {
        pausedCategories: Array.from(this.pausedCategories)
      });
      
      console.log('▶️ Resumed all retry operations');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to resume all operations:', error);
      
      const enhancedError = new Error(`[RetryManager Resume All] Failed to resume all retry operations: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.context = 'resumeAll';
      enhancedError.timestamp = Date.now();
      throw enhancedError;
    }
  }

  /**
   * Get current retry statistics
   */
  getStats() {
    this.stats.currentQueueSize = this.retryQueue.size;
    this.stats.lastStateUpdate = Date.now();
    
    return {
      ...this.stats,
      circuitBreakers: this.getCircuitBreakerStats(),
      pausedCategories: Array.from(this.pausedCategories),
      activeRetries: this.activeRetries.size,
      queuedTasks: this.retryQueue.size
    };
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    const stats = {};
    
    this.circuitBreakers.forEach((breaker, category) => {
      stats[category] = {
        isOpen: breaker.isOpen,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        openedAt: breaker.openedAt,
        lastFailureAt: breaker.lastFailureAt,
        lastSuccessAt: breaker.lastSuccessAt
      };
    });
    
    return stats;
  }

  /**
   * Get retry queue status
   */
  getQueueStatus() {
    const queuedTasks = [];
    
    this.retryQueue.forEach((task, taskId) => {
      queuedTasks.push({
        taskId,
        errorCategory: task.errorCategory,
        attemptCount: task.attemptCount,
        maxAttempts: task.maxAttempts,
        nextRetryAt: task.nextRetryAt,
        lastError: task.lastError?.message,
        priority: task.priority,
        startTime: task.startTime,
        isActive: this.activeRetries.has(taskId)
      });
    });
    
    return {
      queuedTasks,
      totalTasks: queuedTasks.length,
      activeTasks: this.activeRetries.size,
      pausedCategories: Array.from(this.pausedCategories)
    };
  }

  /**
   * Update statistics
   */
  updateStats() {
    this.stats.totalRetries = this.stats.successfulRetries + this.stats.failedRetries;
    this.stats.currentQueueSize = this.retryQueue.size;
    this.stats.lastStateUpdate = Date.now();
    
    // Update error category counts
    this.retryQueue.forEach((task) => {
      const category = task.errorCategory;
      this.stats.errorCategoryCounts[category] = (this.stats.errorCategoryCounts[category] || 0) + 1;
    });
    
    this.pendingStateChanges = true;
  }

  /**
   * Clean up completed or cancelled tasks
   */
  cleanupTask(taskId) {
    try {
      this.retryQueue.delete(taskId);
      this.activeRetries.delete(taskId);
      this.cancelledTasks.delete(taskId);
      this.clearRetryAlarm(taskId);
      
      this.updateStats();
      
    } catch (error) {
      console.error(`❌ Error cleaning up task ${taskId}:`, error);
    }
  }

  /**
   * Clean up stale alarms that may be left from previous sessions
   */
  async cleanupStaleAlarms() {
    try {
      if (!chrome.alarms || !chrome.alarms.getAll) {
        return;
      }
      
      const alarms = await chrome.alarms.getAll();
      const staleAlarms = alarms.filter(alarm => 
        alarm.name.startsWith(this.options.alarmNamePrefix) &&
        !this.retryQueue.has(alarm.name.replace(this.options.alarmNamePrefix, ''))
      );
      
      for (const alarm of staleAlarms) {
        await chrome.alarms.clear(alarm.name);
        console.log(`🧹 Cleaned up stale alarm: ${alarm.name}`);
      }
      
      if (staleAlarms.length > 0) {
        console.log(`✅ Cleaned up ${staleAlarms.length} stale retry alarms`);
      }
      
    } catch (error) {
      console.error('❌ Error cleaning up stale alarms:', error);
    }
  }

  /**
   * Broadcast state changes via ProxyRouter
   */
  broadcastStateChange(updateType, data) {
    try {
      if (!this.options.enableBroadcasting || !this.proxyRouter) {
        return;
      }
      
      this.proxyRouter.broadcast({
        action: 'BROADCAST_UPDATE',
        updateType: `retry_${updateType}`,
        data,
        timestamp: Date.now(),
        source: 'retry_manager'
      });
      
      // Call state change callback
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange(updateType, data);
      }
      
    } catch (error) {
      console.error(`❌ Error broadcasting state change ${updateType}:`, error);
    }
  }

  /**
   * Start periodic state persistence
   * BUG FIX: Use chrome.alarms instead of setInterval for MV3 compliance
   */
  startStatePersistence() {
    // BUG FIX: Check if we're in a service worker context
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      // Use chrome.alarms in service worker
      chrome.alarms.create('retrymanager-state-save', {
        periodInMinutes: this.options.stateSaveInterval / 60000
      });
      console.log('🔄 RetryManager state persistence started with chrome.alarms');
    } else {
      // Fallback to setInterval in other contexts (content script, etc.)
      setInterval(() => {
        if (this.pendingStateChanges) {
          this.saveState();
          this.pendingStateChanges = false;
        }
      }, this.options.stateSaveInterval);
      console.log('🔄 RetryManager state persistence started with setInterval (non-SW context)');
    }
  }
  
  /**
   * Handle alarm event for state persistence
   * BUG FIX: Added to handle chrome.alarms callback
   */
  handleAlarmEvent(alarm) {
    if (alarm.name === 'retrymanager-state-save') {
      if (this.pendingStateChanges) {
        this.saveState();
        this.pendingStateChanges = false;
      }
    }
  }

  /**
   * Save retry manager state to storage
   */
  async saveState() {
    try {
      if (!chrome.storage || !chrome.storage.session) {
        return;
      }
      
      // Serialize retries Map to include in state
      const retriesArray = Array.from(this.retryQueue.entries()).map(([taskId, task]) => [
        taskId,
        {
          taskId: task.taskId,
          errorCategory: task.errorCategory,
          attemptCount: task.attemptCount,
          maxAttempts: task.maxAttempts,
          baseDelay: task.baseDelay,
          maxDelay: task.maxDelay,
          jitter: task.jitter,
          backoffMultiplier: task.backoffMultiplier,
          retryable: task.retryable,
          startTime: task.startTime,
          lastAttemptTime: task.lastAttemptTime,
          nextRetryAt: task.nextRetryAt,
          lastError: task.lastError ? { message: task.lastError.message, name: task.lastError.name } : null,
          context: task.context,
          metadata: task.metadata,
          priority: task.priority
          // Note: operation function cannot be serialized, will need to be re-added on restore
        }
      ]);
      
      const state = {
        stats: this.stats,
        circuitBreakers: Array.from(this.circuitBreakers.entries()),
        pausedCategories: Array.from(this.pausedCategories),
        retries: retriesArray,
        activeRetries: Array.from(this.activeRetries),
        cancelledTasks: Array.from(this.cancelledTasks),
        lastSaved: Date.now()
      };
      
      await chrome.storage.session.set({
        [this.options.stateKey]: state
      });
      
      this.lastStateSave = Date.now();
      
      if (this.options.enableStateLogging) {
        console.log('💾 Retry manager state saved');
      }
      
    } catch (error) {
      console.error('❌ Failed to save retry manager state:', error);
    }
  }

  /**
   * Load retry manager state from storage
   */
  async loadState() {
    try {
      if (!chrome.storage || !chrome.storage.session) {
        return;
      }
      
      const result = await chrome.storage.session.get(this.options.stateKey);
      const state = result[this.options.stateKey];
      
      if (state && state.lastSaved) {
        // Restore statistics
        if (state.stats) {
          this.stats = { ...this.stats, ...state.stats };
        }
        
        // Restore circuit breakers
        if (state.circuitBreakers) {
          this.circuitBreakers = new Map(state.circuitBreakers);
        }
        
        // Restore paused categories
        if (state.pausedCategories) {
          this.pausedCategories = new Set(state.pausedCategories);
        }
        
        // Restore retry tasks (without operations, those need to be re-added)
        if (state.retries) {
          this.retryQueue = new Map(state.retries);
        }
        
        // Restore active retries tracking
        if (state.activeRetries) {
          this.activeRetries = new Set(state.activeRetries);
        }
        
        // Restore cancelled tasks tracking
        if (state.cancelledTasks) {
          this.cancelledTasks = new Set(state.cancelledTasks);
        }
        
        console.log('✅ Retry manager state loaded from storage');
        this.updateStats();
      }
      
    } catch (error) {
      console.error('❌ Failed to load retry manager state:', error);
    }
  }

  /**
   * Set callback functions
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Classify error using ErrorHandlingSystem integration
   */
  classifyError(error) {
    try {
      if (this.errorHandler && this.errorHandler.classifyError) {
        const classification = this.errorHandler.classifyError(error);
        return classification?.category || 'default';
      }
      
      // Fallback classification
      const errorMessage = error?.message?.toLowerCase() || '';
      
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return 'network';
      } else if (errorMessage.includes('timeout')) {
        return 'timeout';
      } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        return 'rateLimit';
      } else if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('permission')) {
        return 'permission';
      } else if (errorMessage.includes('404')) {
        return 'notFound';
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        return 'server';
      } else if (errorMessage.includes('cors')) {
        return 'cors';
      }
      
      return 'default';
      
    } catch (classificationError) {
      console.error('❌ Error classifying error:', classificationError);
      return 'default';
    }
  }

  /**
   * Destroy the RetryManager and clean up resources
   */
  async destroy() {
    try {
      console.log('🧹 Destroying RetryManager...');
      
      // Cancel all active tasks
      const taskIds = Array.from(this.retryQueue.keys());
      for (const taskId of taskIds) {
        await this.cancelTask(taskId);
      }
      
      // Clear all alarms
      await this.cleanupStaleAlarms();
      
      // Clear state
      this.retryQueue.clear();
      this.circuitBreakers.clear();
      this.activeRetries.clear();
      this.cancelledTasks.clear();
      this.pausedCategories.clear();
      
      // Save final state
      await this.saveState();
      
      this.isInitialized = false;
      
      console.log('✅ RetryManager destroyed');
      
    } catch (error) {
      console.error('❌ Error destroying RetryManager:', error);
    }
  }
}

// Make RetryManager available globally for Chrome extension context
if (typeof globalThis !== 'undefined') {
  globalThis.RetryManager = RetryManager;
}

console.log('✅ RetryManager loaded successfully');