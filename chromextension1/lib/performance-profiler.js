/**
 * Performance Profiler
 * Track and analyze extension performance
 * 
 * Features:
 * - Function execution timing
 * - Performance.mark and measure wrappers
 * - Memory snapshots
 * - DOM operation timing
 * - Export performance reports
 */

class PerformanceProfiler {
  constructor(config = null, logger = null) {
    this.config = config || (typeof window !== 'undefined' ? window.StepThreeDebugConfig : null);
    this.logger = logger || (typeof window !== 'undefined' ? window.StepThreeDebugLogger : null);
    
    this.marks = new Map();
    this.measures = [];
    this.functionTimings = [];
    this.memorySnapshots = [];
    this.domTimings = [];
    
    this.maxEntries = 500;
    this.isProfiling = false;
    
    this.stats = {
      totalMeasures: 0,
      totalFunctionCalls: 0,
      totalMemorySnapshots: 0,
      slowestOperation: null,
      averageExecutionTime: 0
    };
  }

  /**
   * Start profiling
   */
  start() {
    if (this.isProfiling) return;
    
    this.isProfiling = true;
    this._startMemoryMonitoring();
    
    if (this.logger) {
      this.logger.performance('Profiling started');
    }
  }

  /**
   * Stop profiling
   */
  stop() {
    this.isProfiling = false;
    this._stopMemoryMonitoring();
    
    if (this.logger) {
      this.logger.performance('Profiling stopped');
    }
  }

  /**
   * Create performance mark
   */
  mark(name) {
    if (!this.isProfiling) return;
    
    const timestamp = performance.now();
    
    this.marks.set(name, {
      name: name,
      timestamp: timestamp,
      time: Date.now()
    });
    
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
    }
    
    if (this.logger && this.config && this.config.getLevel() >= 2) {
      this.logger.performance('Mark created:', name);
    }
  }

  /**
   * Measure between marks
   */
  measure(name, startMark, endMark) {
    if (!this.isProfiling) return;
    
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    
    if (!start || !end) {
      console.warn(`[PerformanceProfiler] Invalid marks for measure: ${startMark}, ${endMark}`);
      return;
    }
    
    const duration = end.timestamp - start.timestamp;
    
    const measureEntry = {
      name: name,
      startMark: startMark,
      endMark: endMark,
      duration: duration,
      timestamp: Date.now()
    };
    
    this.measures.unshift(measureEntry);
    
    if (this.measures.length > this.maxEntries) {
      this.measures = this.measures.slice(0, this.maxEntries);
    }
    
    this.stats.totalMeasures++;
    
    if (!this.stats.slowestOperation || duration > this.stats.slowestOperation.duration) {
      this.stats.slowestOperation = measureEntry;
    }
    
    if (typeof performance !== 'undefined' && performance.measure) {
      performance.measure(name, startMark, endMark);
    }
    
    if (this.logger) {
      this.logger.performance(`Measure: ${name} = ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  /**
   * Wrap function for timing
   */
  wrap(fn, fnName) {
    if (!this.isProfiling) return fn;
    
    const profiler = this;
    
    return function(...args) {
      const startTime = performance.now();
      const startMark = `${fnName}-start-${Date.now()}`;
      
      profiler.mark(startMark);
      
      let result;
      let error;
      
      try {
        result = fn.apply(this, args);
      } catch (e) {
        error = e;
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const timing = {
        name: fnName,
        duration: duration,
        timestamp: Date.now(),
        args: args.length,
        error: error ? error.message : null
      };
      
      profiler.functionTimings.unshift(timing);
      
      if (profiler.functionTimings.length > profiler.maxEntries) {
        profiler.functionTimings = profiler.functionTimings.slice(0, profiler.maxEntries);
      }
      
      profiler.stats.totalFunctionCalls++;
      
      // Update average execution time
      const totalDuration = profiler.functionTimings.reduce((sum, t) => sum + t.duration, 0);
      profiler.stats.averageExecutionTime = totalDuration / profiler.functionTimings.length;
      
      if (profiler.logger && duration > 100) {
        profiler.logger.performance(`Slow function: ${fnName} = ${duration.toFixed(2)}ms`);
      }
      
      if (error) {
        throw error;
      }
      
      return result;
    };
  }

  /**
   * Time async function
   */
  async timeAsync(fn, fnName) {
    const startTime = performance.now();
    this.mark(`${fnName}-start`);
    
    let result;
    let error;
    
    try {
      result = await fn();
    } catch (e) {
      error = e;
    }
    
    this.mark(`${fnName}-end`);
    const duration = this.measure(fnName, `${fnName}-start`, `${fnName}-end`);
    
    if (error) {
      throw error;
    }
    
    return result;
  }

  /**
   * Take memory snapshot
   */
  takeMemorySnapshot(label = 'snapshot') {
    if (!this.isProfiling) return;
    
    const snapshot = {
      label: label,
      timestamp: Date.now(),
      memory: {
        available: false
      }
    };
    
    if (typeof performance !== 'undefined' && performance.memory) {
      snapshot.memory = {
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        available: true
      };
    }
    
    this.memorySnapshots.unshift(snapshot);
    
    if (this.memorySnapshots.length > this.maxEntries) {
      this.memorySnapshots = this.memorySnapshots.slice(0, this.maxEntries);
    }
    
    this.stats.totalMemorySnapshots++;
    
    if (this.logger && this.config && this.config.getLevel() >= 2) {
      this.logger.performance('Memory snapshot:', label, snapshot.memory.usedJSHeapSize);
    }
    
    return snapshot;
  }

  /**
   * Start automatic memory monitoring
   */
  _startMemoryMonitoring() {
    if (this.memoryInterval) return;
    
    this.memoryInterval = setInterval(() => {
      this.takeMemorySnapshot('auto');
    }, 5000);
  }

  /**
   * Stop memory monitoring
   */
  _stopMemoryMonitoring() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
  }

  /**
   * Time DOM operation
   */
  timeDOMOperation(operation, operationName) {
    if (!this.isProfiling) return operation();
    
    const startTime = performance.now();
    this.mark(`dom-${operationName}-start`);
    
    const result = operation();
    
    this.mark(`dom-${operationName}-end`);
    const duration = this.measure(`dom-${operationName}`, `dom-${operationName}-start`, `dom-${operationName}-end`);
    
    const domTiming = {
      operation: operationName,
      duration: duration,
      timestamp: Date.now()
    };
    
    this.domTimings.unshift(domTiming);
    
    if (this.domTimings.length > this.maxEntries) {
      this.domTimings = this.domTimings.slice(0, this.maxEntries);
    }
    
    if (this.logger && duration > 50) {
      this.logger.performance(`Slow DOM operation: ${operationName} = ${duration.toFixed(2)}ms`);
    }
    
    return result;
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const recentFunctions = this.functionTimings.slice(0, 100);
    const recentMeasures = this.measures.slice(0, 100);
    
    return {
      stats: { ...this.stats },
      slowestFunctions: this._getSlowFunctions(10),
      slowestMeasures: this._getSlowMeasures(10),
      memoryTrend: this._getMemoryTrend(),
      averages: {
        functionExecution: this.stats.averageExecutionTime,
        measureDuration: this._calculateAverage(recentMeasures, 'duration'),
        domOperation: this._calculateAverage(this.domTimings.slice(0, 100), 'duration')
      }
    };
  }

  /**
   * Get slowest functions
   */
  _getSlowFunctions(limit = 10) {
    return [...this.functionTimings]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get slowest measures
   */
  _getSlowMeasures(limit = 10) {
    return [...this.measures]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get memory trend
   */
  _getMemoryTrend() {
    const recent = this.memorySnapshots.slice(0, 20).reverse();
    
    if (recent.length < 2) return { trend: 'stable', change: 0 };
    
    const first = recent[0].memory.usedJSHeapSize || 0;
    const last = recent[recent.length - 1].memory.usedJSHeapSize || 0;
    const change = last - first;
    const percentChange = first > 0 ? (change / first) * 100 : 0;
    
    let trend = 'stable';
    if (percentChange > 10) trend = 'increasing';
    if (percentChange < -10) trend = 'decreasing';
    
    return {
      trend: trend,
      change: change,
      percentChange: percentChange.toFixed(2)
    };
  }

  /**
   * Calculate average
   */
  _calculateAverage(arr, property) {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, item) => acc + (item[property] || 0), 0);
    return sum / arr.length;
  }

  /**
   * Clear all data
   */
  clear() {
    this.marks.clear();
    this.measures = [];
    this.functionTimings = [];
    this.memorySnapshots = [];
    this.domTimings = [];
    
    this.stats = {
      totalMeasures: 0,
      totalFunctionCalls: 0,
      totalMemorySnapshots: 0,
      slowestOperation: null,
      averageExecutionTime: 0
    };
    
    if (this.logger) {
      this.logger.performance('Performance data cleared');
    }
  }

  /**
   * Export performance report
   */
  exportReport() {
    return {
      exportTime: new Date().toISOString(),
      metrics: this.getMetrics(),
      data: {
        measures: this.measures,
        functionTimings: this.functionTimings,
        memorySnapshots: this.memorySnapshots,
        domTimings: this.domTimings
      }
    };
  }

  /**
   * Get summary
   */
  getSummary() {
    const metrics = this.getMetrics();
    
    return {
      totalMeasures: this.stats.totalMeasures,
      totalFunctionCalls: this.stats.totalFunctionCalls,
      totalMemorySnapshots: this.stats.totalMemorySnapshots,
      averageExecutionTime: this.stats.averageExecutionTime.toFixed(2),
      slowestOperation: this.stats.slowestOperation?.name || 'N/A',
      memoryTrend: metrics.memoryTrend.trend,
      isProfiling: this.isProfiling
    };
  }
}

// Create global instance
const performanceProfiler = new PerformanceProfiler(
  typeof window !== 'undefined' ? window.StepThreeDebugConfig : null,
  typeof window !== 'undefined' ? window.StepThreeDebugLogger : null
);

// Make available globally
if (typeof window !== 'undefined') {
  window.StepThreePerformanceProfiler = performanceProfiler;
}
