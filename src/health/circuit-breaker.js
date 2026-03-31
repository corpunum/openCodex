/**
 * Circuit Breaker - Provider health monitoring
 */

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailure = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log('[CircuitBreaker] Half-open, testing...');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log('[CircuitBreaker] Closed (recovered)');
      }
      return result;
    } catch (e) {
      this.failures++;
      this.lastFailure = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.warn('[CircuitBreaker] Opened after', this.failures, 'failures');
      }
      
      throw e;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.lastFailure = null;
  }
}
