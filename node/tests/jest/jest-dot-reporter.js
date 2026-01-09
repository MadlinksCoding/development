/**
 * Simple Jest Reporter - Shows one dot per second while tests run
 */

class JestDotReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
    this._dotCount = 0;
    this._intervalId = null;
  }

  onRunStart() {
    const processStdout = process.stdout;
    if (processStdout && processStdout._handle && processStdout._handle.setBlocking) {
      processStdout._handle.setBlocking(true);
    }
    
    // Start dots animation - one dot per second
    this._dotCount = 0;
    this._intervalId = setInterval(() => {
      this._dotCount++;
      const dots = '.'.repeat(this._dotCount);
      process.stdout.write(`\r${dots}`);
    }, 1000); // One dot per second
  }

  onTestFileStart() {
    // No output - just let dots continue
  }

  onTestCaseStart() {
    // No output - just let dots continue
  }

  onTestCaseResult() {
    // No output - just let dots continue
  }

  onTestFileResult() {
    // No output - just let dots continue
  }

  onRunComplete(contexts, results) {
    // Stop dots animation
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    
    // Clear the dots line
    process.stdout.write('\r\x1b[K');
    
    // Jest's default reporter will show the final summary
  }
}

module.exports = JestDotReporter;

